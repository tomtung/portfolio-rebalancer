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
import CategoryManager from './components/CategoryManager';
import CsvManager from './components/CsvManager';

export default function App() {
  const [rawData, setRawData] = usePersistentString('portfolio_csv_v1', INITIAL_CSV_DATA);
  const [rawMetadata, setRawMetadata] = usePersistentString('portfolio_meta_v1', INITIAL_METADATA_JSON);
  const [adjustments, setAdjustments] = usePersistentObject('portfolio_adj_v1', {}); 
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

  // 2. Simplify mergedAccounts (No longer merging manual positions)
  const mergedAccounts = useMemo(() => {
    // Convert back to array for rendering
    return Object.keys(parsedAccountsMap).map(accountName => {
        const accountData = parsedAccountsMap[accountName];
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
  }, [parsedAccountsMap]);

  // Extract all unique symbols for the category manager
  const allSymbols = useMemo(() => {
      const symbols = new Set();
      mergedAccounts.forEach(account => {
          account.positions.forEach(pos => symbols.add(pos.Symbol));
      });
      return Array.from(symbols).sort();
  }, [mergedAccounts]);

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
        totalAdjustment: accountTotalAdjustment,
        positions: finalPositions
      };
    });
  }, [mergedAccounts, adjustments]);

  const totalPortfolioValue = simulatedAccounts.reduce((sum, acc) => sum + acc.simulatedTotalValue, 0);
  const originalPortfolioValue = simulatedAccounts.reduce((sum, acc) => sum + acc.originalTotalValue, 0);
  const totalPortfolioAdjustment = simulatedAccounts.reduce((sum, acc) => sum + acc.totalAdjustment, 0);
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

  const confirmReset = () => {
      if (confirmAction === 'sim') {
          setAdjustments({});
      } else if (confirmAction === 'csv') {
          setRawData(INITIAL_CSV_DATA);
      } else if (confirmAction === 'meta') {
          setRawMetadata(INITIAL_METADATA_JSON);
      }
      setConfirmAction(null);
  };

  const getConfirmMessage = () => {
      if (confirmAction === 'sim') return "Are you sure you want to clear all simulation adjustments?";
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
             {Object.keys(adjustments).length > 0 && (
                 <button 
                    onClick={() => setConfirmAction('sim')}
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors"
                 >
                     <RefreshCw className="w-4 h-4" /> Reset Simulation
                 </button>
             )}
             <div className="text-right">
                <div className="flex flex-col items-end">
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalPortfolioValue)}</div>
                  {totalPortfolioAdjustment !== 0 && (
                     <div className="text-sm text-gray-400 line-through">{formatCurrency(originalPortfolioValue)}</div>
                  )}
                </div>
                {totalPortfolioAdjustment !== 0 && (
                  <div className={`text-sm font-medium ${totalPortfolioAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalPortfolioAdjustment > 0 ? '+' : ''}{formatCurrency(totalPortfolioAdjustment)}
                  </div>
                )}
                <div className="text-xs text-gray-400 uppercase tracking-wide">Portfolio Value</div>
             </div>
          </div>
        </div>

        {/* CSV & JSON Editors (Stacked) */}
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <details>
                    <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Edit Portfolio Data
                    </summary>
                    <div className="mt-4">
                        <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-600">
                            <p className="font-semibold mb-1">CSV Format Details:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Standard CSV format with headers on the first line.</li>
                                <li><strong>Fidelity Users:</strong> The "Positions" export works directly.</li>
                                <li>Required columns: <code>Account Name</code>, <code>Symbol</code>, <code>Description</code>, <code>Current value</code>.</li>
                                <li>Currency values can include '$' and ','.</li>
                            </ul>
                        </div>
                        <CsvManager 
                            csvData={rawData}
                            onUpdateCsv={setRawData}
                            onReset={() => setConfirmAction('csv')}
                        />
                    </div>
                </details>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <details>
                    <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none flex items-center gap-2">
                        <Tag className="w-4 h-4" /> Edit Symbol Categories
                    </summary>
                    <div className="mt-4">
                        <CategoryManager 
                            symbols={allSymbols} 
                            metadata={metadata} 
                            onUpdateMetadata={(newMeta) => setRawMetadata(JSON.stringify(newMeta, null, 2))}
                            onReset={() => setConfirmAction('meta')}
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
              originalTotalValue={account.originalTotalValue}
              totalAdjustment={account.totalAdjustment}
              portfolioTotal={totalPortfolioValue}
              onAdjustmentChange={handleAdjustmentChange}
              metadata={metadata}
              colors={globalColors}
            />
          ))
        )}

      </div>
    </div>
  );
}
