import React, { useState, useEffect, useMemo } from 'react';
import { X, BarChart3, RefreshCw, Play, ArrowRight, ArrowLeft, Check, AlertTriangle, TrendingUp, TrendingDown, Info, Lock, Unlock } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { calculateRebalancing } from '../utils/rebalancer';
import { getAssetClassRatios } from '../utils/calculations';
import { usePersistentObject } from '../hooks/usePersistentObject';

// Steps: 1 = Targets, 2 = Trade Locks, 3 = Review & Apply
export default function RebalanceModal({
  isOpen,
  onClose,
  accounts,
  metadata,
  assetClassDetails,
  totalPortfolioValue,
  onApplyTrades
}) {
  const [step, setStep] = useState(1);
  const [targets, setTargets] = usePersistentObject('portfolio_targets_v2', {});
  const [enabledTargetsList, setEnabledTargetsList] = usePersistentObject('portfolio_enabled_targets_v2', []);
  const [locks, setLocks] = usePersistentObject('portfolio_locks_v2', {});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Convert persisted array to Set for internal use
  const enabledTargets = useMemo(() => new Set(enabledTargetsList), [enabledTargetsList]);
  const setEnabledTargets = (updater) => {
    if (typeof updater === 'function') {
      setEnabledTargetsList(prev => {
        const currentSet = new Set(prev);
        const newSet = updater(currentSet);
        return Array.from(newSet);
      });
    } else {
      setEnabledTargetsList(Array.from(updater));
    }
  };

  // Initialize / merge targets when modal opens
  useEffect(() => {
    if (isOpen && Object.keys(assetClassDetails).length > 0) {
      if (Object.keys(targets).length === 0) {
        resetTargetsToCurrent();
      } else {
        const updated = { ...targets };
        let changed = false;
        Object.keys(assetClassDetails).forEach(cls => {
          if (cls === 'Unknown') return;
          if (!updated[cls]) {
            const currentPct = (assetClassDetails[cls].total / totalPortfolioValue) * 100;
            updated[cls] = {
              min: Math.max(0, Math.floor(currentPct - 5)),
              max: Math.min(100, Math.ceil(currentPct + 5))
            };
            changed = true;
          }
        });
        if (changed) setTargets(updated);
      }
    }
    if (isOpen) {
      setStep(1);
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const resetTargetsToCurrent = () => {
    const initialTargets = {};
    const initialEnabled = [];
    Object.keys(assetClassDetails).forEach(cls => {
      if (cls === 'Unknown') return;
      const currentPct = (assetClassDetails[cls].total / totalPortfolioValue) * 100;
      initialTargets[cls] = {
        min: Math.max(0, Math.floor(currentPct - 5)),
        max: Math.min(100, Math.ceil(currentPct + 5))
      };
      initialEnabled.push(cls);
    });
    setTargets(initialTargets);
    setEnabledTargetsList(initialEnabled);
  };

  // Check if current targets already equal current ±5% — if so, grey out the reset button
  const isAlreadyAtDefault = useMemo(() => {
    const classes = Object.keys(assetClassDetails).filter(c => c !== 'Unknown');
    if (classes.length === 0) return true;
    return classes.every(cls => {
      const currentPct = (assetClassDetails[cls].total / totalPortfolioValue) * 100;
      const expectedMin = Math.max(0, Math.floor(currentPct - 5));
      const expectedMax = Math.min(100, Math.ceil(currentPct + 5));
      const range = targets[cls];
      const isEnabled = enabledTargets.has(cls);
      return isEnabled && range && range.min === expectedMin && range.max === expectedMax;
    });
  }, [targets, enabledTargets, assetClassDetails, totalPortfolioValue]);

  const handleTargetChange = (cls, field, value) => {
    const num = parseFloat(value);
    setTargets(prev => ({
      ...prev,
      [cls]: { ...prev[cls], [field]: isNaN(num) ? 0 : num }
    }));
  };

  const toggleTargetEnabled = (cls) => {
    setEnabledTargets(prev => {
      const next = new Set(prev);
      if (next.has(cls)) {
        next.delete(cls);
      } else {
        next.add(cls);
        if (!targets[cls]) {
          setTargets(curr => ({ ...curr, [cls]: { min: 0, max: 100 } }));
        }
      }
      return next;
    });
  };

  // --- Lock helpers ---
  const toggleSymbolLock = (accountName, symbol, type) => {
    setLocks(prev => {
      const accLocks = prev[accountName] || {};
      const symLocks = accLocks[symbol] || {};
      const newSymLocks = { ...symLocks, [type]: !symLocks[type] };
      if (!newSymLocks.noBuy && !newSymLocks.noSell) {
        const { [symbol]: _, ...restAccLocks } = accLocks;
        if (Object.keys(restAccLocks).length === 0) {
          const { [accountName]: __, ...restLocks } = prev;
          return restLocks;
        }
        return { ...prev, [accountName]: restAccLocks };
      }
      return { ...prev, [accountName]: { ...accLocks, [symbol]: newSymLocks } };
    });
  };

  // Apply a lock type to ALL positions in an account at once
  const toggleAccountLock = (accountName, type) => {
    const account = accounts.find(a => a.name === accountName);
    if (!account) return;
    const accLocks = locks[accountName] || {};
    
    const nonCashPositions = account.positions.filter(pos => {
        const ratios = getAssetClassRatios(pos.Symbol, metadata);
        return !Object.keys(ratios).some(k => k.toLowerCase() === 'cash');
    });
    
    if (nonCashPositions.length === 0) return;
    
    // If all non-cash already locked, unlock all; otherwise lock all
    const allLocked = nonCashPositions.every(pos => accLocks[pos.Symbol]?.[type]);
    
    setLocks(prev => {
      const newAccLocks = { ...prev[accountName] };
      nonCashPositions.forEach(pos => {
        const symLocks = newAccLocks[pos.Symbol] || {};
        const newSymLocks = { ...symLocks, [type]: !allLocked };
        if (!newSymLocks.noBuy && !newSymLocks.noSell) {
          delete newAccLocks[pos.Symbol];
        } else {
          newAccLocks[pos.Symbol] = newSymLocks;
        }
      });
      if (Object.keys(newAccLocks).length === 0) {
        const { [accountName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [accountName]: newAccLocks };
    });
  };

  const activeLockCount = useMemo(() => {
    let count = 0;
    Object.values(locks).forEach(accLocks => {
      Object.values(accLocks).forEach(symLocks => {
        if (symLocks.noBuy) count++;
        if (symLocks.noSell) count++;
      });
    });
    return count;
  }, [locks]);

  const sortedAssetClasses = useMemo(
    () => Object.keys(assetClassDetails).filter(c => c !== 'Unknown').sort(),
    [assetClassDetails]
  );

  // --- Solver ---
  const handleCalculate = () => {
    const normalizedTargets = {};
    Object.entries(targets).forEach(([cls, range]) => {
      if (enabledTargets.has(cls)) {
        normalizedTargets[cls] = { min: range.min / 100, max: range.max / 100 };
      }
    });

    const rebalanceInputAccounts = accounts.map(acc => ({
      id: acc.name,
      positions: acc.positions
    }));

    const solverResult = calculateRebalancing(rebalanceInputAccounts, metadata, normalizedTargets, locks);

    if (!solverResult.feasible) {
      setError('Could not find a feasible rebalancing solution. Please check your constraints.');
      return;
    }

    const usedSlacks = Object.entries(solverResult.solution).filter(
      ([key, val]) => key.startsWith('slack_') && val > 0.01
    );

    setResult({
      trades: solverResult.trades,
      slacksUsed: usedSlacks.length > 0,
      normalizedTargets
    });
    setError(null);
    setStep(3);
  };

  const handleApply = () => {
    if (result) {
      onApplyTrades(result.trades);
      onClose();
    }
  };

  // --- Post-trade allocation preview ---
  const postTradeAllocations = useMemo(() => {
    if (!result) return {};
    const exposures = {};
    accounts.forEach(account => {
      account.positions.forEach(pos => {
        const ratios = getAssetClassRatios(pos.Symbol, metadata);
        Object.entries(ratios).forEach(([cls, ratio]) => {
          if (!exposures[cls]) exposures[cls] = { current: 0, postTrade: 0 };
          exposures[cls].current += pos.SimulatedValue * ratio;
          exposures[cls].postTrade += pos.SimulatedValue * ratio;
        });
      });
    });
    result.trades.forEach(trade => {
      const ratios = getAssetClassRatios(trade.symbol, metadata);
      Object.entries(ratios).forEach(([cls, ratio]) => {
        if (!exposures[cls]) exposures[cls] = { current: 0, postTrade: 0 };
        if (trade.type === 'BUY') {
          exposures[cls].postTrade += trade.amount * ratio;
        } else {
          exposures[cls].postTrade -= trade.amount * ratio;
        }
      });
    });
    return exposures;
  }, [result, accounts, metadata]);

  // --- Sub-components ---
  const AllocationVisual = ({ current, min, max }) => (
    <div className="relative h-5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
      <div
        className="absolute top-0 bottom-0 bg-blue-100/60 border-x border-blue-200"
        style={{ left: `${Math.max(0, min)}%`, width: `${Math.max(0, max - min)}%` }}
      />
      <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-40" style={{ left: `${min}%` }} />
      <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-40" style={{ left: `${max}%` }} />
      <div
        className={`absolute top-1 bottom-1 w-1.5 rounded-full shadow-sm transition-all duration-500 z-10 ${
          current < min || current > max ? 'bg-red-500 ring-2 ring-red-200' : 'bg-green-500 ring-2 ring-green-200'
        }`}
        style={{ left: `calc(${Math.min(100, Math.max(0, current))}% - 3px)` }}
      />
    </div>
  );

  const StepDot = ({ n, label }) => (
    <div className={`flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs ${step === n ? 'text-blue-600' : step > n ? 'text-gray-400' : 'text-gray-300'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
        step === n ? 'bg-blue-600 text-white' : step > n ? 'bg-gray-300 text-gray-500' : 'bg-gray-100 text-gray-300'
      }`}>
        {step > n ? <Check className="w-3 h-3" /> : n}
      </div>
      {label}
    </div>
  );

  if (!isOpen) return null;

  const stepTitles = {
    1: { title: 'Set Target Allocations', sub: 'Define desired allocation ranges for each asset class.' },
    2: { title: 'Trade Locks', sub: 'Optionally prevent the solver from buying or selling specific positions.' },
    3: { title: 'Review Proposed Trades', sub: "Review the solver's recommended trades before applying." },
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-200">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">{stepTitles[step].title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{stepTitles[step].sub}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-2.5 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3 text-xs flex-shrink-0">
          <StepDot n={1} label="Targets" />
          <ArrowRight className="w-3 h-3 text-gray-200 flex-shrink-0" />
          <StepDot n={2} label="Locks" />
          <ArrowRight className="w-3 h-3 text-gray-200 flex-shrink-0" />
          <StepDot n={3} label="Review & Apply" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Targets ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-sm text-blue-800">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                <p className="text-xs text-blue-600">
                  Set a <strong>Min</strong> and <strong>Max</strong> percentage for each asset class.
                  The optimizer will calculate the minimum trades needed to bring your portfolio within these bounds.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asset Class Targets</span>
                  <button
                    onClick={resetTargetsToCurrent}
                    disabled={isAlreadyAtDefault}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      isAlreadyAtDefault
                        ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                        : 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" /> Reset to Current ±5%
                  </button>
                </div>

                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 text-left rounded-l-lg w-[30%]">Asset Class</th>
                      <th className="px-3 py-2.5 text-center w-[40%]">Target Range vs. Current</th>
                      <th className="px-3 py-2.5 text-right rounded-r-lg w-[30%]">Min / Max %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedAssetClasses.map(cls => {
                      const currentVal = assetClassDetails[cls]?.total || 0;
                      const currentPct = totalPortfolioValue > 0 ? (currentVal / totalPortfolioValue) * 100 : 0;
                      const range = targets[cls] || { min: 0, max: 0 };
                      const isEnabled = enabledTargets.has(cls);
                      const isDrifting = isEnabled && (currentPct < range.min || currentPct > range.max);
                      return (
                        <tr key={cls} className={`transition-colors ${isEnabled ? 'bg-white hover:bg-gray-50/50' : 'bg-gray-50/30 opacity-50'}`}>
                          <td className="px-3 py-3 font-medium">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => toggleTargetEnabled(cls)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <div>
                                <span className={`text-sm ${isEnabled ? 'text-gray-900' : 'text-gray-400'}`}>{cls}</span>
                                {isEnabled && (
                                  <div className="text-[10px] text-gray-400 mt-0.5">
                                    Current: <span className={isDrifting ? 'text-red-500 font-bold' : 'text-gray-600'}>{currentPct.toFixed(1)}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {isEnabled ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-mono w-6 text-right">0</span>
                                <AllocationVisual current={currentPct} min={range.min} max={range.max} />
                                <span className="text-[10px] text-gray-400 font-mono w-8">100%</span>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic text-center">Unconstrained</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className={`flex items-center justify-end gap-1.5 p-1 rounded-lg border transition-colors ${isEnabled ? 'bg-gray-50 border-gray-100' : 'bg-transparent border-transparent'}`}>
                              <input
                                type="number" min="0" max="100" disabled={!isEnabled} value={range.min}
                                onChange={(e) => handleTargetChange(cls, 'min', e.target.value)}
                                className="w-12 text-center bg-transparent focus:ring-0 border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700 font-mono text-sm disabled:text-gray-300 disabled:border-gray-200"
                              />
                              <span className="text-gray-300">–</span>
                              <input
                                type="number" min="0" max="100" disabled={!isEnabled} value={range.max}
                                onChange={(e) => handleTargetChange(cls, 'max', e.target.value)}
                                className="w-12 text-center bg-transparent focus:ring-0 border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700 font-mono text-sm disabled:text-gray-300 disabled:border-gray-200"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 2: Trade Locks ── */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-orange-50/50 rounded-lg border border-orange-100 text-sm text-orange-800">
                <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
                <p className="text-xs text-orange-700">
                  Prevent the solver from buying or selling specific positions or entire accounts.
                  Leave everything unlocked to give the optimizer maximum flexibility.
                </p>
              </div>

              <div className="space-y-3">
                {accounts.map(account => {
                  const accLocks = locks[account.name] || {};
                  
                  const nonCashPositions = account.positions.filter(pos => {
                      const ratios = getAssetClassRatios(pos.Symbol, metadata);
                      return !Object.keys(ratios).some(k => k.toLowerCase() === 'cash');
                  });

                  if (nonCashPositions.length === 0) return null;

                  const allNoBuy = nonCashPositions.every(p => accLocks[p.Symbol]?.noBuy);
                  const allNoSell = nonCashPositions.every(p => accLocks[p.Symbol]?.noSell);
                  const anyLocked = nonCashPositions.some(p => accLocks[p.Symbol]?.noBuy || accLocks[p.Symbol]?.noSell);

                  return (
                    <div key={account.name} className={`rounded-xl border overflow-hidden transition-colors ${anyLocked ? 'border-orange-200 bg-orange-50/20' : 'border-gray-200'}`}>
                      {/* Account header row with bulk toggles */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <span className="text-sm font-bold text-gray-700">{account.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mr-1">All:</span>
                          <button
                            onClick={() => toggleAccountLock(account.name, 'noBuy')}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                              allNoBuy
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-600'
                            }`}
                          >
                            {allNoBuy ? <Lock className="w-3 h-3 inline mr-0.5" /> : <Unlock className="w-3 h-3 inline mr-0.5" />}
                            No Buy
                          </button>
                          <button
                            onClick={() => toggleAccountLock(account.name, 'noSell')}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                              allNoSell
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-600'
                            }`}
                          >
                            {allNoSell ? <Lock className="w-3 h-3 inline mr-0.5" /> : <Unlock className="w-3 h-3 inline mr-0.5" />}
                            No Sell
                          </button>
                        </div>
                      </div>

                      {/* Per-position rows */}
                      <div className="divide-y divide-gray-50">
                        {nonCashPositions.map(pos => {
                          const symLocks = accLocks[pos.Symbol] || {};
                          const isNoBuy = !!symLocks.noBuy;
                          const isNoSell = !!symLocks.noSell;

                          return (
                            <div key={pos.Symbol} className={`flex items-center justify-between px-4 py-2.5 ${isNoBuy || isNoSell ? 'bg-orange-50/40' : 'hover:bg-gray-50/50'} transition-colors`}>
                              <div>
                                <span className="text-sm font-medium text-gray-800">{pos.Symbol}</span>
                                <span className="text-[10px] text-gray-400 ml-2 tabular-nums">{formatCurrency(pos.SimulatedValue)}</span>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => toggleSymbolLock(account.name, pos.Symbol, 'noBuy')}
                                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                                    isNoBuy
                                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                      : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-600'
                                  }`}
                                >
                                  {isNoBuy ? <Lock className="w-3 h-3 inline mr-0.5" /> : <Unlock className="w-3 h-3 inline mr-0.5" />}
                                  Buy
                                </button>
                                <button
                                  onClick={() => toggleSymbolLock(account.name, pos.Symbol, 'noSell')}
                                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                                    isNoSell
                                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                      : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-600'
                                  }`}
                                >
                                  {isNoSell ? <Lock className="w-3 h-3 inline mr-0.5" /> : <Unlock className="w-3 h-3 inline mr-0.5" />}
                                  Sell
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeLockCount > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-orange-600 font-medium">{activeLockCount} lock{activeLockCount !== 1 ? 's' : ''} active</span>
                  <button
                    onClick={() => setLocks({})}
                    className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                  >
                    Clear All Locks
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Review & Apply ── */}
          {step === 3 && result && (
            <div className="p-6 space-y-5">

              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Allocation Changes</h3>

                {result.trades.length === 0 && !result.slacksUsed && (
                  <div className="mb-4 text-center py-6 bg-green-50/50 rounded-xl border border-green-100">
                    <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-bold text-green-800">Portfolio is already within target ranges.</p>
                    <p className="text-xs mt-1 text-green-600">No allocation changes or trades needed.</p>
                  </div>
                )}

                {result.slacksUsed && (
                  <div className="mb-4 text-center py-6 bg-amber-50/50 rounded-xl border border-amber-100">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p className="text-sm font-bold text-amber-800">Partial Fit: Targets Not Fully Met</p>
                    <p className="text-xs mt-1 text-amber-700 max-w-md mx-auto">
                      The optimizer found the closest possible allocation, but couldn't perfectly hit all your target ranges. This happens when the target ranges contradict each other, or when account boundaries (inability to move money between accounts) and trade locks restrict available trades.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {Object.entries(postTradeAllocations)
                    .filter(([cls]) => cls !== 'Unknown')
                    .sort(([, a], [, b]) => b.current - a.current)
                    .map(([cls, vals]) => {
                      const currentPct = totalPortfolioValue > 0 ? (vals.current / totalPortfolioValue) * 100 : 0;
                      const postPct = totalPortfolioValue > 0 ? (vals.postTrade / totalPortfolioValue) * 100 : 0;
                      const delta = postPct - currentPct;
                      if (Math.abs(delta) < 0.01) return null;
                      return (
                        <div key={cls} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                          <span className="text-sm font-medium text-gray-700">{cls}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400 tabular-nums">{currentPct.toFixed(1)}%</span>
                            <ArrowRight className="w-3 h-3 text-gray-300" />
                            <span className="text-sm font-bold text-gray-800 tabular-nums">{postPct.toFixed(1)}%</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${delta > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean)}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Proposed Trades ({result.trades.length})
                </h3>
                {result.trades.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm font-medium">No trades proposed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      result.trades.reduce((acc, trade) => {
                        if (!acc[trade.accountId]) acc[trade.accountId] = [];
                        acc[trade.accountId].push(trade);
                        return acc;
                      }, {})
                    ).map(([accountId, trades]) => (
                      <div key={accountId} className="rounded-lg border border-gray-100 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">{accountId}</div>
                        <div className="divide-y divide-gray-50">
                          {trades.sort((a, b) => b.amount - a.amount).map((trade, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-1 rounded ${trade.type === 'BUY' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                  {trade.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                </div>
                                <div>
                                  <span className={`text-sm font-bold ${trade.type === 'BUY' ? 'text-green-700' : 'text-red-700'}`}>{trade.type}</span>
                                  <span className="text-sm text-gray-800 ml-2 font-medium">{trade.symbol}</span>
                                </div>
                              </div>
                              <span className={`text-sm font-bold tabular-nums ${trade.type === 'BUY' ? 'text-green-700' : 'text-red-700'}`}>
                                {trade.type === 'BUY' ? '+' : '−'}{formatCurrency(trade.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
          <div>
            {step > 1 && (
              <button
                onClick={() => { setStep(s => s - 1); setResult(null); setError(null); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95"
              >
                Next: Trade Locks <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleCalculate}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" /> Calculate Trades
              </button>
            )}
            {step === 3 && result && result.trades.length > 0 && (
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-md shadow-green-200 transition-all active:scale-95"
              >
                <Check className="w-4 h-4" /> Apply Trades
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
