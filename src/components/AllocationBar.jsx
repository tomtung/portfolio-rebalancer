import React, { useState, useMemo } from 'react';
import { sortCategoriesByValue } from '../utils/calculations';
import { formatCurrency, formatPercent } from '../utils/currency';

const AllocationBar = ({ label, data, total, colors, details, className = "" }) => {
  const sortedKeys = useMemo(() => sortCategoriesByValue(data), [data]);
  const [tooltip, setTooltip] = useState(null);

  const updateTooltip = (e, key, value, percent) => {
     const x = e.clientX;
     const y = e.clientY;
     const xOffset = x > window.innerWidth - 220 ? -200 : 20;
     const yOffset = y > window.innerHeight - 200 ? -150 : 20;

     setTooltip({
         x: x + xOffset,
         y: y + yOffset,
         key: key,
         value: value,
         percent: percent,
         topSymbols: details && details[key] ? details[key].topSymbols : []
     });
  };

  const handleMouseMove = (e) => {
      if (tooltip) {
         const x = e.clientX;
         const y = e.clientY;
         const xOffset = x > window.innerWidth - 220 ? -200 : 20;
         const yOffset = y > window.innerHeight - 200 ? -150 : 20;
         
         setTooltip(prev => prev ? ({ ...prev, x: x + xOffset, y: y + yOffset }) : null);
      }
  };

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${className} relative`}>
      {tooltip && (
          <div 
            className="fixed z-50 bg-white shadow-xl rounded-lg border border-gray-200 p-3 min-w-[180px] pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="font-bold text-gray-900 text-sm mb-1">{tooltip.key}</div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                <span className="text-gray-500 font-medium">{formatPercent(tooltip.percent)}</span>
                <span className="text-gray-700 font-medium">{formatCurrency(tooltip.value)}</span>
            </div>
            {tooltip.topSymbols && tooltip.topSymbols.length > 0 && (
              <div className="space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Top Holdings</div>
                  {tooltip.topSymbols.map(sym => (
                      <div key={sym.symbol} className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700">{sym.symbol}</span>
                          <span className="text-gray-500">{formatCurrency(sym.value)}</span>
                      </div>
                  ))}
              </div>
            )}
          </div>
      )}

      {label && <h3 className="text-sm font-semibold text-gray-700 mb-3">{label}</h3>}
      <div className="flex h-5 w-full rounded-full overflow-hidden bg-gray-100 mb-4">
        {sortedKeys.map((key) => {
          const value = data[key];
          const width = total > 0 ? (value / total) * 100 : 0;
          if (width < 0.5) return null; 
          const bgClass = colors[key] ? colors[key].split(' ')[1] : 'bg-gray-300';
          return (
            <div 
              key={key}
              className={`${bgClass} transition-all duration-500 ease-in-out hover:opacity-80 cursor-pointer`}
              style={{ width: `${width}%` }}
              onMouseEnter={(e) => updateTooltip(e, key, value, width)}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
              onClick={(e) => updateTooltip(e, key, value, width)}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-2">
        {sortedKeys.map((key) => {
          const value = data[key];
          if (value <= 0) return null;
          const pct = total > 0 ? (value / total) * 100 : 0;
          const bgClass = colors[key] ? colors[key].split(' ')[1] : 'bg-gray-300';
          return (
            <div key={key} className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 flex-grow min-w-0">
                <div className={`${bgClass} w-3 h-3 rounded-full flex-shrink-0`} />
                <span className="text-gray-600 truncate" title={key}>{key}</span>
              </div>
              <span className="font-medium text-gray-900 ml-3 flex-shrink-0">{formatPercent(pct)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AllocationBar;
