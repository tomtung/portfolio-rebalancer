export const parseCurrency = (str) => {
  if (!str) return 0;
  let cleanStr = str.toString().trim();
  if (cleanStr === '--') return 0;
  const isNegative = cleanStr.includes('-') || (cleanStr.startsWith('(') && cleanStr.endsWith(')'));
  cleanStr = cleanStr.replace(/[$,\s()]/g, '').replace('+', '');
  const val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : (isNegative ? -Math.abs(val) : val);
};

export const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
export const formatPercent = (num) => new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num / 100);
