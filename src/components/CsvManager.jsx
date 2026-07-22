import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { Plus, Trash2, Code, RotateCcw, Check, X } from 'lucide-react';
import { parseCSVLine, normalizeCsv } from '../utils/csvParser';
import { parseCurrency } from '../utils/currency';
import AutoResizingTextarea from './AutoResizingTextarea';

const CsvManager = forwardRef(({ csvData, onUpdateCsv, metadata, onUpdateMetadata }, ref) => {
  const [showRaw, setShowRaw] = useState(false);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [rawText, setRawText] = useState(csvData);
  const [addingRow, setAddingRow] = useState(null);
  
  // Single cell editing state
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colIndex, tempValue, error: boolean }
  
  // Adding row error state
  const [addingRowErrors, setAddingRowErrors] = useState({}); // { [colName]: boolean }
  
  // Highlighting
  const [highlightedRowIndex, setHighlightedRowIndex] = useState(null);
  const rowsRef = useRef({});

  // Sync internal raw text when prop changes (if not editing raw)
  useEffect(() => {
    setRawText(csvData);
  }, [csvData]);

  useImperativeHandle(ref, () => ({
      applyChanges: () => {
          if (showRaw) {
              try {
                  const { newCsv, newMetadata } = normalizeCsv(rawText, metadata);
                  onUpdateCsv(newCsv);
                  if (onUpdateMetadata) {
                      onUpdateMetadata(newMetadata);
                  }
                  setRawText(newCsv);
              } catch (e) {
                  console.error("CSV normalization failed:", e);
              }
          }
      }
  }));

  const requiredColumns = ['Account Name', 'Symbol', 'Current value'];

  // Parse CSV into structured data and sort
  useEffect(() => {
    if (!rawText.trim()) {
        setHeaders([]);
        setRows([]);
        return;
    }

    const lines = rawText.trim().split('\n');
    if (lines.length > 0) {
        const parsedHeaders = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
        setHeaders(parsedHeaders);

        const parsedRows = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = parseCSVLine(lines[i]);
            // Ensure row has same length as headers
            while (values.length < parsedHeaders.length) values.push('');
            parsedRows.push(values);
        }

        // Sort rows by Account Name then Symbol
        const accIdx = parsedHeaders.findIndex(h => h.toLowerCase() === 'account name');
        const symIdx = parsedHeaders.findIndex(h => h.toLowerCase() === 'symbol');

        if (accIdx !== -1 && symIdx !== -1) {
            parsedRows.sort((a, b) => {
                const accA = (a[accIdx] || '').toLowerCase();
                const accB = (b[accIdx] || '').toLowerCase();
                if (accA !== accB) return accA.localeCompare(accB);
                
                const symA = (a[symIdx] || '').toLowerCase();
                const symB = (b[symIdx] || '').toLowerCase();
                return symA.localeCompare(symB);
            });
        }

        setRows(parsedRows);
    }
  }, [rawText]);

  
  const columnIndices = useMemo(() => {
      const indices = {};
      requiredColumns.forEach(col => {
          // Case-insensitive matching for headers
          const idx = headers.findIndex(h => h.toLowerCase() === col.toLowerCase());
          if (idx !== -1) indices[col] = idx;
      });
      return indices;
  }, [headers]);

  const hasAllRequiredColumns = requiredColumns.every(col => columnIndices[col] !== undefined);

  // Derive unique values for auto-complete
  const { uniqueAccounts, uniqueSymbols } = useMemo(() => {
      const accounts = new Set();
      const symbols = new Set();
      
      const accountIdx = columnIndices['Account Name'];
      const symbolIdx = columnIndices['Symbol'];

      if (accountIdx !== undefined && symbolIdx !== undefined) {
          rows.forEach(row => {
              if (row[accountIdx]) accounts.add(row[accountIdx]);
              if (row[symbolIdx]) symbols.add(row[symbolIdx]);
          });
      }
      return {
          uniqueAccounts: Array.from(accounts).sort(),
          uniqueSymbols: Array.from(symbols).sort()
      };
  }, [rows, columnIndices]);

  // Scroll to highlighted row
  useEffect(() => {
      if (highlightedRowIndex !== null && rowsRef.current[highlightedRowIndex]) {
          rowsRef.current[highlightedRowIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          const timer = setTimeout(() => setHighlightedRowIndex(null), 2000);
          return () => clearTimeout(timer);
      }
  }, [highlightedRowIndex]);


  const generateCsvString = (currentHeaders, currentRows) => {
      const escape = (val) => {
          if (val === undefined || val === null) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
      };

      const headerLine = currentHeaders.map(escape).join(',');
      const rowLines = currentRows.map(row => row.map(escape).join(','));
      return [headerLine, ...rowLines].join('\n');
  };

  const formatValue = (val) => {
      if (!val) return val;
      const cleanVal = val.replace(/[$,]/g, '').trim();
      const num = parseFloat(cleanVal);
      if (!isNaN(num)) {
          return new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              minimumFractionDigits: 2
          }).format(num);
      }
      return val;
  };

  // Editing Logic
  const handleStartEdit = (rowIndex, colIndex, value) => {
      setEditingCell({ rowIndex, colIndex, tempValue: value, error: false });
  };

  const handleEditChange = (value) => {
      setEditingCell(prev => ({ ...prev, tempValue: value, error: false }));
  };

  const handleEditKeyDown = (e) => {
      if (e.key === 'Enter') handleSaveEdit();
      if (e.key === 'Escape') handleCancelEdit();
  };

  const handleCancelEdit = () => {
      setEditingCell(null);
  };

  const handleSaveEdit = () => {
      if (!editingCell) return;
      const { rowIndex, colIndex, tempValue } = editingCell;
      
      const colName = Object.keys(columnIndices).find(key => columnIndices[key] === colIndex);

      // Validation
      if (colName === 'Current value') {
          const numericVal = parseCurrency(tempValue);
          if (numericVal < 0) {
              setEditingCell(prev => ({ ...prev, error: true }));
              return;
          }
      }

      if (colName === 'Account Name' || colName === 'Symbol') {
          const accIdx = columnIndices['Account Name'];
          const symIdx = columnIndices['Symbol'];
          
          const newAcc = colName === 'Account Name' ? tempValue : rows[rowIndex][accIdx];
          const newSym = colName === 'Symbol' ? tempValue : rows[rowIndex][symIdx];

          // Check duplicate in other rows
          const isDuplicate = rows.some((r, idx) => 
              idx !== rowIndex && 
              r[accIdx]?.trim() === newAcc?.trim() && 
              r[symIdx]?.trim() === newSym?.trim()
          );

          if (isDuplicate) {
              setEditingCell(prev => ({ ...prev, error: true }));
              return;
          }
      }

      // Apply format if value
      let finalValue = tempValue;
      if (colName === 'Current value') {
          finalValue = formatValue(tempValue);
      }

      const newRows = [...rows];
      newRows[rowIndex] = [...newRows[rowIndex]];
      newRows[rowIndex][colIndex] = finalValue;
      
      // Sort again if we changed Account or Symbol
      if (colName === 'Account Name' || colName === 'Symbol') {
           const accIdx = columnIndices['Account Name'];
           const symIdx = columnIndices['Symbol'];
           if (accIdx !== undefined && symIdx !== undefined) {
               newRows.sort((a, b) => {
                    const accA = (a[accIdx] || '').toLowerCase();
                    const accB = (b[accIdx] || '').toLowerCase();
                    if (accA !== accB) return accA.localeCompare(accB);
                    const symA = (a[symIdx] || '').toLowerCase();
                    const symB = (b[symIdx] || '').toLowerCase();
                    return symA.localeCompare(symB);
               });
           }
      }

      setRows(newRows);
      const newCsv = generateCsvString(headers, newRows);
      onUpdateCsv(newCsv);
      setRawText(newCsv);
      setEditingCell(null);
  };

  // Add Row Logic
  const handleStartAddRow = () => {
      const newRow = {};
      requiredColumns.forEach(col => newRow[col] = '');
      setAddingRow(newRow);
      setAddingRowErrors({});
  };

  const handleAddingRowChange = (col, value) => {
      setAddingRow(prev => ({ ...prev, [col]: value }));
      if (addingRowErrors[col]) {
          setAddingRowErrors(prev => ({ ...prev, [col]: false }));
      }
  };

  const handleAddingRowBlur = (col) => {
      if (col === 'Current value' && addingRow[col]) {
          const formatted = formatValue(addingRow[col]);
          if (formatted !== addingRow[col]) {
              handleAddingRowChange(col, formatted);
          }
      }
  };

  const handleAddingRowKeyDown = (e) => {
      if (e.key === 'Enter') handleConfirmAddRow();
      if (e.key === 'Escape') handleCancelAddRow();
  };

  const handleConfirmAddRow = () => {
      if (!addingRow) return;

      const accountName = addingRow['Account Name']?.trim();
      const symbol = addingRow['Symbol']?.trim();
      const valueStr = addingRow['Current value']?.trim();

      const newErrors = {};
      let hasError = false;

      if (!accountName) { newErrors['Account Name'] = true; hasError = true; }
      if (!symbol) { newErrors['Symbol'] = true; hasError = true; }
      if (!valueStr) { newErrors['Current value'] = true; hasError = true; }

      if (valueStr) {
        const numericValue = parseCurrency(valueStr);
        if (numericValue < 0) {
            newErrors['Current value'] = true;
            hasError = true;
        }
      }

      if (accountName && symbol) {
        const accountIdx = columnIndices['Account Name'];
        const symbolIdx = columnIndices['Symbol'];
        
        const isDuplicate = rows.some(row => 
            row[accountIdx]?.trim() === accountName && 
            row[symbolIdx]?.trim() === symbol
        );

        if (isDuplicate) {
            newErrors['Account Name'] = true;
            newErrors['Symbol'] = true;
            hasError = true;
        }
      }

      if (hasError) {
          setAddingRowErrors(newErrors);
          return;
      }

      // Create new row array matching headers order
      // If we are in visual mode and somehow headers are different, we try to map.
      // But usually this view forces the 3 columns or operates on existing headers.
      // We will map to existing headers.
      const newRowArr = headers.map(h => {
          // Find matching key case-insensitive
          const key = Object.keys(addingRow).find(k => k.toLowerCase() === h.toLowerCase());
          return key ? addingRow[key] : '';
      });

      const newRows = [...rows, newRowArr];

      // Sort
      const accountIdx = columnIndices['Account Name'];
      const symbolIdx = columnIndices['Symbol'];

      if (accountIdx !== undefined && symbolIdx !== undefined) {
          newRows.sort((a, b) => {
                const accA = (a[accountIdx] || '').toLowerCase();
                const accB = (b[accountIdx] || '').toLowerCase();
                if (accA !== accB) return accA.localeCompare(accB);
                const symA = (a[symbolIdx] || '').toLowerCase();
                const symB = (b[symbolIdx] || '').toLowerCase();
                return symA.localeCompare(symB);
          });
      }

      // Find index of new row
      const newIndex = newRows.findIndex(r => 
          r[accountIdx] === accountName && r[symbolIdx] === symbol
      );

      setRows(newRows);
      
      const newCsv = generateCsvString(headers, newRows);
      onUpdateCsv(newCsv);
      setRawText(newCsv);
      setAddingRow(null);
      setAddingRowErrors({});
      
      if (newIndex !== -1) {
          setHighlightedRowIndex(newIndex);
      }
  };

  const handleCancelAddRow = () => {
      setAddingRow(null);
      setAddingRowErrors({});
  };

  const handleRemoveRow = (rowIndex) => {
      const newRows = rows.filter((_, i) => i !== rowIndex);
      setRows(newRows);
      
      const newCsv = generateCsvString(headers, newRows);
      onUpdateCsv(newCsv);
      setRawText(newCsv);
  };

  const handleRawChange = (e) => {
      setRawText(e.target.value);
      onUpdateCsv(e.target.value);
  };

  const toggleMode = () => {
      setShowRaw(!showRaw);
      setAddingRow(null);
      setEditingCell(null);
  };

  if (!hasAllRequiredColumns && !showRaw && headers.length > 0) {
      return (
          <div className="p-4 text-center text-red-600 bg-red-50 rounded border border-red-200">
              <p className="text-sm font-medium mb-2">CSV is missing required columns.</p>
              <p className="text-xs mb-3">Required: {requiredColumns.join(', ')}</p>
              <button 
                onClick={() => setShowRaw(true)}
                className="text-xs bg-white border border-red-300 px-3 py-1 rounded hover:bg-red-50"
              >
                  Edit Raw CSV
              </button>
          </div>
      );
  }

  return (
    <div className="overflow-hidden">
      <div className="pb-4 mb-4 border-b border-gray-200 flex justify-between items-center">
        <div className="text-xs text-gray-500">
            {showRaw ? "Editing raw CSV data" : `Managing ${rows.length} positions`}
        </div>
        <div className="flex gap-2">
             <button 
                onClick={toggleMode}
                className="text-xs flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
             >
                 <Code className="w-3 h-3" /> {showRaw ? "Visual Editor" : "Raw CSV"}
             </button>
        </div>
      </div>

      {showRaw ? (
          <div className="p-4">
              <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-600">
                  <p className="font-semibold mb-1">How CSV Application Works:</p>
                  <ul className="list-disc list-inside space-y-1">
                      <li><strong>Normalization:</strong> Standardizes data to 3 columns: <code>Account Name</code>, <code>Symbol</code>, and <code>Current value</code>.</li>
                      <li><strong>Aggregation:</strong> Duplicate (Account + Symbol) rows are automatically summed together.</li>
                      <li><strong>Metadata:</strong> If a <code>Description</code> column exists, non-empty values will update missing descriptions in your Symbol Metadata.</li>
                      <li><strong>Validation:</strong> Aggregated values must be non-negative. Short positions are not supported.</li>
                      <li><strong>Zero Values:</strong> Positions with $0 are kept. You can use these as placeholders to allow buying into those symbols during rebalancing.</li>
                      <li><strong>Cleanup:</strong> Rows missing a Symbol are ignored. All other extra columns are discarded.</li>
                  </ul>
              </div>
              <AutoResizingTextarea
                value={rawText}
                onChange={handleRawChange}
                className="w-full p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none whitespace-pre overflow-x-auto min-h-[300px]"
              />
          </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <datalist id="account-suggestions">
                {uniqueAccounts.map(a => <option key={a} value={a} />)}
            </datalist>
            <datalist id="symbol-suggestions">
                {uniqueSymbols.map(s => <option key={s} value={s} />)}
            </datalist>

            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                            Account Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[55%]">
                            Symbol
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">
                            Current value
                        </th>
                        <th className="w-12"></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row, rowIndex) => (
                        <tr 
                            key={rowIndex} 
                            ref={el => rowsRef.current[rowIndex] = el}
                            className={`transition-colors duration-500 ${ 
                                highlightedRowIndex === rowIndex 
                                ? 'bg-blue-50' 
                                : 'hover:bg-gray-50'
                            }`}
                        >
                            {requiredColumns.map(col => {
                                const colIndex = columnIndices[col];
                                const val = row[colIndex] || '';
                                let listId = undefined;
                                if (col === 'Account Name') listId = 'account-suggestions';
                                if (col === 'Symbol') listId = 'symbol-suggestions';

                                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                const hasError = isEditing && editingCell.error;

                                return (
                                    <td 
                                        key={`${rowIndex}-${col}`}
                                        className={`px-3 py-2 text-sm ${!isEditing ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                        onClick={() => !isEditing && !editingCell && handleStartEdit(rowIndex, colIndex, val)}
                                    >
                                        {isEditing ? (
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="text" 
                                                    value={editingCell.tempValue}
                                                    list={listId}
                                                    onChange={(e) => handleEditChange(e.target.value)}
                                                    onKeyDown={handleEditKeyDown}
                                                    className={`w-full border rounded px-2 py-1 focus:outline-none text-xs ${ 
                                                        hasError 
                                                        ? 'bg-red-50 border-red-500 text-red-900 focus:ring-1 focus:ring-red-500' 
                                                        : 'bg-white border-blue-400'
                                                    }`}
                                                    autoFocus
                                                />
                                                <div className="flex flex-col gap-0.5">
                                                    <button onClick={handleSaveEdit} className="p-0.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-3 h-3" /></button>
                                                    <button onClick={handleCancelEdit} className="p-0.5 text-red-600 hover:bg-red-50 rounded"><X className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            col === 'Symbol' ? (
                                                <div className="flex flex-col w-full min-h-[20px]">
                                                    <span className="block font-medium">{val}</span>
                                                    {val && metadata && (() => {
                                                        const mVal = metadata[val];
                                                        let assetClass = null;
                                                        let description = null;
                                                        if (mVal) {
                                                            if (typeof mVal === 'object') {
                                                                assetClass = mVal.assetClass || null;
                                                                if (typeof assetClass === 'object' && assetClass !== null && Object.keys(assetClass).length === 0) {
                                                                    assetClass = null;
                                                                }
                                                                description = mVal.description || null;
                                                                if (!('assetClass' in mVal) && !('description' in mVal)) {
                                                                    if (Object.keys(mVal).length > 0) assetClass = mVal;
                                                                }
                                                            } else {
                                                                assetClass = mVal;
                                                            }
                                                        }

                                                        if (!assetClass) {
                                                            assetClass = "Unknown";
                                                        }

                                                        const isSplit = typeof assetClass === 'object' && assetClass !== null;

                                                        return (
                                                            <div className="flex flex-col gap-0.5 mt-1">
                                                                {description && <span className="text-[10px] text-gray-500 leading-tight">{description}</span>}
                                                                {isSplit ? (
                                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                                        {Object.entries(assetClass).map(([k, v]) => (
                                                                            <span key={k} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium leading-none ${k === 'Unknown' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-gray-800'}`}>
                                                                                {k}: {Math.round(v*100)}%
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium leading-none w-max ${assetClass === 'Unknown' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-gray-800'}`}>
                                                                        {assetClass}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <span className="block w-full min-h-[20px]">{val}</span>
                                            )
                                        )}
                                    </td>
                                );
                            })}
                            <td className="px-2 py-2 text-right">
                                <button 
                                    onClick={() => handleRemoveRow(rowIndex)}
                                    className="text-gray-400 hover:text-red-500 p-1 rounded"
                                    disabled={!!editingCell}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {addingRow && (
                        <tr className="bg-blue-50/30">
                             {requiredColumns.map(col => {
                                let listId = undefined;
                                if (col === 'Account Name') listId = 'account-suggestions';
                                if (col === 'Symbol') listId = 'symbol-suggestions';

                                const hasError = addingRowErrors[col];

                                return (
                                    <td key={`new-${col}`} className="px-3 py-2 text-sm">
                                        <input 
                                            type="text" 
                                            value={addingRow[col]}
                                            list={listId}
                                            onChange={(e) => handleAddingRowChange(col, e.target.value)}
                                            onKeyDown={handleAddingRowKeyDown}
                                            onBlur={() => handleAddingRowBlur(col)}
                                            className={`w-full border-b focus:outline-none px-1 py-0.5 rounded-sm ${ 
                                                hasError
                                                ? 'bg-red-50 border-red-500 text-red-900 focus:border-red-600' 
                                                : 'bg-white border-blue-300 focus:border-blue-500'
                                            }`}
                                            placeholder={col}
                                            autoFocus={col === 'Account Name'}
                                        />
                                    </td>
                                );
                            })}
                            <td className="px-2 py-2 text-right">
                                <div className="flex justify-end gap-1">
                                    <button 
                                        onClick={handleConfirmAddRow}
                                        className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                                        title="Confirm"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={handleCancelAddRow}
                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                        title="Cancel"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            <div className="p-3 border-t border-gray-200 bg-gray-50 sticky bottom-0 z-10">
                {!addingRow && (
                    <button 
                        onClick={handleStartAddRow}
                        className={`text-xs flex items-center gap-1 font-medium ${ 
                            editingCell 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-blue-600 hover:text-blue-700'
                        }`}
                        disabled={!!editingCell}
                    >
                        <Plus className="w-3 h-3" /> Add Position Row
                    </button>
                )}
            </div>
        </div>
      )}
    </div>
  );
});

export default CsvManager;
