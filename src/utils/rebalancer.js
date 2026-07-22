import solver from 'javascript-lp-solver';
import { getAssetClassRatios } from './calculations.js';

/**
 * Calculates rebalancing trades to satisfy Class Min/Max targets minimizing drift and turnover.
 *
 * @param {Array} accounts - Array of account objects: { id, positions: [{ Symbol, SimulatedValue }] }
 * @param {Object} metadata - Metadata object for symbols to determine asset class ratios.
 * @param {Object} targetRanges - { "Asset Class Name": { min: 0.0-1.0, max: 0.0-1.0 } }
 * @param {Object} locks - { accountId: { symbol: { noBuy: boolean, noSell: boolean } } }
 * @returns {Object} Result containing trades and status.
 */
export const calculateRebalancing = (accounts, metadata, targetRanges, locks = {}) => {
  const model = {
    optimize: "cost",
    opType: "min",
    constraints: {},
    variables: {}
  };

  // 1. Calculate Total Wealth and Current Exposures
  let totalWealth = 0;
  const currentExposures = {};
  
  accounts.forEach(account => {
    account.positions.forEach(pos => {
      totalWealth += pos.SimulatedValue;
      const ratios = getAssetClassRatios(pos.Symbol, metadata);
      Object.entries(ratios).forEach(([cls, ratio]) => {
        currentExposures[cls] = (currentExposures[cls] || 0) + (pos.SimulatedValue * ratio);
      });
    });
  });

  // Ensure all target classes exist in currentExposures for calculation (even if 0)
  Object.keys(targetRanges).forEach(cls => {
    if (!currentExposures[cls]) currentExposures[cls] = 0;
  });

  // 2. Setup Constraints
  // Account Balance Constraints: Sum(Sell) - Sum(Buy) = 0
  accounts.forEach(account => {
    model.constraints[`bal_${account.id}`] = { equal: 0 };
  });

  // Class Min/Max Constraints
  const PENALTY_COST = 10000;
  const TURNOVER_COST = 1;

  Object.entries(targetRanges).forEach(([cls, range]) => {
    const currentVal = currentExposures[cls] || 0;
    const minVal = range.min * totalWealth;
    const maxVal = range.max * totalWealth;

    // Constraint: Change >= Min - Current
    model.constraints[`min_${cls}`] = { min: minVal - currentVal };
    
    // Constraint: Change <= Max - Current
    model.constraints[`max_${cls}`] = { max: maxVal - currentVal };

    // Slack Variables for Elastic Constraints
    // slack_min: compensates if we can't reach min
    model.variables[`slack_min_${cls}`] = {
      cost: PENALTY_COST,
      [`min_${cls}`]: 1 // contributes +1 to the change sum, effectively lowering requirement
    };

    // slack_max: compensates if we can't get down to max
    model.variables[`slack_max_${cls}`] = {
      cost: PENALTY_COST,
      [`max_${cls}`]: -1 // contributes -1 to the change sum, effectively raising requirement
    };
  });

  // 3. Setup Variables (Buy/Sell)
  accounts.forEach(account => {
    const accountLocks = locks[account.id] || {};
    
    account.positions.forEach(pos => {
      const sym = pos.Symbol;
      const ratios = getAssetClassRatios(sym, metadata);
      const symbolLocks = accountLocks[sym] || {};
      
      // Buy Variable
      // Buying consumes cash (bal -1) and increases exposure
      const buyVar = {
        cost: TURNOVER_COST,
        [`bal_${account.id}`]: -1
      };
      
      Object.entries(ratios).forEach(([cls, ratio]) => {
        // Only if this class has a target constraint
        if (targetRanges[cls]) {
          buyVar[`min_${cls}`] = ratio;
          buyVar[`max_${cls}`] = ratio;
        }
      });
      
      // Add constraint to disallow buying if locked
      if (symbolLocks.noBuy) {
        model.constraints[`noBuy_${account.id}_${sym}`] = { max: 0 };
        buyVar[`noBuy_${account.id}_${sym}`] = 1;
      }
      
      model.variables[`buy_${account.id}_${sym}`] = buyVar;

      // Sell Variable
      // Selling generates cash (bal +1) and decreases exposure
      // Cannot sell more than current holding
      // If noSell is true, we set max inventory allowed to sell to 0
      // Also clamp to 0 if position is negative (cannot sell short/more of short)
      const maxToSell = symbolLocks.noSell ? 0 : Math.max(0, pos.SimulatedValue);
      model.constraints[`inv_${account.id}_${sym}`] = { max: maxToSell };
      
      const sellVar = {
        cost: TURNOVER_COST,
        [`bal_${account.id}`]: 1,
        [`inv_${account.id}_${sym}`]: 1
      };

      Object.entries(ratios).forEach(([cls, ratio]) => {
        if (targetRanges[cls]) {
          sellVar[`min_${cls}`] = -ratio;
          sellVar[`max_${cls}`] = -ratio;
        }
      });

      model.variables[`sell_${account.id}_${sym}`] = sellVar;
    });
  });

  // 4. Solve
  const solution = solver.Solve(model);

  // 5. Parse Results
  const rawTrades = [];
  
  if (solution.feasible) {
    Object.entries(solution).forEach(([key, val]) => {
      const roundedVal = Math.round(val);
      if (roundedVal > 0) {
        if (key.startsWith('buy_')) {
          const parts = key.split('_');
          const accId = parts[1];
          const sym = parts.slice(2).join('_');
          rawTrades.push({ type: 'BUY', accountId: accId, symbol: sym, amount: roundedVal });
        } else if (key.startsWith('sell_')) {
          const parts = key.split('_');
          const accId = parts[1];
          const sym = parts.slice(2).join('_');
          rawTrades.push({ type: 'SELL', accountId: accId, symbol: sym, amount: roundedVal });
        }
      }
    });
  }

  // Adjust for rounding differences per account to ensure net cash flow is 0
  const tradesByAccount = {};
  rawTrades.forEach(t => {
    if (!tradesByAccount[t.accountId]) tradesByAccount[t.accountId] = [];
    tradesByAccount[t.accountId].push(t);
  });

  const trades = [];
  Object.values(tradesByAccount).forEach(accTrades => {
    let netCash = 0;
    accTrades.forEach(t => {
      if (t.type === 'SELL') netCash += t.amount;
      if (t.type === 'BUY') netCash -= t.amount;
    });

    if (netCash !== 0 && accTrades.length > 0) {
      // Sort trades descending to absorb the difference in the largest trade
      accTrades.sort((a, b) => b.amount - a.amount);
      
      // Try to adjust a BUY trade first
      let buyTrade = accTrades.find(t => t.type === 'BUY');
      if (buyTrade && (buyTrade.amount + netCash > 0)) {
         buyTrade.amount += netCash;
         netCash = 0;
      }
      
      // If still unbalanced, adjust a SELL trade
      if (netCash !== 0) {
         let sellTrade = accTrades.find(t => t.type === 'SELL');
         if (sellTrade && (sellTrade.amount - netCash > 0)) {
            sellTrade.amount -= netCash;
            netCash = 0;
         }
      }
    }
    
    // Add trades that are still > 0 after adjustments
    accTrades.forEach(t => {
      if (t.amount > 0) trades.push(t);
    });
  });

  return {
    feasible: solution.feasible,
    trades,
    solution // debug info
  };
};
