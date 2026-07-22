import React, { useState, useMemo } from 'react';
import { sortAssetClassesByValue } from '../utils/calculations';
import { formatCurrency, formatPercent } from '../utils/currency';

const AllocationPieChart = ({ data, total, colors, details, headerContent }) => {
  const [tooltip, setTooltip] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const sortedKeys = useMemo(() => sortAssetClassesByValue(data), [data]);
  
  let cumulativePercent = 0;
  
  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent) * 100;
    const y = Math.sin(2 * Math.PI * percent) * 100;
    return [x, y];
  };

  const slices = sortedKeys.map(key => {
    const value = data[key];
    const fraction = value / total; 
    if (fraction < 0.005) return null;

    const start = cumulativePercent;
    const end = cumulativePercent + fraction;
    cumulativePercent += fraction;

    const [startX, startY] = getCoordinatesForPercent(start);
    const [endX, endY] = getCoordinatesForPercent(end);
    
    const largeArcFlag = fraction > 0.5 ? 1 : 0;
    const pathData = `M 0 0 L ${startX} ${startY} A 100 100 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

    return { key, pathData, percent: fraction * 100, value, color: colors[key].split(' ')[0] };
  }).filter(Boolean);

  const updateTooltip = (e, slice) => {
     const x = e.clientX;
     const y = e.clientY;
     const xOffset = x > window.innerWidth - 220 ? -200 : 20;
     const yOffset = y > window.innerHeight - 200 ? -150 : 20;

     setTooltip({
         x: x + xOffset,
         y: y + yOffset,
         key: slice.key,
         value: slice.value,
         percent: slice.percent,
         topSymbols: details[slice.key]?.topSymbols || []
     });
  };

  const handleMouseEnter = (e, slice) => {
     updateTooltip(e, slice);
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

  const handleMouseLeave = () => {
      setTooltip(null);
  };

  const toggleSelection = (key) => {
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleSliceClick = (e, slice) => {
    e.stopPropagation();
    toggleSelection(slice.key);
    updateTooltip(e, slice);
  };

  const selectedValue = selectedKeys.reduce((sum, key) => sum + (data[key] || 0), 0);
  const selectedRatio = total > 0 ? (selectedValue / total) * 100 : 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 relative">
      {tooltip && (
          <div 
            className="fixed z-50 bg-white shadow-xl rounded-lg border border-gray-200 p-3 min-w-[180px] pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="font-bold text-gray-900 text-sm mb-1">{tooltip.key}</div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                <span className="text-gray-500 font-medium">{formatPercent(tooltip.percent)}</span>
                <span className="text-gray-700 font-bold">{formatCurrency(tooltip.value)}</span>
            </div>
            <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Top Holdings</div>
                {tooltip.topSymbols.map(sym => (
                    <div key={sym.symbol} className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700">{sym.symbol}</span>
                        <span className="text-gray-500">{formatCurrency(sym.value)}</span>
                    </div>
                ))}
            </div>
          </div>
      )}

      {headerContent && (
        <div className="mb-6 pb-6 border-b border-gray-100">
          {headerContent}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-64 h-64 flex-shrink-0">
            <svg viewBox="-105 -105 210 210" className="w-full h-full transform -rotate-90">
            {slices.map((slice) => {
                const isSelected = selectedKeys.includes(slice.key);
                const hasSelection = selectedKeys.length > 0;
                const opacityClass = hasSelection ? (isSelected ? 'opacity-100' : 'opacity-20 hover:opacity-40') : 'opacity-100 hover:opacity-80';

                return (
                  <path 
                    key={slice.key} 
                    d={slice.pathData} 
                    className={`${slice.color} ${opacityClass} transition-opacity cursor-pointer stroke-white stroke-[2px]`} 
                    onMouseEnter={(e) => handleMouseEnter(e, slice)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => handleSliceClick(e, slice)}
                  />
                );
            })}
            </svg>
        </div>

        <div className="flex-grow w-full">
            {selectedKeys.length > 0 && (
                <div className="mb-5 p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="text-blue-900 font-semibold text-sm">Selected Allocation</div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedKeys([]); }}
                          className="text-blue-600 hover:text-white hover:bg-blue-500 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded transition-colors"
                        >
                          Clear
                        </button>
                    </div>
                    <div className="font-bold text-blue-900 text-lg">{formatPercent(selectedRatio)}</div>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {sortedKeys.map((key) => {
                const value = data[key];
                if (value <= 0) return null;
                const pct = total > 0 ? (value / total) * 100 : 0;
                const bgClass = colors[key].split(' ')[1]; 
                
                const isSelected = selectedKeys.includes(key);
                const hasSelection = selectedKeys.length > 0;
                const itemOpacity = hasSelection && !isSelected ? 'opacity-40' : 'opacity-100';

                return (
                    <div 
                      key={key} 
                      className={`flex justify-between items-center text-xs group cursor-pointer p-2 -mx-2 rounded-lg transition-all hover:bg-gray-50 ${itemOpacity}`}
                      onClick={() => toggleSelection(key)}
                    >
                    <div className="flex items-center gap-2 flex-grow min-w-0">
                        <div className={`${bgClass} w-3 h-3 rounded-full flex-shrink-0`} />
                        <span className="text-gray-700 font-medium truncate" title={key}>{key}</span>
                    </div>
                    <span className="font-bold text-gray-900 ml-3 flex-shrink-0">{formatPercent(pct)}</span>
                    </div>
                );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AllocationPieChart;