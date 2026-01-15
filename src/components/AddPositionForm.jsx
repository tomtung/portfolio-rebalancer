import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const AddPositionForm = ({ accounts, onAddPosition }) => {
  const [account, setAccount] = useState('');
  const [symbol, setSymbol] = useState('');
  const [targetValue, setTargetValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!account || !symbol || !targetValue) return;
    onAddPosition(account, symbol, parseFloat(targetValue));
    setSymbol('');
    setTargetValue('');
  };

  const accountNames = [...new Set(accounts.map(a => a.name))];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5 text-blue-600" />
        Add or Update Position
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
          <input 
            type="text" 
            list="account-list"
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. Individual"
            value={account}
            onChange={e => setAccount(e.target.value)}
          />
          <datalist id="account-list">
            {accountNames.map(name => <option key={name} value={name} />)}
          </datalist>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-700 mb-1">Symbol</label>
          <input 
            type="text" 
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
            placeholder="e.g. AAPL"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-700 mb-1">Target Total Value ($)</label>
          <input 
            type="number" 
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="0.00"
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
          />
        </div>
        <button 
          type="submit"
          className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Update Allocation
        </button>
      </form>
    </div>
  );
};

export default AddPositionForm;
