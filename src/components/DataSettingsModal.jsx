import React, { useState } from 'react';
import { X, FileText, Tag } from 'lucide-react';
import CsvManager from './CsvManager';
import MetadataManager from './MetadataManager';

export default function DataSettingsModal({
  isOpen,
  onClose,
  csvData,
  onUpdateCsv,
  onResetCsv,
  metadata,
  onUpdateMetadata,
  onResetMeta,
  allSymbols
}) {
  const [activeTab, setActiveTab] = useState('csv');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Data Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">Edit portfolio positions and symbol metadata</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-100 bg-gray-50/30 px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'csv'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            Portfolio Data
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'metadata'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Tag className="w-4 h-4" />
            Symbol Metadata
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'csv' && (
            <CsvManager
              csvData={csvData}
              onUpdateCsv={onUpdateCsv}
              onReset={onResetCsv}
              metadata={metadata}
              onUpdateMetadata={onUpdateMetadata}
            />
          )}
          {activeTab === 'metadata' && (
            <MetadataManager
              symbols={allSymbols}
              metadata={metadata}
              onUpdateMetadata={onUpdateMetadata}
              onReset={onResetMeta}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
