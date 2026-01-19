import { describe, it, expect } from 'vitest';
import { calculateRebalancing } from './rebalancer';

describe('calculateRebalancing', () => {
  const metadata = {
    "VTI": { assetClass: { "US Equity": 1.0 } },
    "VXUS": { assetClass: { "Intl Equity": 1.0 } },
    "BND": { assetClass: { "Bonds": 1.0 } },
    "USD": { assetClass: { "Cash": 1.0 } }
  };

  it('should rebalance a simple portfolio to target ranges', () => {
    // Portfolio: $1000 VTI (100% US Equity)
    // Target: 50% US Equity, 50% Bonds
    // Account has VTI and BND (0 value) positions available to trade.
    // Wait, the logic only allows trading existing positions. 
    // If I want to buy BND, it must exist in the positions list.
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: 1000 },
        { Symbol: "BND", SimulatedValue: 0 }
      ]
    }];

    // Target: US Equity 40-60%, Bonds 40-60%.
    // Current: US 100%, Bonds 0%.
    // Should sell ~500 VTI, buy ~500 BND.
    const targets = {
      "US Equity": { min: 0.4, max: 0.6 },
      "Bonds": { min: 0.4, max: 0.6 }
    };

    const result = calculateRebalancing(accounts, metadata, targets);

    expect(result.feasible).toBe(true);
    
    const sellVTI = result.trades.find(t => t.type === 'SELL' && t.symbol === 'VTI');
    const buyBND = result.trades.find(t => t.type === 'BUY' && t.symbol === 'BND');

    expect(sellVTI).toBeDefined();
    expect(buyBND).toBeDefined();
    
    // Should be around 400-600. Since we minimize turnover, it should likely hit the bound closest to current.
    // Current 1000. Target Max 600. So sell at least 400.
    // Bond Min 400. So buy at least 400.
    // Optimization: Minimize turnover. So we should do exactly 400 if possible.
    // Sell 400 VTI -> 600 VTI left (60%).
    // Buy 400 BND -> 400 BND (40%).
    
    expect(sellVTI.amount).toBeCloseTo(400, 0);
    expect(buyBND.amount).toBeCloseTo(400, 0);
  });

  it('should handle multi-account silo constraints', () => {
    // Acc1: VTI $1000 (Taxable)
    // Acc2: BND $1000 (IRA)
    // Target: 50/50 is satisfied.
    // Change Target: 100% US Equity.
    // Should sell BND in Acc2. But Acc2 cannot buy VTI if VTI is not in Acc2.
    // Let's add VTI to Acc2 (value 0).
    // And Acc1 cannot buy BND if BND is not in Acc1.
    
    const accounts = [
      {
        id: "acc1",
        positions: [{ Symbol: "VTI", SimulatedValue: 1000 }]
      },
      {
        id: "acc2",
        positions: [
          { Symbol: "BND", SimulatedValue: 1000 },
          { Symbol: "VTI", SimulatedValue: 0 }
        ]
      }
    ];

    const targets = {
      "US Equity": { min: 0.9, max: 1.0 }, // Want ~100% US
      "Bonds": { min: 0.0, max: 0.1 }
    };

    const result = calculateRebalancing(accounts, metadata, targets);
    
    // Acc1: Has VTI. Good.
    // Acc2: Has BND. Needs to sell BND and buy VTI.
    
    const sellBND = result.trades.find(t => t.type === 'SELL' && t.accountId === 'acc2' && t.symbol === 'BND');
    const buyVTI = result.trades.find(t => t.type === 'BUY' && t.accountId === 'acc2' && t.symbol === 'VTI');
    
    // Acc1 should do nothing.
    const tradesAcc1 = result.trades.filter(t => t.accountId === 'acc1');
    
    expect(tradesAcc1.length).toBe(0);
    expect(sellBND).toBeDefined();
    expect(buyVTI).toBeDefined();
    
    // Should sell enough to reach 90% total. 
    // Total Wealth = 2000. 90% = 1800.
    // Currently have 1000 VTI. Need +800 VTI.
    // So sell 800 BND in Acc2, Buy 800 VTI in Acc2.
    expect(sellBND.amount).toBeCloseTo(800, -1); // -1 precision = within 10
  });
  
  it('should respect inventory constraints (cannot sell more than owned)', () => {
    // Acc1: VTI $100
    // Target: 0% US Equity.
    // Should sell max $100.
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: 100 },
        { Symbol: "USD", SimulatedValue: 0 }
      ]
    }];
    
    const targets = {
      "US Equity": { min: 0, max: 0 },
      "Cash": { min: 0.9, max: 1.0 } // Arbitrary high cash
    };
    
    const result = calculateRebalancing(accounts, metadata, targets);
    const sellVTI = result.trades.find(t => t.type === 'SELL' && t.symbol === 'VTI');
    
    expect(sellVTI.amount).toBeLessThanOrEqual(100.01);
    expect(sellVTI.amount).toBeCloseTo(100, 1);
  });

  it('should respect noSell and noBuy locks', () => {
    // Acc1: VTI $1000. Target: 0% US Equity.
    // BUT VTI is noSell: true.
    // Result: should NOT sell VTI despite the target.
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: 1000 },
        { Symbol: "USD", SimulatedValue: 0 }
      ]
    }];
    
    const targets = {
      "US Equity": { min: 0, max: 0 },
      "Cash": { min: 1.0, max: 1.0 }
    };
    
    const locks = {
      "acc1": {
        "VTI": { noSell: true }
      }
    };
    
    const result = calculateRebalancing(accounts, metadata, targets, locks);
    const sellVTI = result.trades.find(t => t.type === 'SELL' && t.symbol === 'VTI');
    
    expect(sellVTI).toBeUndefined();
    
    // Now test noBuy
    // Current: $1000 USD. Target: 100% VTI.
    // BUT VTI is noBuy: true.
    const accounts2 = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: 0 },
        { Symbol: "USD", SimulatedValue: 1000 }
      ]
    }];
    
    const targets2 = {
      "US Equity": { min: 1.0, max: 1.0 }
    };
    
    const locks2 = {
      "acc1": {
        "VTI": { noBuy: true }
      }
    };
    
    const result2 = calculateRebalancing(accounts2, metadata, targets2, locks2);
    const buyVTI = result2.trades.find(t => t.type === 'BUY' && t.symbol === 'VTI');
    
    expect(buyVTI).toBeUndefined();
  });

  it('should handle split-allocation (look-through) assets', () => {
    // Portfolio: $1000 Cash
    // Available: VT (60% US, 40% Intl), VTI (100% US), VXUS (100% Intl)
    // Target: Exact 60/40 split.
    // If we only allow VT and Cash, it should buy VT.
    
    const splitMetadata = {
      "VT": { assetClass: { "US Equity": 0.6, "Intl Equity": 0.4 } },
      "VTI": { assetClass: { "US Equity": 1.0 } },
      "USD": { assetClass: { "Cash": 1.0 } }
    };

    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "USD", SimulatedValue: 1000 },
        { Symbol: "VT", SimulatedValue: 0 }
      ]
    }];

    const targets = {
      "US Equity": { min: 0.58, max: 0.62 },   // Target ~60%
      "Intl Equity": { min: 0.38, max: 0.42 }, // Target ~40%
      "Cash": { min: 0.0, max: 0.0 }           // Target 0% - Force full investment
    };

    const result = calculateRebalancing(accounts, splitMetadata, targets);
    
    expect(result.feasible).toBe(true);
    
    // It should buy 1000 VT because Cash Max is 0, so it must sell all USD.
    // Previous failure bought 980 because it satisfied Min constraints and minimized turnover.
    const buyVT = result.trades.find(t => t.type === 'BUY' && t.symbol === 'VT');
    expect(buyVT).toBeDefined();
    expect(buyVT.amount).toBeCloseTo(1000, -1);
  });

  it('should handle infeasible targets gracefully (elastic constraints)', () => {
    // Portfolio: $1000 VTI
    // Target: 200% Bonds (Impossible).
    // Should sell all VTI and buy as much BND as possible (100%).
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: 1000 },
        { Symbol: "BND", SimulatedValue: 0 }
      ]
    }];

    const targets = {
      "Bonds": { min: 2.0, max: 2.0 } // 200%
    };

    const result = calculateRebalancing(accounts, metadata, targets);

    expect(result.feasible).toBe(true); // Should still be "feasible" in LP terms due to slack vars
    
    const buyBND = result.trades.find(t => t.type === 'BUY' && t.symbol === 'BND');
    
    // It should have bought max possible (1000).
    expect(buyBND).toBeDefined();
    expect(buyBND.amount).toBeCloseTo(1000, -1);
  });

  it('should do nothing if portfolio is already within ranges', () => {
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: 500 },
        { Symbol: "BND", SimulatedValue: 500 }
      ]
    }];

    const targets = {
      "US Equity": { min: 0.4, max: 0.6 },
      "Bonds": { min: 0.4, max: 0.6 }
    };

    const result = calculateRebalancing(accounts, metadata, targets);
    
    expect(result.trades.length).toBe(0);
  });

  it('should prioritize lower turnover when multiple solutions exist', () => {
    // Portfolio: $1000 Cash.
    // Target: US Equity 40-60%.
    // Can buy VTI.
    // Acceptable range: Buy $400 to $600.
    // To minimize turnover, it should buy exactly $400 (the minimum required change).
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "USD", SimulatedValue: 1000 },
        { Symbol: "VTI", SimulatedValue: 0 }
      ]
    }];
    
    const targets = {
      "US Equity": { min: 0.4, max: 0.6 },
      "Cash": { min: 0.0, max: 1.0 }
    };
    
    const result = calculateRebalancing(accounts, metadata, targets);
    const buyVTI = result.trades.find(t => t.type === 'BUY' && t.symbol === 'VTI');
    
    expect(buyVTI.amount).toBeCloseTo(400, -1);
  });

  it('should choose a substitute asset if the primary is locked (Best Fit)', () => {
    // Target: Maximize US Equity (Min 100%).
    // Available: VTI (100% US) - LOCKED (NoBuy).
    // Available: VT (60% US, 40% Intl) - Available.
    // Portfolio: $1000 Cash.
    // Should buy VT because getting 60% US is better than 0%, even if it brings Intl exposure.
    // Assuming Intl limit isn't strict 0 constraint, or if it is, the slack cost tradeoff favors getting closer to US target.
    
    const splitMetadata = {
      "VT": { assetClass: { "US Equity": 0.6, "Intl Equity": 0.4 } },
      "VTI": { assetClass: { "US Equity": 1.0 } },
      "USD": { assetClass: { "Cash": 1.0 } }
    };

    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "USD", SimulatedValue: 1000 },
        { Symbol: "VTI", SimulatedValue: 0 },
        { Symbol: "VT", SimulatedValue: 0 }
      ]
    }];

    const targets = {
      "US Equity": { min: 1.0, max: 1.0 },
      "Cash": { min: 0.0, max: 0.0 }
    };

    const locks = {
      "acc1": { "VTI": { noBuy: true } }
    };

    const result = calculateRebalancing(accounts, splitMetadata, targets, locks);
    
    const buyVT = result.trades.find(t => t.type === 'BUY' && t.symbol === 'VT');
    
    expect(buyVT).toBeDefined();
    expect(buyVT.amount).toBeCloseTo(1000, -1);
  });

  it('should handle conflicting targets (User Error: Min > Max)', () => {
    // Target: US Equity Min 60%, Max 40%.
    // Portfolio: $1000 Cash.
    // Solver should likely settle around 50% or hit one of the bounds depending on slack implementation.
    // Actually, since slacks have equal cost, any point between 40% and 60% has constant total error?
    // Error at 40%: (40-60 Min) = 20 deficit. (40-40 Max) = 0 surplus. Total 20.
    // Error at 50%: (50-60 Min) = 10 deficit. (50-40 Max) = 10 surplus. Total 20.
    // Error at 60%: (60-60 Min) = 0 deficit. (60-40 Max) = 20 surplus. Total 20.
    // So mathematically, any value 40-60% is "optimal" for the slack terms.
    // The tie-breaker is Turnover Cost. 
    // To minimize turnover, it should buy the *least amount possible* to enter this "optimal error zone".
    // 40% requires buying $400. 60% requires buying $600.
    // So it should choose 40%.
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "USD", SimulatedValue: 1000 },
        { Symbol: "VTI", SimulatedValue: 0 }
      ]
    }];
    
    const targets = {
      "US Equity": { min: 0.6, max: 0.4 }, // Conflict!
      "Cash": { min: 0.0, max: 1.0 }
    };
    
    const result = calculateRebalancing(accounts, metadata, targets);
    
    // Expect it to buy ~400 VTI (reaching the 40% Max bound).
    const buyVTI = result.trades.find(t => t.type === 'BUY' && t.symbol === 'VTI');
    
    expect(buyVTI).toBeDefined();
    expect(buyVTI.amount).toBeCloseTo(400, -1);
  });

  it('should handle missing metadata gracefully (Unknown class)', () => {
    // Portfolio has "UNKNOWN_COIN".
    // Metadata has no entry for it.
    // Should function without crashing.
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "UNKNOWN_COIN", SimulatedValue: 1000 },
        { Symbol: "USD", SimulatedValue: 0 } // Needed to allow selling into cash
      ]
    }];
    
    const targets = {
      "Unknown": { min: 0.0, max: 0.0 } // Try to sell it?
    };
    
    // Assuming calculations.js defaults to "Unknown": 1.0
    const result = calculateRebalancing(accounts, metadata, targets);
    
    expect(result.feasible).toBe(true);
    // Should sell UNKNOWN_COIN if target is 0.
    // Note: LP solver treats unknown vars as having 0 contribution to defined constraints, 
    // but here we specifically target "Unknown" class.
    
    const sell = result.trades.find(t => t.type === 'SELL' && t.symbol === 'UNKNOWN_COIN');
    expect(sell).toBeDefined();
    expect(sell.amount).toBeCloseTo(1000, -1);
  });

  it('should handle short positions (negative inventory) by allowing covering but not selling more', () => {
    // Portfolio: Short $1000 VTI (-1000). Cash $2000. Net $1000.
    // Target US Equity: 0% (Cover the short).
    // Should Buy $1000 VTI.
    
    // Note: Current logic sets `inv` max constraint to SimulatedValue.
    // If SimulatedValue is -1000, constraint is `sell <= -1000`.
    // Since sell >= 0, this is impossible (0 <= -1000 is false).
    // This test expects the code to handle this gracefully (likely by clamping max sell to 0).
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: -1000 },
        { Symbol: "USD", SimulatedValue: 2000 }
      ]
    }];
    
    const targets = {
      "US Equity": { min: 0.0, max: 0.0 },
      "Cash": { min: 1.0, max: 1.0 }
    };
    
    const result = calculateRebalancing(accounts, metadata, targets);
    
    expect(result.feasible).toBe(true);
    
    // Should buy 1000 VTI to close position
    const buyVTI = result.trades.find(t => t.type === 'BUY' && t.symbol === 'VTI');
    expect(buyVTI).toBeDefined();
    expect(buyVTI.amount).toBeCloseTo(1000, -1);
  });

  it('should handle empty inputs gracefully', () => {
    const result = calculateRebalancing([], {}, {});
    expect(result.feasible).toBe(true);
    expect(result.trades.length).toBe(0);
  });

  it('should ignore asset classes that are not in targetRanges', () => {
    // Portfolio: $500 US Equity (VTI), $500 Intl Equity (VXUS)
    // Target: US Equity Min 60%, Max 60%.
    // Intl Equity is NOT in targetRanges.
    // Result: Should sell $100 VXUS and buy $100 VTI to reach 60% US Equity.
    // It shouldn't care that Intl Equity drops to 40%.
    
    const accounts = [{
      id: "acc1",
      positions: [
        { Symbol: "VTI", SimulatedValue: 500 },
        { Symbol: "VXUS", SimulatedValue: 500 }
      ]
    }];
    
    const targets = {
      "US Equity": { min: 0.6, max: 0.6 }
    };
    
    const result = calculateRebalancing(accounts, metadata, targets);
    
    expect(result.feasible).toBe(true);
    
    const sellVXUS = result.trades.find(t => t.type === 'SELL' && t.symbol === 'VXUS');
    const buyVTI = result.trades.find(t => t.type === 'BUY' && t.symbol === 'VTI');
    
    expect(sellVXUS).toBeDefined();
    expect(buyVTI).toBeDefined();
    expect(sellVXUS.amount).toBeCloseTo(100, -1);
    expect(buyVTI.amount).toBeCloseTo(100, -1);
  });
});
