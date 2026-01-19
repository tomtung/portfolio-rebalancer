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
import MetadataManager from './components/MetadataManager';
import CsvManager from './components/CsvManager';

export default function App() {
  const [rawData, setRawData] = usePersistentString('portfolio_csv_v2', INITIAL_CSV_DATA);
  const [rawMetadata, setRawMetadata] = usePersistentString('portfolio_meta_v2', INITIAL_METADATA_JSON);
  const [adjustments, setAdjustments] = usePersistentObject('portfolio_adj_v2', {}); 
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('visualize');
  
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
      setError(err.message || "Failed to process data. Please check CSV format.");
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

  // Extract all unique symbols for the asset class manager
  const allSymbols = useMemo(() => {
      const symbols = new Set();
      mergedAccounts.forEach(account => {
          account.positions.forEach(pos => symbols.add(pos.Symbol));
      });
      return Array.from(symbols).sort();
  }, [mergedAccounts]);

  // 3. Apply Adjustments
  const simulatedAccounts = useMemo(() => {
    const currentAdjustments = activeTab === 'rebalance' ? adjustments : {};
    return mergedAccounts.map(account => {
      let accountTotalAdjustment = 0;
      const positionsWithAdjustments = account.positions.map(pos => {
        const key = `${account.name}-${pos.Symbol}`;
        const adjustment = currentAdjustments[key] || 0;
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
  }, [mergedAccounts, adjustments, activeTab]);

  const totalPortfolioValue = simulatedAccounts.reduce((sum, acc) => sum + acc.simulatedTotalValue, 0);
  const originalPortfolioValue = simulatedAccounts.reduce((sum, acc) => sum + acc.originalTotalValue, 0);
  const totalPortfolioAdjustment = simulatedAccounts.reduce((sum, acc) => sum + acc.totalAdjustment, 0);
  const { assetClasses, assetClassDetails } = useMemo(() => calculateAllocations(simulatedAccounts, metadata), [simulatedAccounts, metadata]);
  const globalColors = useMemo(() => generateColorMap(assetClasses), [assetClasses]);

  const handleAdjustmentChange = (accountName, symbol, value) => {
    const key = `${accountName}-${symbol}`;
    let numValue = parseFloat(value);

    // Find original value to validate
    const account = mergedAccounts.find(a => a.name === accountName);
    const position = account?.positions.find(p => p.Symbol === symbol);
    const originalValue = position?.OriginalValue || 0;

    if (!isNaN(numValue) && (originalValue + numValue < 0)) {
        numValue = -originalValue;
    }

    setAdjustments(prev => {
      const next = { ...prev };
      if (isNaN(numValue) || numValue === 0) delete next[key];
      else next[key] = numValue;
      return next;
    });
  };

  const handleResetAccount = (accountName) => {
      setAdjustments(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
              if (key.startsWith(`${accountName}-`)) {
                  delete next[key];
              }
          });
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
      if (confirmAction === 'meta') return "Are you sure you want to reset the asset class metadata to defaults? This will overwrite your changes.";
      return "";
  };

  return (
    <div className={`min-h-screen p-4 md:p-12 font-sans transition-colors duration-700 ${activeTab === 'rebalance' ? 'bg-[#f0f4f8]' : 'bg-[#fcfcfd]'}`}>
      <div className="max-w-7xl mx-auto space-y-10"> 
        
        {/* Reset Modal */}
        <ConfirmModal 
            isOpen={!!confirmAction}
            title="Confirm Reset"
            message={getConfirmMessage()}
            onConfirm={confirmReset}
            onCancel={() => setConfirmAction(null)}
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                <PieChart className="w-8 h-8 text-white" />
              </div>
              Portfolio Rebalance Helper
            </h1>
            <p className="text-gray-500 text-sm mt-2 font-medium tracking-wide uppercase">
              Local in-browser asset allocation simulation
            </p>
          </div>
          <div className="flex items-center gap-4">
             {/* Mode Switch - High Class Version */}
             <div className="bg-gray-200/50 p-1.5 rounded-full flex items-center backdrop-blur-sm border border-white/50 shadow-inner">
                <button
                    onClick={() => setActiveTab('visualize')}
                    className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${
                        activeTab === 'visualize' 
                        ? 'bg-white text-blue-600 shadow-md scale-105' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Visualize
                </button>
                <button
                    onClick={() => setActiveTab('rebalance')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${
                        activeTab === 'rebalance' 
                        ? 'bg-white text-blue-600 shadow-md scale-105' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Rebalance
                </button>
             </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 p-4 text-red-700 flex items-center gap-2 rounded-r-lg shadow-sm">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* CSV & JSON Editors (Stacked) - Only in Visualize - NOW ABOVE CHART */}
        {activeTab === 'visualize' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                <details className="group p-6 hover:bg-gray-50/50 transition-colors">
                    <summary className="cursor-pointer text-sm font-bold text-gray-500 group-hover:text-gray-900 select-none flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                <FileText className="w-5 h-5 group-hover:text-blue-600 transition-colors" />
                            </div>
                            <span>Portfolio Data (CSV)</span>
                        </div>
                        <div className="text-xs font-normal opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest text-blue-600">Edit</div>
                    </summary>
                    <div className="mt-6 pt-6 border-t border-gray-50">
                        <CsvManager 
                            csvData={rawData}
                            onUpdateCsv={setRawData}
                            onReset={() => setConfirmAction('csv')}
                            metadata={metadata}
                            onUpdateMetadata={(newMeta) => setRawMetadata(JSON.stringify(newMeta, null, 2))}
                        />
                    </div>
                </details>

                <details className="group p-6 hover:bg-gray-50/50 transition-colors">
                    <summary className="cursor-pointer text-sm font-bold text-gray-500 group-hover:text-gray-900 select-none flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                <Tag className="w-5 h-5 group-hover:text-blue-600 transition-colors" />
                            </div>
                            <span>Symbol Metadata (JSON)</span>
                        </div>
                        <div className="text-xs font-normal opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest text-blue-600">Edit</div>
                    </summary>
                    <div className="mt-6 pt-6 border-t border-gray-50">
                        <MetadataManager 
                            symbols={allSymbols} 
                            metadata={metadata} 
                            onUpdateMetadata={(newMeta) => setRawMetadata(JSON.stringify(newMeta, null, 2))}
                            onReset={() => setConfirmAction('meta')}
                        />
                    </div>
                </details>
            </div>
        )}

        {simulatedAccounts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
                <AllocationPieChart 
                  data={assetClasses} 
                  total={totalPortfolioValue} 
                  colors={globalColors} 
                  details={assetClassDetails}
                  headerContent={
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Portfolio Allocation</h2>
                            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Asset Breakdown</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <div className="text-3xl font-bold text-gray-900 leading-tight tracking-tighter">{formatCurrency(totalPortfolioValue)}</div>
                            <div className="flex items-center gap-3 mt-1">
                                {totalPortfolioAdjustment !== 0 && (
                                    <>
                                        <span className="text-sm text-gray-400 line-through font-medium">{formatCurrency(originalPortfolioValue)}</span>
                                        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${totalPortfolioAdjustment > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                            {totalPortfolioAdjustment > 0 ? '+' : ''}{formatCurrency(totalPortfolioAdjustment)}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-2">Total Portfolio Value</div>
                            {activeTab === 'rebalance' && Object.keys(adjustments).length > 0 && (
                                <button 
                                    onClick={() => setConfirmAction('sim')}
                                    className="mt-4 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-red-500 hover:text-red-600 bg-red-50/50 hover:bg-red-50 px-3 py-1.5 rounded-full border border-red-100 transition-all duration-300"
                                >
                                    <RefreshCw className="w-3 h-3" /> Reset Adjustments
                                </button>
                            )}
                        </div>
                    </div>
                  }
                />
            </div>
        )}

        <div className="space-y-8">
            {simulatedAccounts.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center p-20 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <AlertCircle className="w-12 h-12 mb-4 opacity-10" />
                <p className="font-medium tracking-wide uppercase text-xs">No active positions detected</p>
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
                onResetAccount={handleResetAccount}
                metadata={metadata}
                colors={globalColors}
                showAdjustment={activeTab === 'rebalance'}
                />
            ))
            )}
        </div>

      </div>
    </div>
  );
}