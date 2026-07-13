import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Play, Lock, Unlock, AlertTriangle, CheckCircle2, RefreshCw, BarChart3, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

export default function AutoRebalanceManager({ 
  accounts, 
  metadata, 
  assetClassDetails, 
  totalPortfolioValue,
  onApplyRebalance 
}) {
  // State for Target Ranges: { "AssetClass": { min: 0-100, max: 0-100 } }
  const [targets, setTargets] = useState({});
  
  // State for Locks: { accountId: { symbol: { noBuy: boolean, noSell: boolean } } }
  const [locks, setLocks] = useState({});

  // Initialize targets logic
  const resetTargetsToCurrent = () => {
    const initialTargets = {};
    Object.keys(assetClassDetails).forEach(cls => {
      if (cls === 'Unknown') return;
      const currentPct = (assetClassDetails[cls].total / totalPortfolioValue) * 100;
      initialTargets[cls] = {
        min: Math.max(0, Math.floor(currentPct - 5)),
        max: Math.min(100, Math.ceil(currentPct + 5))
      };
    });
    setTargets(initialTargets);
  };

  // Initial load
  useEffect(() => {
    if (Object.keys(targets).length === 0 && Object.keys(assetClassDetails).length > 0) {
      resetTargetsToCurrent();
    }
  }, [assetClassDetails, totalPortfolioValue]);

  const handleTargetChange = (cls, field, value) => {
    const num = parseFloat(value);
    setTargets(prev => ({
      ...prev,
      [cls]: { ...prev[cls], [field]: isNaN(num) ? 0 : num }
    }));
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

  const handleRun = () => {
    const normalizedTargets = {};
    Object.entries(targets).forEach(([cls, range]) => {
      normalizedTargets[cls] = { min: range.min / 100, max: range.max / 100 };
    });
    onApplyRebalance(normalizedTargets, locks);
  };

  const sortedAssetClasses = useMemo(() => Object.keys(assetClassDetails).sort(), [assetClassDetails]);

  // --- Visual Component for Range ---
  const AllocationVisual = ({ current, min, max }) => {
    // Scale 0-100% mapped to 0-100% width
    return (
      <div className="relative h-6 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
        {/* Target Range Zone */}
        <div 
          className="absolute top-0 bottom-0 bg-blue-100/50 border-x border-blue-200"
          style={{ left: `${Math.max(0, min)}%`, width: `${Math.max(0, max - min)}%` }}
        />
        {/* Min Marker Line */}
        <div className="absolute top-0 bottom-0 w-px bg-blue-400 border-l border-dashed border-blue-400 opacity-50" style={{ left: `${min}%` }} />
        {/* Max Marker Line */}
        <div className="absolute top-0 bottom-0 w-px bg-blue-400 border-l border-dashed border-blue-400 opacity-50" style={{ left: `${max}%` }} />
        
        {/* Current Value Marker */}
        <div 
          className={`absolute top-1 bottom-1 w-1.5 rounded-full shadow-sm transition-all duration-500 z-10 ${
            current < min || current > max ? 'bg-red-500 ring-2 ring-red-200' : 'bg-green-500 ring-2 ring-green-200'
          }`}
          style={{ left: `calc(${current}% - 3px)` }}
        />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT COLUMN: Targets (2/3 width on large screens) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Target Allocations</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Define optimal drift ranges</p>
              </div>
            </div>
            <button 
                onClick={resetTargetsToCurrent}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
                <RefreshCw className="w-3 h-3" /> Reset to Current
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left rounded-l-lg w-1/4">Asset Class</th>
                  <th className="px-4 py-3 text-center w-1/2">Allocation Range vs Current</th>
                  <th className="px-4 py-3 text-right rounded-r-lg w-1/4">Min / Max %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedAssetClasses.map(cls => {
                  if (cls === 'Unknown') return null;
                  const currentVal = assetClassDetails[cls].total;
                  const currentPct = (currentVal / totalPortfolioValue) * 100;
                  const range = targets[cls] || { min: 0, max: 0 };
                  const isDrifting = currentPct < range.min || currentPct > range.max;

                  return (
                    <tr key={cls} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-4 py-4 font-medium text-gray-800">
                        {cls}
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                            Current: <span className={isDrifting ? 'text-red-500 font-bold' : 'text-gray-600'}>{currentPct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] text-gray-400 font-mono w-8 text-right">0%</span>
                            <AllocationVisual current={currentPct} min={range.min} max={range.max} />
                            <span className="text-[10px] text-gray-400 font-mono w-8">100%</span>
                         </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100 group-hover:border-blue-200 transition-colors">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={range.min}
                            onChange={(e) => handleTargetChange(cls, 'min', e.target.value)}
                            className="w-12 text-center bg-transparent focus:ring-0 border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700 font-mono text-sm"
                            placeholder="Min"
                          />
                          <span className="text-gray-300">-</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={range.max}
                            onChange={(e) => handleTargetChange(cls, 'max', e.target.value)}
                            className="w-12 text-center bg-transparent focus:ring-0 border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700 font-mono text-sm"
                            placeholder="Max"
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
      </div>

      {/* RIGHT COLUMN: Constraints & Actions (1/3 width) */}
      <div className="space-y-6">
        
        {/* Constraints Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[600px]">
           <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
              <div className="p-1.5 bg-orange-100 rounded text-orange-600">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-sm">Trade Locks</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Prevent Buy/Sell per Symbol</p>
              </div>
              {Object.keys(locks).length > 0 && (
                  <button onClick={() => setLocks({})} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear All</button>
              )}
           </div>
           
           <div className="overflow-y-auto p-2 space-y-4">
              {accounts.map(account => (
                <div key={account.name} className="space-y-1">
                  <div className="px-2 py-1 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{account.name}</span>
                  </div>
                  <div className="space-y-1">
                    {account.positions.map(pos => {
                      const sym = pos.Symbol;
                      const accLocks = locks[account.name] || {};
                      const symLocks = accLocks[sym] || {};
                      const isNoBuy = !!symLocks.noBuy;
                      const isNoSell = !!symLocks.noSell;
                      
                      // Only show items with value or locks, to save space? No, show all.
                      return (
                        <div key={sym} className={`group flex items-center justify-between p-2 rounded-lg border transition-all ${isNoBuy || isNoSell ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                           <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-700">{sym}</span>
                              <span className="text-[10px] text-gray-400">{formatCurrency(pos.SimulatedValue)}</span>
                           </div>
                           <div className="flex gap-1">
                              <button
                                onClick={() => toggleLock(account.name, sym, 'noBuy')}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                                    isNoBuy 
                                    ? 'bg-red-100 text-red-700 border-red-200' 
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {isNoBuy ? 'No Buy' : 'Buy'}
                              </button>
                              <button
                                onClick={() => toggleLock(account.name, sym, 'noSell')}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                                    isNoSell 
                                    ? 'bg-red-100 text-red-700 border-red-200' 
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {isNoSell ? 'No Sell' : 'Sell'}
                              </button>
                           </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Action Panel */}
        <div className="bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 p-6 text-white flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-white/10 rounded-full">
                <Settings className="w-8 h-8 text-blue-100" />
            </div>
            <div>
                <h3 className="text-lg font-bold">Ready to Rebalance?</h3>
                <p className="text-blue-100 text-sm mt-1">Calculates optimal trades to align with your target ranges while respecting locks.</p>
            </div>
            <button
                onClick={handleRun}
                className="w-full py-3 bg-white text-blue-600 hover:bg-blue-50 font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                <Play className="w-5 h-5 fill-current" />
                Calculate & Apply
            </button>
        </div>

      </div>

    </div>
  );
}