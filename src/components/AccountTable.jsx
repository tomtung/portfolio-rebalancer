import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Trash2, RefreshCw, Lock, Unlock, X } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/currency';
import { calculateAssetClassStats } from '../utils/calculations';
import AllocationBar from './AllocationBar';

const AccountTable = ({ name, positions, totalValue, originalTotalValue, totalAdjustment, portfolioTotal, onAdjustmentChange, onRemovePosition, onResetAccount, metadata, colors, locks = {}, onToggleLock }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'SimulatedValue', direction: 'desc' });
  const [flashErrors, setFlashErrors] = useState({});
  const [editingAdjustment, setEditingAdjustment] = useState(null); // symbol being edited
  const percentOfPortfolio = portfolioTotal > 0 ? (totalValue / portfolioTotal) * 100 : 0;
  const accountStats = useMemo(() => calculateAssetClassStats(positions, metadata), [positions, metadata]);

  const handleLocalAdjustment = (symbol, value, originalValue) => {
      const num = parseFloat(value);
      if (!isNaN(num) && originalValue + num < 0) {
          setFlashErrors(prev => ({ ...prev, [symbol]: true }));
          setTimeout(() => {
              setFlashErrors(prev => ({ ...prev, [symbol]: false }));
          }, 800);
          onAdjustmentChange(name, symbol, -originalValue);
      } else {
          onAdjustmentChange(name, symbol, value);
      }
  };

  const sortedPositions = useMemo(() => {
    let sortableItems = [...positions];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'Asset Class') {
           const meta = metadata[a.Symbol];
           const aVal = (meta && typeof meta === 'object' && meta.assetClass !== undefined) ? meta.assetClass : meta;
           aValue = typeof aVal === 'object' ? 'Split' : (aVal || 'Unknown');
           
           const metaB = metadata[b.Symbol];
           const bVal = (metaB && typeof metaB === 'object' && metaB.assetClass !== undefined) ? metaB.assetClass : metaB;
           bValue = typeof bVal === 'object' ? 'Split' : (bVal || 'Unknown');
        } else {
           aValue = a[sortConfig.key];
           bValue = b[sortConfig.key];
        }
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [positions, sortConfig, metadata]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const HeaderCell = ({ label, sortKey, align = "left", className = "" }) => (
    <th 
      className={`py-4 px-4 text-${align} text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer group hover:bg-gray-50 transition-colors ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label}
        <span className="inline-flex">
          {sortConfig.key === sortKey ? (
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-200 opacity-0 group-hover:opacity-100" />
          )}
        </span>
      </div>
    </th>
  );

  return (
    <div className="mb-12 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-500">
      <div className="bg-slate-50/50 px-8 py-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{name}</h2>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{positions.length} Positions</span>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalValue)}</div>
          {totalAdjustment !== 0 && (
             <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-400 line-through font-medium">{formatCurrency(originalTotalValue)}</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${totalAdjustment > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                   {totalAdjustment > 0 ? '+' : ''}{formatCurrency(totalAdjustment)}
                </div>
             </div>
          )}
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
             {formatPercent(percentOfPortfolio)} of Portfolio
          </div>
          {totalAdjustment !== 0 && (
              <button 
                onClick={() => onResetAccount && onResetAccount(name)}
                className="mt-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shadow-sm transition-all"
              >
                  <RefreshCw className="w-3 h-3" /> Reset Adjustments
              </button>
          )}
        </div>
      </div>

      <div className="px-8 py-6 border-b border-gray-50 bg-white/50">
        <AllocationBar 
          data={accountStats.assetClasses} 
          total={totalValue} 
          colors={colors}
          details={accountStats.assetClassDetails}
          className="shadow-none border-0 p-0 bg-transparent"
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-white">
            <tr>
              <HeaderCell label="Symbol" sortKey="Symbol" className="pl-8" />
              <HeaderCell label="Asset Class" sortKey="Asset Class" />
              <HeaderCell label="Dollar Value" sortKey="SimulatedValue" align="right" />
              <HeaderCell label="Account %" sortKey="PercentOfAccount" align="right" />
              <HeaderCell label="Adjustment" sortKey="adjustment" align="right" className="bg-slate-50/50" />
              {onToggleLock && (
                <th className="py-4 px-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Locks</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {sortedPositions.map((row) => {
                const meta = metadata[row.Symbol];
                const isSplit = meta && typeof meta === 'object' && meta.assetClass !== undefined 
                    ? typeof meta.assetClass === 'object' 
                    : typeof meta === 'object';
                
                const assetClassLabelVal = meta && typeof meta === 'object' && meta.assetClass !== undefined ? meta.assetClass : meta;
                const assetClassLabel = isSplit ? 'Split' : (assetClassLabelVal || "Unknown");
                const isUnknown = assetClassLabel === "Unknown";

                const description = meta && typeof meta === 'object' && meta.description ? meta.description : row.Description || '';
                
                const symLocks = locks[row.Symbol] || {};
                const isNoBuy = !!symLocks.noBuy;
                const isNoSell = !!symLocks.noSell;
                const hasLock = isNoBuy || isNoSell;
                const isEditing = editingAdjustment === row.Symbol;

                return (
                  <tr key={row.Symbol} className={`hover:bg-blue-50/20 transition-colors group ${hasLock ? 'bg-orange-50/20' : ''}`}>
                    <td className="whitespace-nowrap py-5 pl-8 pr-4 text-sm font-medium text-gray-900">
                      <div className="font-bold tracking-tight text-base">{row.Symbol}</div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider truncate max-w-[180px] mt-0.5" title={description}>{description}</div>
                    </td>
                    <td className="py-5 px-4 text-sm text-gray-500">
                      {isSplit ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(assetClassLabelVal).sort((a,b) => b[1] - a[1]).map(([cat, ratio]) => (
                            <span key={cat} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-slate-50 text-gray-600 border-slate-200">
                              {cat} {Math.round(ratio * 100)}%
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isUnknown ? 'bg-red-50 text-red-500 border-red-100' : 'bg-slate-50 text-gray-600 border-slate-200'}`}>
                          {assetClassLabel}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-5 px-4 text-sm text-gray-900 text-right font-medium">
                       <div className="flex flex-col items-end">
                           <span className="font-bold">{formatCurrency(row.SimulatedValue)}</span>
                           {row.adjustment !== 0 && (
                             <span className="text-[10px] text-gray-400 line-through mt-0.5 font-semibold">{formatCurrency(row.OriginalValue)}</span>
                           )}
                       </div>
                    </td>
                    <td className="whitespace-nowrap py-5 px-4 text-sm text-gray-500 text-right font-bold tabular-nums">
                        {formatPercent(row.PercentOfAccount)}
                    </td>
                    <td className="whitespace-nowrap py-4 px-4 text-right bg-slate-50/30 group-hover:bg-blue-50/50 transition-colors">
                      {isEditing ? (
                        /* Inline edit mode */
                        <div className="flex items-center justify-end gap-2">
                          <div className="relative inline-block w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
                            <input
                              type="number"
                              placeholder="0"
                              className={`w-full pl-7 pr-3 py-1.5 text-right text-sm font-bold border rounded-lg focus:ring-4 focus:ring-blue-500/10 outline-none transition-all ${ 
                                flashErrors[row.Symbol] 
                                ? 'bg-red-50 border-red-400 text-red-600' 
                                : 'border-blue-300 bg-white text-blue-600 shadow-sm'
                              }`}
                              value={row.adjustment === 0 ? '' : row.adjustment}
                              onChange={(e) => handleLocalAdjustment(row.Symbol, e.target.value, row.OriginalValue)}
                              onBlur={() => setEditingAdjustment(null)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingAdjustment(null); }}
                              autoFocus
                            />
                          </div>
                        </div>
                      ) : (
                        /* Read-only pill display */
                        <div className="flex items-center justify-end gap-1">
                          {row.adjustment !== 0 ? (
                            <>
                              <button
                                onClick={() => setEditingAdjustment(row.Symbol)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-105 ${
                                  row.adjustment > 0 
                                    ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100' 
                                    : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                }`}
                              >
                                {row.adjustment > 0 ? '+' : ''}{formatCurrency(row.adjustment)}
                              </button>
                              <button
                                onClick={() => onAdjustmentChange(name, row.Symbol, 0)}
                                className="p-1 text-gray-300 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                                title="Clear adjustment"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setEditingAdjustment(row.Symbol)}
                              className="px-2.5 py-1 rounded-full text-xs text-gray-300 hover:text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer transition-all"
                            >
                              —
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    {onToggleLock && (
                      <td className="whitespace-nowrap py-4 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onToggleLock(name, row.Symbol, 'noBuy')}
                            className={`p-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider border transition-all ${
                              isNoBuy 
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                : 'bg-white text-gray-300 border-gray-100 hover:bg-gray-50 hover:text-gray-500 hover:border-gray-200'
                            }`}
                            title={isNoBuy ? 'Unlock buying' : 'Lock buying'}
                          >
                            {isNoBuy ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            <span className="block mt-0.5 leading-none">Buy</span>
                          </button>
                          <button
                            onClick={() => onToggleLock(name, row.Symbol, 'noSell')}
                            className={`p-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider border transition-all ${
                              isNoSell 
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                : 'bg-white text-gray-300 border-gray-100 hover:bg-gray-50 hover:text-gray-500 hover:border-gray-200'
                            }`}
                            title={isNoSell ? 'Unlock selling' : 'Lock selling'}
                          >
                            {isNoSell ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            <span className="block mt-0.5 leading-none">Sell</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountTable;