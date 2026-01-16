import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tag, Search, Check, X, Code, Split, Plus, Trash2, AlertCircle } from 'lucide-react';
import AutoResizingTextarea from './AutoResizingTextarea';
import SplitAllocator from './SplitAllocator';

export default function MetadataManager({ symbols, metadata, onUpdateMetadata, onReset }) {
  const [filter, setFilter] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { symbol, field }
  const [editValue, setEditValue] = useState('');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJsonValue, setRawJsonValue] = useState('');
  
  // New row state
  const [newRow, setNewRow] = useState(null); // { symbol: '', description: '', category: '' }
  const [newRowError, setNewRowError] = useState(false);
  
  // Highlighting state
  const [highlightedSymbol, setHighlightedSymbol] = useState(null);
  const tableContainerRef = useRef(null);

  // Extract unique existing categories for suggestions
  const existingCategories = useMemo(() => {
    const cats = new Set();
    Object.values(metadata).forEach(val => {
      let catVal = val;
      if (typeof val === 'object' && val.category !== undefined) {
          catVal = val.category;
      }
      
      if (typeof catVal === 'string') cats.add(catVal);
      else if (typeof catVal === 'object') {
        Object.keys(catVal).forEach(k => cats.add(k));
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

  const filteredSymbols = allSymbols.filter(s => {
    const meta = metadata[s];
    const cat = (meta && typeof meta === 'object' && meta.category !== undefined) ? meta.category : meta;
    const desc = (meta && typeof meta === 'object' && meta.description) ? meta.description : '';
    
    const term = filter.toLowerCase();
    return s.toLowerCase().includes(term) || 
           (typeof cat === 'string' && cat.toLowerCase().includes(term)) ||
           desc.toLowerCase().includes(term);
  });

  useEffect(() => {
      if (highlightedSymbol) {
          const el = document.getElementById(`row-${highlightedSymbol}`);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          const timer = setTimeout(() => setHighlightedSymbol(null), 2000);
          return () => clearTimeout(timer);
      }
  }, [highlightedSymbol, filteredSymbols]); // filteredSymbols dependency to ensure row exists after render

  const getMetaParts = (symbol) => {
      const val = metadata[symbol];
      if (!val) return { category: '', description: '' };

      if (typeof val === 'object') {
          const hasCategory = 'category' in val;
          const hasDescription = 'description' in val;

          if (hasCategory || hasDescription) {
              let cat = val.category;
              if (typeof cat === 'object' && cat !== null && Object.keys(cat).length === 0) {
                  cat = '';
              }
              return { 
                  category: cat || '', 
                  description: val.description || '' 
              };
          }
          if (Object.keys(val).length === 0) return { category: '', description: '' };
          return { category: val, description: '' };
      }
      
      return { category: val, description: '' };
  };

  const handleEditStart = (symbol, field) => {
    // Don't start editing if we are in the middle of adding a new row (optional, but cleaner)
    // Actually user might want to edit others while adding. Let's allow it.
    
    const { category, description } = getMetaParts(symbol);
    
    if (field === 'category') {
        if (typeof category === 'object') {
            setIsSplitMode(true);
            setEditValue(category);
        } else {
            setIsSplitMode(false);
            setEditValue(category || '');
        }
    } else {
        setEditValue(description);
    }
    
    setEditingCell({ symbol, field });
  };

  const handleSave = () => {
    if (!editingCell) return;
    const { symbol, field } = editingCell;
    const currentMeta = getMetaParts(symbol);
    
    let newValue = editValue;
    
    // Validate Category JSON if manual entry
    if (field === 'category' && !isSplitMode && typeof newValue === 'string') {
        newValue = newValue.trim();
        if (newValue.startsWith('{')) {
            try {
                newValue = JSON.parse(newValue);
            } catch (e) {
                alert("Invalid JSON format for category.");
                return;
            }
        }
    } else if (field === 'description') {
        newValue = newValue.trim();
    }

    const newMetadata = { ...metadata };
    
    let finalCategory = field === 'category' ? newValue : currentMeta.category;
    let finalDescription = field === 'description' ? newValue : currentMeta.description;

    const isEmptyCategory = finalCategory === '' || finalCategory === null || (typeof finalCategory === 'object' && Object.keys(finalCategory).length === 0);
    const isEmptyDesc = finalDescription === '';

    if (isEmptyCategory && isEmptyDesc) {
        delete newMetadata[symbol];
    } else {
        newMetadata[symbol] = {
            category: finalCategory,
            description: finalDescription
        };
    }
    
    onUpdateMetadata(newMetadata);
    setEditingCell(null);
    setIsSplitMode(false);
  };

  const handleCancel = () => {
      setEditingCell(null);
      setIsSplitMode(false);
  };

  const handleRemoveSymbol = (symbol) => {
      const newMetadata = { ...metadata };
      delete newMetadata[symbol];
      onUpdateMetadata(newMetadata);
  };

  // --- New Row Logic ---

  const handleAddRowClick = () => {
      setNewRow({ symbol: '' });
      setNewRowError(false);
  };

  const commitNewRow = () => {
      if (!newRow) return;
      const symbol = newRow.symbol.trim().toUpperCase();
      
      if (!symbol) {
          // If empty, just cancel
          cancelNewRow();
          return;
      }

      if (metadata[symbol]) {
          // Duplicate, don't commit, keep error state
          setNewRowError(true);
          return;
      }
      
      const newMetadata = { ...metadata };
      newMetadata[symbol] = {
          category: '',
          description: ''
      };

      onUpdateMetadata(newMetadata);
      
      setHighlightedSymbol(symbol);
      cancelNewRow();
  };

  const cancelNewRow = () => {
      setNewRow(null);
      setNewRowError(false);
  };

  // --- Raw JSON ---

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

  const toggleSplitMode = () => {
      setIsSplitMode(!isSplitMode);
      if (!isSplitMode) {
          setEditValue(typeof editValue === 'string' && editValue ? { [editValue]: 1.0 } : {});
      } else {
          setEditValue('');
      }
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
                        placeholder="Filter symbols, categories, or descriptions..." 
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto" ref={tableContainerRef}>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Symbol</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[350px]">Category</th>
                            <th className="px-4 py-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredSymbols.map(symbol => {
                            const { category, description } = getMetaParts(symbol);
                            const isSplit = typeof category === 'object' && category !== null;
                            
                            const isEditingCat = editingCell?.symbol === symbol && editingCell?.field === 'category';
                            const isEditingDesc = editingCell?.symbol === symbol && editingCell?.field === 'description';

                            return (
                                <tr 
                                    key={symbol} 
                                    id={`row-${symbol}`}
                                    className={`align-top transition-colors duration-500 ${
                                        highlightedSymbol === symbol 
                                        ? 'bg-blue-50' 
                                        : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 pt-4">{symbol}</td>
                                    
                                    {/* Description Column */}
                                    <td 
                                        className={`px-4 py-3 text-sm min-w-[200px] ${!isEditingDesc ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                        onClick={() => !isEditingDesc && !editingCell && handleEditStart(symbol, 'description')}
                                    >
                                        {isEditingDesc ? (
                                            <div className="flex gap-2 items-center">
                                                <input 
                                                    type="text" 
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onKeyDown={e => { if(e.key === 'Enter') handleSave(); else if(e.key === 'Escape') handleCancel(); }}
                                                    className="w-full p-1 border border-blue-400 rounded focus:outline-none text-sm"
                                                    placeholder="Description..."
                                                    autoFocus
                                                />
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                                    <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 block">
                                                {description || <span className="text-gray-300 italic">No description</span>}
                                            </span>
                                        )}
                                    </td>

                                    {/* Category Column */}
                                    <td 
                                        className={`px-4 py-3 text-sm min-w-[300px] ${!isEditingCat ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                        onClick={() => !isEditingCat && !editingCell && handleEditStart(symbol, 'category')}
                                    >
                                        {isEditingCat ? (
                                            <div className="flex flex-col gap-2">
                                                {isSplitMode ? (
                                                    <SplitAllocator 
                                                        value={editValue} 
                                                        onChange={setEditValue}
                                                        existingCategories={existingCategories}
                                                    />
                                                ) : (
                                                    <>
                                                        <input 
                                                            type="text" 
                                                            value={typeof editValue === 'string' ? editValue : ''}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            onKeyDown={e => { if(e.key === 'Enter') handleSave(); else if(e.key === 'Escape') handleCancel(); }}
                                                            className="w-full p-1 border border-blue-400 rounded focus:outline-none text-sm"
                                                            autoFocus
                                                            list="category-suggestions"
                                                            placeholder="Enter category..."
                                                        />
                                                        <datalist id="category-suggestions">
                                                            {existingCategories.map(c => <option key={c} value={c} />)}
                                                        </datalist>
                                                    </>
                                                )}
                                                
                                                <div className="flex justify-between items-center">
                                                    <button 
                                                        onClick={toggleSplitMode}
                                                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 self-start"
                                                    >
                                                        <Split className="w-3 h-3" />
                                                        {isSplitMode ? "Switch to Simple Mode" : "Switch to Split Mode"}
                                                    </button>
                                                    <div className="flex gap-1">
                                                        <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                                        <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
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
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${category ? 'bg-gray-100 text-gray-800' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                    {category || 'Unknown'}
                                                </span>
                                            )
                                        )}
                                    </td>

                                    {/* Action Column */}
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => handleRemoveSymbol(symbol)}
                                            className="text-gray-400 hover:text-red-600 p-1"
                                            title="Remove metadata"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        
                        {/* New Row Input */}
                        {newRow && (
                            <tr className="bg-blue-50/30 border-t border-blue-100">
                                <td className="px-4 py-3 align-top pt-4">
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="text" 
                                            value={newRow.symbol}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                setNewRow({ ...newRow, symbol: val });
                                                setNewRowError(!!metadata[val]);
                                            }}
                                            onKeyDown={e => { 
                                                if(e.key === 'Enter') commitNewRow(); 
                                                else if(e.key === 'Escape') cancelNewRow(); 
                                            }}
                                            className={`w-24 p-1 border rounded text-sm uppercase font-bold focus:outline-none ${newRowError ? 'border-red-500 bg-red-50 text-red-900' : 'border-blue-300'}`}
                                            placeholder="SYM"
                                            autoFocus
                                        />
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button onClick={commitNewRow} className="p-1 text-green-600 hover:bg-green-50 rounded" disabled={newRowError || !newRow.symbol}><Check className="w-4 h-4" /></button>
                                            <button onClick={cancelNewRow} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 align-top pt-4" colSpan={3}></td>
                            </tr>
                        )}

                        {filteredSymbols.length === 0 && !newRow && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">
                                    No symbols found matching "{filter}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button 
                    onClick={handleAddRowClick}
                    disabled={!!newRow || !!editingCell}
                    className={`text-xs flex items-center gap-1 font-medium ${
                        newRow || editingCell 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-blue-600 hover:text-blue-700'
                    }`}
                >
                    <Plus className="w-3 h-3" /> Add Symbol Metadata
                </button>
            </div>
        </>
      )}
    </div>
  );
}
