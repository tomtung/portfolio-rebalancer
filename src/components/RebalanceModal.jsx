import React, { useState, useEffect, useMemo } from 'react';
import { X, BarChart3, RefreshCw, Play, ArrowRight, ArrowLeft, Check, AlertTriangle, TrendingUp, TrendingDown, Info, Lock, Unlock, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/currency';
import { calculateRebalancing } from '../utils/rebalancer';
import { getAssetClassRatios } from '../utils/calculations';
import { usePersistentObject } from '../hooks/usePersistentObject';

export default function RebalanceModal({
  isOpen,
  onClose,
  accounts,
  metadata,
  assetClassDetails,
  totalPortfolioValue,
  onApplyTrades
}) {
  const [step, setStep] = useState(1); // 1 = Targets, 2 = Preview
  const [targets, setTargets] = usePersistentObject('portfolio_targets_v2', {});
  const [enabledTargetsList, setEnabledTargetsList] = usePersistentObject('portfolio_enabled_targets_v2', []);
  const [locks, setLocks] = useState({});
  const [locksExpanded, setLocksExpanded] = useState(false);
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

  // Initialize targets when modal opens
  useEffect(() => {
    if (isOpen && Object.keys(assetClassDetails).length > 0) {
      if (Object.keys(targets).length === 0) {
        resetTargetsToCurrent();
      } else {
        // Merge in any new asset classes that appeared since last save
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
      setLocks({});
      setLocksExpanded(false);
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

  const toggleLock = (accountName, symbol, type) => {
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

  const sortedAssetClasses = useMemo(
    () => Object.keys(assetClassDetails).filter(c => c !== 'Unknown').sort(),
    [assetClassDetails]
  );

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
      setError("Could not find a feasible rebalancing solution. Please check your constraints.");
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
    setStep(2);
  };

  const handleApply = () => {
    if (result) {
      onApplyTrades(result.trades);
      onClose();
    }
  };

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

  if (!isOpen) return null;

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
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                {step === 1 ? 'Configure Rebalance' : 'Review Proposed Trades'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 1
                  ? 'Set target ranges and trade locks, then calculate optimal trades.'
                  : 'Review the solver\'s recommended trades before applying.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-4 text-xs flex-shrink-0">
          <div className={`flex items-center gap-1.5 font-bold uppercase tracking-wider ${step === 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            Configure
          </div>
          <ArrowRight className="w-3 h-3 text-gray-300" />
          <div className={`flex items-center gap-1.5 font-bold uppercase tracking-wider ${step === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            Review & Apply
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-6 space-y-4">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-sm text-blue-800">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                <div>
                  <p className="font-medium">How it works</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Set a <strong>Min</strong> and <strong>Max</strong> percentage for each asset class. The optimizer will calculate the minimum trades
                    needed to bring your portfolio within these bounds, while respecting account boundaries and any trade locks.
                  </p>
                </div>
              </div>

              {/* Targets table */}
              <div className="overflow-x-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asset Class Targets</span>
                  <button
                    onClick={resetTargetsToCurrent}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset to Current ±5%
                  </button>
                </div>

                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 text-left rounded-l-lg w-[30%]">Asset Class</th>
                      <th className="px-3 py-2.5 text-center w-[40%]">Range vs. Current</th>
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
                                type="number"
                                min="0"
                                max="100"
                                disabled={!isEnabled}
                                value={range.min}
                                onChange={(e) => handleTargetChange(cls, 'min', e.target.value)}
                                className="w-12 text-center bg-transparent focus:ring-0 border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700 font-mono text-sm disabled:text-gray-300 disabled:border-gray-200"
                              />
                              <span className="text-gray-300">–</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={!isEnabled}
                                value={range.max}
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

              {/* Trade Locks — collapsible */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setLocksExpanded(!locksExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md ${activeLockCount > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-700">Trade Locks</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {activeLockCount > 0
                          ? `${activeLockCount} active`
                          : 'None set'}
                      </span>
                    </div>
                  </div>
                  {locksExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                </button>

                {locksExpanded && (
                  <div className="border-t border-gray-200 max-h-[280px] overflow-y-auto">
                    <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                      <p className="text-[10px] text-gray-500">
                        Prevent the solver from buying or selling specific positions. Locks reset when you close this dialog.
                      </p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {accounts.map(account => (
                        <div key={account.name}>
                          <div className="px-4 py-2 bg-gray-50/30">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{account.name}</span>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {account.positions.map(pos => {
                              const accLocks = locks[account.name] || {};
                              const symLocks = accLocks[pos.Symbol] || {};
                              const isNoBuy = !!symLocks.noBuy;
                              const isNoSell = !!symLocks.noSell;
                              return (
                                <div key={pos.Symbol} className={`flex items-center justify-between px-4 py-2 ${isNoBuy || isNoSell ? 'bg-orange-50/30' : ''}`}>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">{pos.Symbol}</span>
                                    <span className="text-[10px] text-gray-400 ml-2">{formatCurrency(pos.SimulatedValue)}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => toggleLock(account.name, pos.Symbol, 'noBuy')}
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
                                      onClick={() => toggleLock(account.name, pos.Symbol, 'noSell')}
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
                      ))}
                    </div>
                    {activeLockCount > 0 && (
                      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/30">
                        <button
                          onClick={() => setLocks({})}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                        >
                          Clear All Locks
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && result && (
            <div className="p-6 space-y-5">
              {/* Slack warning */}
              {result.slacksUsed && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Partial fit</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Some target ranges could not be fully met due to account constraints or trade locks.
                      The solver found the closest feasible allocation.
                    </p>
                  </div>
                </div>
              )}

              {/* Allocation changes */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Allocation Changes</h3>
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

              {/* Trade list */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Proposed Trades ({result.trades.length})
                </h3>
                {result.trades.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    <p className="text-sm font-medium">Portfolio is already within target ranges.</p>
                    <p className="text-xs mt-1">No trades needed.</p>
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
                        <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          {accountId}
                        </div>
                        <div className="divide-y divide-gray-50">
                          {trades
                            .sort((a, b) => b.amount - a.amount)
                            .map((trade, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-1 rounded ${trade.type === 'BUY' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                  {trade.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                </div>
                                <div>
                                  <span className={`text-sm font-bold ${trade.type === 'BUY' ? 'text-green-700' : 'text-red-700'}`}>
                                    {trade.type}
                                  </span>
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
            {step === 2 && (
              <button
                onClick={() => { setStep(1); setResult(null); }}
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
                onClick={handleCalculate}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" /> Calculate Trades
              </button>
            )}
            {step === 2 && result && result.trades.length > 0 && (
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
