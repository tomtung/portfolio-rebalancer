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
    const description = getValue(rowObj, 'Description');
    const rawValue = getValue(rowObj, 'Current value');

    const numericValue = parseCurrency(rawValue);
    // We used to skip 0 value rows, but now we keep them so users can make adjustments.

    if (accountName === 'Waymo WMU') symbol = 'WMU';
    
    // Ignore rows where either account name or symbol is missing
    if (!accountName || !symbol) continue;

    if (!processedAccounts[accountName]) {
      processedAccounts[accountName] = { totalValue: 0, positions: {} };
    }

    const account = processedAccounts[accountName];
    account.totalValue += numericValue;

    if (!account.positions[symbol]) {
      account.positions[symbol] = {
        Symbol: symbol,
        Description: description,
        OriginalValue: 0,
      };
    }
    account.positions[symbol].OriginalValue += numericValue;
  }

  return processedAccounts; 
};
