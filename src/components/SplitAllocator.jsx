import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

export default function SplitAllocator({ value, onChange, existingAssetClasses }) {
  const parseRowsFromValue = (val) => {
    if (val && typeof val === 'object') {
      const initialRows = Object.entries(val).map(([cat, ratio]) => ({
        assetClass: cat,
        percent: Math.round(ratio * 100)
      }));
      if (initialRows.length === 0) {
          initialRows.push({ assetClass: '', percent: 100 });
      }
      return initialRows;
    }
    return [{ assetClass: '', percent: 100 }];
  };

  const [rows, setRows] = useState(() => parseRowsFromValue(value));

  const updateRow = (index, field, val) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: val };
    setRows(newRows);
    emitChange(newRows);
  };

  const addRow = () => {
    const newRows = [...rows, { assetClass: '', percent: 0 }];
    setRows(newRows);
    emitChange(newRows);
  };

  const removeRow = (index) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    emitChange(newRows);
  };

  const emitChange = (currentRows) => {
    // Convert back to object format: { "AssetClass": 0.5 }
    const newValue = {};
    
    currentRows.forEach(row => {
        if (!row.assetClass.trim()) return; // Skip empty asset classes
        const ratio = parseFloat(row.percent) / 100;
        if (!isNaN(ratio)) {
            newValue[row.assetClass] = ratio;
        }
    });

    // We emit the object even if incomplete, parent handles validation/saving
    onChange(newValue);
  };

  const totalPercent = rows.reduce((sum, row) => sum + (parseFloat(row.percent) || 0), 0);
  const isTotalValid = Math.abs(totalPercent - 100) < 0.1;

  return (
    <div className="bg-gray-50 p-3 rounded-md border border-gray-200 mt-2">
      <div className="text-xs font-semibold text-gray-500 mb-2">Split Allocation</div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input 
              type="text" 
              value={row.assetClass}
              onChange={(e) => updateRow(index, 'assetClass', e.target.value)}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Asset class name"
              list="split-asset-class-suggestions"
            />
            <div className="relative w-20">
                <input 
                type="number" 
                value={row.percent}
                onChange={(e) => updateRow(index, 'percent', parseFloat(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded pl-2 pr-5 py-1 text-right focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="0"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
            </div>
            <button 
                onClick={() => removeRow(index)}
                className="text-gray-400 hover:text-red-500"
                disabled={rows.length === 1}
            >
                <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
        <button 
            onClick={addRow}
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
            <Plus className="w-3 h-3" /> Add Asset Class
        </button>
        <div className={`text-xs font-medium flex items-center gap-1 ${isTotalValid ? 'text-green-600' : 'text-red-600'}`}>
            {!isTotalValid && <AlertCircle className="w-3 h-3" />}
            Total: {totalPercent}%
        </div>
      </div>

      <datalist id="split-asset-class-suggestions">
        {existingAssetClasses.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  );
}