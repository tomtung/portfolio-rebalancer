import React, { useState, useMemo } from 'react';
import { FileText, RefreshCw, AlertCircle, PieChart, Tag } from 'lucide-react';

import { INITIAL_CSV_DATA, INITIAL_METADATA_JSON } from './data/initialData';
import { processData } from './utils/csvParser';
import { calculateAllocations } from './utils/calculations';
import { generateColorMap } from './utils/colors';
import { formatCurrency } from './utils/currency';

import { usePersistentString } from './hooks/usePersistentString';
import { usePersistentObject } from './hooks/usePersistentObject';

import ConfirmModal from './components/ConfirmModal';
import AutoResizingTextarea from './components/AutoResizingTextarea';
import AllocationPieChart from './components/AllocationPieChart';
import AccountTable from './components/AccountTable';
import AddPositionForm from './components/AddPositionForm';

export default function App() {
  const [rawData, setRawData] = usePersistentString('portfolio_csv_v1', INITIAL_CSV_DATA);
  const [rawMetadata, setRawMetadata] = usePersistentString('portfolio_meta_v1', INITIAL_METADATA_JSON);
  const [adjustments, setAdjustments] = usePersistentObject('portfolio_adj_v1', {}); 
  const [newPositions, setNewPositions] = usePersistentObject('portfolio_pos_v1', {}); 
  const [error, setError] = useState(null);
  
  // Modal State
  const [confirmAction, setConfirmAction] = useState(null); // 'sim', 'csv', 'meta', null

  // 1. Parse CSV (Immutable source)
  const parsedAccountsMap = useMemo(() => {
    try {
      const data = processData(rawData);
      setError(null);
      return data;
    } catch (err) {
      console.error("Processing error:", err);
      setError("Failed to process data. Please check CSV format.");
      return {};
    }
  }, [rawData]);

  const metadata = useMemo(() => {
    try { return JSON.parse(rawMetadata); } catch (e) { return {}; }
  }, [rawMetadata]);

  // 2. Merge Manual Positions into Data Structure
  const mergedAccounts = useMemo(() => {
    // Deep copy to avoid mutating original
    const merged = JSON.parse(JSON.stringify(parsedAccountsMap));

    Object.entries(newPositions).forEach(([key, row]) => {
       if (!merged[row.accountName]) {
         merged[row.accountName] = { totalValue: 0, positions: {} };
       }
       
       if (!merged[row.accountName].positions[row.Symbol]) {
          merged[row.accountName].positions[row.Symbol] = {
             Symbol: row.Symbol,
             Description: "Manual Entry",
             OriginalValue: 0,
             isManual: true 
          };
       }
    });
    
    // Convert back to array for rendering
    return Object.keys(merged).map(accountName => {
        const accountData = merged[accountName];
        const positionsArray = Object.values(accountData.positions)
          .sort((a, b) => b.OriginalValue - a.OriginalValue);
    
        // If manual removal left an empty account, exclude it
        if (positionsArray.length === 0) return null;

        return {
          name: accountName,
          originalTotalValue: accountData.totalValue,
          positions: positionsArray
        };
      }).filter(Boolean); // Filter out nulls
  }, [parsedAccountsMap, newPositions]);

  // 3. Apply Adjustments
  const simulatedAccounts = useMemo(() => {
    return mergedAccounts.map(account => {
      let accountTotalAdjustment = 0;
      const positionsWithAdjustments = account.positions.map(pos => {
        const key = `${account.name}-${pos.Symbol}`;
        const adjustment = adjustments[key] || 0;
        accountTotalAdjustment += adjustment;
        return {
          ...pos,
          adjustment,
          SimulatedValue: pos.OriginalValue + adjustment
        };
      });
      const simulatedTotalValue = account.originalTotalValue + accountTotalAdjustment;
      const finalPositions = positionsWithAdjustments.map(pos => ({
        ...pos,
        PercentOfAccount: simulatedTotalValue > 0 ? (pos.SimulatedValue / simulatedTotalValue) * 100 : 0
      }));
      return {
        ...account,
        simulatedTotalValue,
        positions: finalPositions
      };
    });
  }, [mergedAccounts, adjustments]);

  const totalPortfolioValue = simulatedAccounts.reduce((sum, acc) => sum + acc.simulatedTotalValue, 0);
  const { categories, categoryDetails } = useMemo(() => calculateAllocations(simulatedAccounts, metadata), [simulatedAccounts, metadata]);
  const globalColors = useMemo(() => generateColorMap(categories), [categories]);

  const handleAdjustmentChange = (accountName, symbol, value) => {
    const key = `${accountName}-${symbol}`;
    const numValue = parseFloat(value);
    setAdjustments(prev => {
      const next = { ...prev };
      if (isNaN(numValue) || numValue === 0) delete next[key];
      else next[key] = numValue;
      return next;
    });
  };

  const handleAddPosition = (accountName, symbol, targetValue) => {
     let originalValue = 0;
     const accountInCsv = parsedAccountsMap[accountName];
     if (accountInCsv && accountInCsv.positions[symbol]) {
        originalValue = accountInCsv.positions[symbol].OriginalValue;
     } else {
        const key = `${accountName}-${symbol}`;
        setNewPositions(prev => ({
            ...prev,
            [key]: { accountName, Symbol: symbol }
        }));
     }

     const adjustment = targetValue - originalValue;
     const key = `${accountName}-${symbol}`;
     setAdjustments(prev => ({
         ...prev,
         [key]: adjustment
     }));
  };

  const handleRemovePosition = (accountName, symbol) => {
    const key = `${accountName}-${symbol}`;
    setNewPositions(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
    });
    setAdjustments(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
    });
  };

  const confirmReset = () => {
      if (confirmAction === 'sim') {
          setAdjustments({});
          setNewPositions({});
      } else if (confirmAction === 'csv') {
          setRawData(INITIAL_CSV_DATA);
      } else if (confirmAction === 'meta') {
          setRawMetadata(INITIAL_METADATA_JSON);
      }
      setConfirmAction(null);
  };

  const getConfirmMessage = () => {
      if (confirmAction === 'sim') return "Are you sure you want to clear all simulation adjustments and manually added positions?";
      if (confirmAction === 'csv') return "Are you sure you want to reset the CSV data to the default demo data? This will overwrite your changes.";
      if (confirmAction === 'meta') return "Are you sure you want to reset the category metadata to defaults? This will overwrite your changes.";
      return "";
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6"> 
        
        {/* Reset Modal */}
        <ConfirmModal 
            isOpen={!!confirmAction}
            title="Confirm Reset"
            message={getConfirmMessage()}
            onConfirm={confirmReset}
            onCancel={() => setConfirmAction(null)}
        />

        {/* Header */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 opacity-95 backdrop-blur-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PieChart className="w-6 h-6 text-blue-600" />
              Portfolio Allocator
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Visualize positions and simulate rebalancing.
            </p>
          </div>
          <div className="flex items-center gap-6">
             {(Object.keys(adjustments).length > 0 || Object.keys(newPositions).length > 0) && (
                 <button 
                    onClick={() => setConfirmAction('sim')}
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors"
                 >
                     <RefreshCw className="w-4 h-4" /> Reset Simulation
                 </button>
             )}
             <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalPortfolioValue)}</div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Simulated Portfolio Value</div>
             </div>
          </div>
        </div>

        {/* CSV & JSON Editors (Stacked) */}
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <details>
                <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none flex items-center gap-2">
                <FileText className="w-4 h-4" /> Edit Raw CSV Data
                </summary>
                <div className="mt-4">
                <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-600">
                    <p className="font-semibold mb-1">Expected Format:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Standard CSV format with headers on the first line.</li>
                        <li><strong>Fidelity Users:</strong> The "Positions" export works directly.</li>
                        <li>Required columns: <code>Account Name</code>, <code>Symbol</code>, <code>Description</code>, <code>Current value</code>.</li>
                        <li>Non-required columns are ignored. Currency values can include '$' and ','.</li>
                    </ul>
                </div>
                <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-400">Paste your CSV export below</span>
                    <button 
                        onClick={() => setConfirmAction('csv')}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" /> Reset
                    </button>
                </div>
                <AutoResizingTextarea
                    value={rawData}
                    onChange={(e) => setRawData(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none whitespace-pre overflow-x-auto"
                />
                </div>
            </details>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <details>
                <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none flex items-center gap-2">
                <Tag className="w-4 h-4" /> Edit Symbol Categories (JSON)
                </summary>
                <div className="mt-4">
                <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-600">
                    <p className="font-semibold mb-1">Expected JSON Format:</p>
                    <p className="mb-2">A dictionary where keys are Symbols.</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>Simple Category:</strong> <code>"AAPL": "US Equities / Large Cap"</code></li>
                        <li><strong>Split Allocation:</strong> <code>"VTI": &#123; "US Equities / Large Cap": 0.8, "US Equities / Mid Cap": 0.2 &#125;</code></li>
                        <li>Use " / " to create sub-categories for automatic color grouping.</li>
                    </ul>
                </div>
                <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-400">Map symbols to categories</span>
                    <button 
                        onClick={() => setConfirmAction('meta')}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" /> Reset
                    </button>
                </div>
                <AutoResizingTextarea
                    value={rawMetadata}
                    onChange={(e) => setRawMetadata(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none whitespace-pre overflow-x-auto"
                />
                </div>
            </details>
            </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {simulatedAccounts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
                <AllocationPieChart 
                  data={categories} 
                  total={totalPortfolioValue} 
                  colors={globalColors} 
                  details={categoryDetails}
                />
            </div>
        )}

        {simulatedAccounts.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-white rounded-lg border border-gray-200">
             <AlertCircle className="w-10 h-10 mb-3 opacity-20" />
             <p>No valid positions found. Check your data.</p>
          </div>
        ) : (
          simulatedAccounts.map(account => (
            <AccountTable 
              key={account.name} 
              name={account.name} 
              positions={account.positions} 
              totalValue={account.simulatedTotalValue}
              portfolioTotal={totalPortfolioValue}
              onAdjustmentChange={handleAdjustmentChange}
              onRemovePosition={handleRemovePosition}
              metadata={metadata}
              colors={globalColors}
            />
          ))
        )}

        {/* Add Position Form at the bottom of tables */}
        <AddPositionForm accounts={simulatedAccounts} onAddPosition={handleAddPosition} />

      </div>
    </div>
  );
}
