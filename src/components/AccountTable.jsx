import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Trash2 } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/currency';
import { calculateCategoryStats } from '../utils/calculations';
import AllocationBar from './AllocationBar';

const AccountTable = ({ name, positions, totalValue, originalTotalValue, totalAdjustment, portfolioTotal, onAdjustmentChange, onRemovePosition, metadata, colors }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'SimulatedValue', direction: 'desc' });
  const [flashErrors, setFlashErrors] = useState({});
  const percentOfPortfolio = portfolioTotal > 0 ? (totalValue / portfolioTotal) * 100 : 0;
  const accountStats = useMemo(() => calculateCategoryStats(positions, metadata), [positions, metadata]);

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
        if (sortConfig.key === 'Category') {
           const meta = metadata[a.Symbol];
           aValue = typeof meta === 'object' ? 'Split' : (meta || 'Unknown');
           const metaB = metadata[b.Symbol];
           bValue = typeof metaB === 'object' ? 'Split' : (metaB || 'Unknown');
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
      className={`py-3 px-3 text-${align} text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label}
        <span className="inline-flex">
          {sortConfig.key === sortKey ? (
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />
          )}
        </span>
      </div>
    </th>
  );

  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{name}</h2>
          <span className="text-sm text-gray-500">{positions.length} Positions</span>
        </div>
        <div className="text-right">
          <div className="flex flex-col items-end">
             <div className="text-lg font-bold text-gray-900">{formatCurrency(totalValue)}</div>
             {totalAdjustment !== 0 && (
                <div className="text-xs text-gray-400 line-through">{formatCurrency(originalTotalValue)}</div>
             )}
          </div>
          {totalAdjustment !== 0 && (
             <div className={`text-xs font-medium ${totalAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalAdjustment > 0 ? '+' : ''}{formatCurrency(totalAdjustment)}
             </div>
          )}
          <div className="text-xs text-gray-500 font-medium">
             {formatPercent(percentOfPortfolio)} of Portfolio
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
        <AllocationBar 
          data={accountStats.categories} 
          total={totalValue} 
          colors={colors}
          details={accountStats.categoryDetails}
          className="shadow-none border-0 p-0 bg-transparent"
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <HeaderCell label="Symbol" sortKey="Symbol" className="pl-6" />
              <HeaderCell label="Category" sortKey="Category" />
              <HeaderCell label="Dollar Value" sortKey="SimulatedValue" align="right" />
              <HeaderCell label="% of Account" sortKey="PercentOfAccount" align="right" />
              <HeaderCell label="Adjustment" sortKey="adjustment" align="right" className="bg-blue-50 border-b border-blue-100 text-blue-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedPositions.map((row) => {
                const meta = metadata[row.Symbol];
                const isSplit = meta && typeof meta === 'object' && meta.category !== undefined 
                    ? typeof meta.category === 'object' 
                    : typeof meta === 'object';
                
                const categoryLabelVal = meta && typeof meta === 'object' && meta.category !== undefined ? meta.category : meta;
                const categoryLabel = isSplit ? 'Split' : (categoryLabelVal || "Unknown");
                const isUnknown = categoryLabel === "Unknown";

                const description = meta && typeof meta === 'object' && meta.description ? meta.description : row.Description || '';
                
                return (
                  <tr key={row.Symbol} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                      <div>{row.Symbol}</div>
                      <div className="text-xs text-gray-400 font-normal truncate max-w-[200px]" title={description}>{description}</div>
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-500">
                      {isSplit ? (
                        <div className="flex flex-col gap-1">
                          {Object.entries(categoryLabelVal).sort((a,b) => b[1] - a[1]).map(([cat, ratio]) => (
                            <span key={cat} className="inline-flex items-center text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 w-fit">
                              <span className="font-medium mr-1">{cat}</span>
                              <span className="text-indigo-400">{Math.round(ratio * 100)}%</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${isUnknown ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                          {categoryLabel}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-900 text-right font-medium transition-all duration-300">
                       {formatCurrency(row.SimulatedValue)}
                       {row.adjustment !== 0 && (
                         <div className="text-xs text-gray-400 line-through">{formatCurrency(row.OriginalValue)}</div>
                       )}
                    </td>
                    <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-600 text-right transition-all duration-300">
                        {formatPercent(row.PercentOfAccount)}
                    </td>
                    <td className="whitespace-nowrap py-3 px-3 text-right bg-blue-50/30">
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative inline-block w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            placeholder="0"
                            className={`w-full pl-6 pr-2 py-1.5 text-right text-sm border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors duration-500 ${ 
                              flashErrors[row.Symbol] 
                              ? 'bg-red-100 border-red-500 text-red-900' 
                              : row.adjustment !== 0 
                                ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium' 
                                : 'border-gray-300 bg-white text-gray-700'
                            }`}
                            value={row.adjustment === 0 ? '' : row.adjustment}
                            onChange={(e) => handleLocalAdjustment(row.Symbol, e.target.value, row.OriginalValue)}
                          />
                        </div>
                        {row.isManual && (
                          <button 
                            onClick={() => onRemovePosition(name, row.Symbol)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove manual position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
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
