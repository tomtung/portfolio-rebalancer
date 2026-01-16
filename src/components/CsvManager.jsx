import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Code, RotateCcw } from 'lucide-react';
import { parseCSVLine } from '../utils/csvParser';
import AutoResizingTextarea from './AutoResizingTextarea';

export default function CsvManager({ csvData, onUpdateCsv, onReset }) {
  const [showRaw, setShowRaw] = useState(false);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [rawText, setRawText] = useState(csvData);

  // Sync internal raw text when prop changes (if not editing raw)
  useEffect(() => {
    setRawText(csvData);
  }, [csvData]);

  // Parse CSV into structured data
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
        setRows(parsedRows);
    }
  }, [rawText]);

  const requiredColumns = ['Account Name', 'Symbol', 'Current value'];
  
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

  const handleCellChange = (rowIndex, colIndex, value) => {
      const newRows = [...rows];
      newRows[rowIndex] = [...newRows[rowIndex]];
      newRows[rowIndex][colIndex] = value;
      setRows(newRows);
      
      const newCsv = generateCsvString(headers, newRows);
      onUpdateCsv(newCsv);
      setRawText(newCsv);
  };

  const handleCellBlur = (rowIndex, colIndex, colName) => {
      if (colName === 'Current value') {
          const row = rows[rowIndex];
          let val = row[colIndex];
          if (!val) return;

          // Remove existing formatting to check if it's a number
          const cleanVal = val.replace(/[$,]/g, '').trim();
          const num = parseFloat(cleanVal);

          if (!isNaN(num)) {
              // Re-format cleanly
              const formatted = new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: 'USD',
                  minimumFractionDigits: 2
              }).format(num);
              
              if (formatted !== val) {
                  handleCellChange(rowIndex, colIndex, formatted);
              }
          }
      }
  };

  const handleAddRow = () => {
      const newRow = new Array(headers.length).fill('');
      const newRows = [...rows, newRow];
      setRows(newRows);
      
      const newCsv = generateCsvString(headers, newRows);
      onUpdateCsv(newCsv);
      setRawText(newCsv);
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
             <button 
                onClick={onReset}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
                <RotateCcw className="w-3 h-3" /> Reset
            </button>
        </div>
      </div>

      {showRaw ? (
          <div className="p-4">
              <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-600">
                  <p className="font-semibold mb-1">CSV Format Details:</p>
                  <ul className="list-disc list-inside space-y-1">
                      <li>Standard CSV format with headers on the first line.</li>
                      <li><strong>Fidelity Users:</strong> The "Positions" export works directly.</li>
                      <li>Required columns: <code>Account Name</code>, <code>Symbol</code>, <code>Current value</code>.</li>
                      <li>Currency values can include '$' and ','.</li>
                  </ul>
              </div>
              <AutoResizingTextarea
                value={rawText}
                onChange={handleRawChange}
                className="w-full p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none whitespace-pre overflow-x-auto min-h-[300px]"
              />
          </div>
      ) : (
        <div className="overflow-x-auto">
            <datalist id="account-suggestions">
                {uniqueAccounts.map(a => <option key={a} value={a} />)}
            </datalist>
            <datalist id="symbol-suggestions">
                {uniqueSymbols.map(s => <option key={s} value={s} />)}
            </datalist>

            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                            Account Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                            Symbol
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Current value
                        </th>
                        <th className="w-10"></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                            {requiredColumns.map(col => {
                                const colIndex = columnIndices[col];
                                const val = row[colIndex] || '';
                                let listId = undefined;
                                if (col === 'Account Name') listId = 'account-suggestions';
                                if (col === 'Symbol') listId = 'symbol-suggestions';

                                let widthClass = "";
                                if (col === 'Account Name') widthClass = "w-1/3";
                                if (col === 'Symbol') widthClass = "w-1/4";

                                return (
                                    <td key={`${rowIndex}-${col}`} className={`px-3 py-2 text-sm ${widthClass}`}>
                                        <input 
                                            type="text" 
                                            value={val}
                                            list={listId}
                                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                            onBlur={() => handleCellBlur(rowIndex, colIndex, col)}
                                            className="w-full border-b border-transparent focus:border-blue-500 focus:outline-none bg-transparent"
                                            placeholder={col}
                                        />
                                    </td>
                                );
                            })}
                            <td className="px-2 py-2 text-right">
                                <button 
                                    onClick={() => handleRemoveRow(rowIndex)}
                                    className="text-gray-400 hover:text-red-500 p-1 rounded"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button 
                    onClick={handleAddRow}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                    <Plus className="w-3 h-3" /> Add Position Row
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
