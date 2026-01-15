import React, { useState, useMemo } from 'react';
import { Tag, Search, Edit2, Check, X, AlertCircle, Code } from 'lucide-react';
import AutoResizingTextarea from './AutoResizingTextarea';

export default function CategoryManager({ symbols, metadata, onUpdateMetadata, onReset }) {
  const [filter, setFilter] = useState('');
  const [editingSymbol, setEditingSymbol] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJsonValue, setRawJsonValue] = useState('');

  // Extract unique existing categories for suggestions
  const existingCategories = useMemo(() => {
    const cats = new Set();
    Object.values(metadata).forEach(val => {
      if (typeof val === 'string') cats.add(val);
      else if (typeof val === 'object') {
        Object.keys(val).forEach(k => cats.add(k));
      }
    });
    return Array.from(cats).sort();
  }, [metadata]);

  // Merge known symbols with any extra symbols in metadata
  const allSymbols = useMemo(() => {
    const s = new Set(symbols);
    Object.keys(metadata).forEach(k => s.add(k));
    return Array.from(s).sort();
  }, [symbols, metadata]);

  const filteredSymbols = allSymbols.filter(s => 
    s.toLowerCase().includes(filter.toLowerCase()) || 
    (typeof metadata[s] === 'string' && metadata[s].toLowerCase().includes(filter.toLowerCase()))
  );

  const handleEditStart = (symbol) => {
    setEditingSymbol(symbol);
    const val = metadata[symbol];
    if (typeof val === 'object') {
        setEditValue(JSON.stringify(val, null, 2));
    } else {
        setEditValue(val || '');
    }
  };

  const handleSave = (symbol) => {
    let newValue = editValue.trim();
    
    // Try to parse if it looks like JSON or if original was object
    if (newValue.startsWith('{')) {
        try {
            newValue = JSON.parse(newValue);
        } catch (e) {
            alert("Invalid JSON format for split allocation.");
            return;
        }
    }

    const newMetadata = { ...metadata };
    if (newValue === '' || (typeof newValue === 'object' && Object.keys(newValue).length === 0)) {
        delete newMetadata[symbol];
    } else {
        newMetadata[symbol] = newValue;
    }
    
    onUpdateMetadata(newMetadata);
    setEditingSymbol(null);
  };

  const handleRawJsonChange = (e) => {
      setRawJsonValue(e.target.value);
  };

  const saveRawJson = () => {
      try {
          const parsed = JSON.parse(rawJsonValue);
          onUpdateMetadata(parsed);
          setShowRawJson(false);
      } catch (e) {
          alert("Invalid JSON");
      }
  };

  const toggleRawJson = () => {
      if (!showRawJson) {
          setRawJsonValue(JSON.stringify(metadata, null, 2));
      }
      setShowRawJson(!showRawJson);
  };

  return (
    <div className="overflow-hidden">
      <div className="pb-4 mb-4 border-b border-gray-200 flex justify-between items-center">
        <div className="text-xs text-gray-500">
            {showRawJson ? "Editing raw JSON metadata" : `Managing ${filteredSymbols.length} symbols`}
        </div>
        <div className="flex gap-2">
             <button 
                onClick={toggleRawJson}
                className="text-xs flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
             >
                 <Code className="w-3 h-3" /> {showRawJson ? "Visual Editor" : "Raw JSON"}
             </button>
             <button 
                onClick={onReset}
                className="text-xs text-blue-600 hover:text-blue-800"
            >
                Reset
            </button>
        </div>
      </div>

      {showRawJson ? (
          <div className="p-4">
              <div className="mb-2 text-xs text-gray-500">
                  Edit the raw JSON directly. Useful for bulk updates or backing up your config.
              </div>
              <AutoResizingTextarea
                value={rawJsonValue}
                onChange={handleRawJsonChange}
                className="w-full p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none whitespace-pre overflow-x-auto min-h-[300px]"
              />
              <div className="mt-2 flex justify-end">
                  <button onClick={saveRawJson} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Apply JSON</button>
              </div>
          </div>
      ) : (
        <>
            <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Filter symbols or categories..." 
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-4 py-2 w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredSymbols.map(symbol => {
                            const isEditing = editingSymbol === symbol;
                            const category = metadata[symbol];
                            const isSplit = typeof category === 'object' && category !== null;

                            return (
                                <tr key={symbol} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{symbol}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {isEditing ? (
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onKeyDown={e => { if(e.key === 'Enter') handleSave(symbol); else if(e.key === 'Escape') setEditingSymbol(null); }}
                                                    className="w-full p-1 border border-blue-400 rounded focus:outline-none text-sm"
                                                    autoFocus
                                                    list="category-suggestions"
                                                    placeholder="Enter category or JSON..."
                                                />
                                                <datalist id="category-suggestions">
                                                    {existingCategories.map(c => <option key={c} value={c} />)}
                                                </datalist>
                                                {editValue && editValue.startsWith('{') && (
                                                    <span className="text-[10px] text-orange-500 absolute right-0 -bottom-4">JSON Mode</span>
                                                )}
                                            </div>
                                        ) : (
                                            isSplit ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(category).map(([k, v]) => (
                                                        <span key={k} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">
                                                            {k}: {Math.round(v*100)}%
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${category ? 'bg-gray-100 text-gray-800' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                    {category || 'Uncategorized'}
                                                </span>
                                            )
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleSave(symbol)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => setEditingSymbol(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleEditStart(symbol)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredSymbols.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                                    No symbols found matching "{filter}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
      )}
    </div>
  );
}
