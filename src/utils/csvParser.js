import { parseCurrency } from './currency';

export const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuote = !inQuote;
    else if (char === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
};

export const processData = (csvText) => {
  if (!csvText) return {};
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return {};

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  
  const getValue = (rowObj, headerName) => {
    const key = Object.keys(rowObj).find(k => k.toLowerCase() === headerName.toLowerCase());
    return key ? rowObj[key] : '';
  };

  const processedAccounts = {};

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    if (!currentLine) continue;
    
    const values = parseCSVLine(currentLine);
    const rowObj = {};
    headers.forEach((header, index) => {
      let value = values[index] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      rowObj[header] = value;
    });

    const accountName = getValue(rowObj, 'Account Name');
    let symbol = getValue(rowObj, 'Symbol');
    const rawValue = getValue(rowObj, 'Current value');

    const numericValue = parseCurrency(rawValue);
    // We used to skip 0 value rows, but now we keep them so users can make adjustments.
    
    // Ignore rows where symbol is missing
    if (!symbol) continue;

    // Default to "Unknown Account" if account name is missing but symbol exists
    const effectiveAccountName = accountName || "Unknown Account";

    if (!processedAccounts[effectiveAccountName]) {
      processedAccounts[effectiveAccountName] = { totalValue: 0, positions: {} };
    }

    const account = processedAccounts[effectiveAccountName];
    account.totalValue += numericValue;

    if (!account.positions[symbol]) {
      account.positions[symbol] = {
        Symbol: symbol,
        OriginalValue: 0,
      };
    }
    account.positions[symbol].OriginalValue += numericValue;
  }

  // Validate for negative values after aggregation
  Object.keys(processedAccounts).forEach(accountName => {
    const account = processedAccounts[accountName];
    Object.keys(account.positions).forEach(symbol => {
      if (account.positions[symbol].OriginalValue < 0) {
        throw new Error(`Short positions not supported; found in account "${accountName}" for symbol "${symbol}"`);
      }
    });
  });

  return processedAccounts; 
};

export const normalizeCsv = (csvText, existingMetadata) => {
  if (!csvText.trim()) return { newCsv: '', newMetadata: existingMetadata, ignoredCount: 0 };

  const lines = csvText.trim().split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  
  const getIndex = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  
  const accountIdx = getIndex('Account Name');
  const symbolIdx = getIndex('Symbol');
  const valueIdx = getIndex('Current value');
  const descIdx = getIndex('Description');

  // We need at least these three
  if (accountIdx === -1 || symbolIdx === -1 || valueIdx === -1) {
    throw new Error("Missing required columns: Account Name, Symbol, Current value");
  }

  const aggregatedData = {}; // { "AccountName": { "Symbol": Value } }
  const newMetadata = { ...existingMetadata };
  let ignoredCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = parseCSVLine(line);
    const symbol = columns[symbolIdx]?.trim();

    if (!symbol) {
      ignoredCount++;
      continue;
    }

    const rawAccount = columns[accountIdx]?.trim();
    const accountName = rawAccount || "Unknown Account";
    
    // Clean and parse value
    let valStr = columns[valueIdx] || '0';
    if (valStr.startsWith('"') && valStr.endsWith('"')) valStr = valStr.slice(1, -1);
    const value = parseCurrency(valStr);

    // Initialize account map if needed
    if (!aggregatedData[accountName]) {
      aggregatedData[accountName] = {};
    }

    // Aggregate value
    aggregatedData[accountName][symbol] = (aggregatedData[accountName][symbol] || 0) + value;

    // Handle Description
    if (descIdx !== -1) {
      const description = columns[descIdx]?.trim();
      if (description) {
        const currentMeta = newMetadata[symbol];
        // If no metadata exists for this symbol, or it's just a category string/object without description
        // We want to add the description.
        
        if (!currentMeta) {
             // New entry
             newMetadata[symbol] = { description, category: "Unknown" };
        } else if (typeof currentMeta === 'string') {
             // Convert string category to object
             newMetadata[symbol] = { description, category: currentMeta };
        } else if (typeof currentMeta === 'object') {
            // It's an object, check if description is missing
            if (!currentMeta.description) {
                newMetadata[symbol] = { ...currentMeta, description };
            }
        }
      }
    }
  }

  // Validate negative values and build output rows
  const outputRows = [];
  
  const sortedAccounts = Object.keys(aggregatedData).sort();
  for (const account of sortedAccounts) {
    const symbols = Object.keys(aggregatedData[account]).sort();
    for (const sym of symbols) {
      const totalVal = aggregatedData[account][sym];
      if (totalVal < 0) {
        throw new Error(`Short positions not supported; found in account "${account}" for symbol "${sym}"`);
      }
      
      // Format value back to currency string for CSV
      // Using simple formatting logic to match expected CSV output
      const formattedValue = `"${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalVal)}"`;
      
      // Escape account and symbol if needed
      const escape = (s) => (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
      
      outputRows.push(`${escape(account)},${escape(sym)},${formattedValue}`);
    }
  }

  const newCsv = ['Account Name,Symbol,Current value', ...outputRows].join('\n');

  return { newCsv, newMetadata, ignoredCount };
};
