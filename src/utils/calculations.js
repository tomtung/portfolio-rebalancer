export const getCategoryRatios = (symbol, metadata) => {
  const meta = metadata[symbol];
  if (!meta) return { "Unknown": 1.0 }; 
  if (typeof meta === 'string') return { [meta]: 1.0 };
  return meta; 
};

export const calculateCategoryStats = (positions, metadata) => {
  const categories = {};
  const categoryDetails = {}; 
  let totalValue = 0;
  
  positions.forEach(pos => {
      totalValue += pos.SimulatedValue;
      const ratios = getCategoryRatios(pos.Symbol, metadata);
      
      Object.entries(ratios).forEach(([category, ratio]) => {
          const contributedValue = pos.SimulatedValue * ratio;
          categories[category] = (categories[category] || 0) + contributedValue;

          if (!categoryDetails[category]) {
              categoryDetails[category] = { total: 0, symbolMap: {} };
          }
          categoryDetails[category].total += contributedValue;
          
          if (!categoryDetails[category].symbolMap[pos.Symbol]) {
              categoryDetails[category].symbolMap[pos.Symbol] = 0;
          }
          categoryDetails[category].symbolMap[pos.Symbol] += contributedValue;
      });
  });

  Object.keys(categoryDetails).forEach(cat => {
      const map = categoryDetails[cat].symbolMap;
      const sorted = Object.entries(map)
          .map(([sym, val]) => ({ symbol: sym, value: val }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5); 
      categoryDetails[cat].topSymbols = sorted;
      delete categoryDetails[cat].symbolMap; 
  });

  return { categories, categoryDetails, totalValue };
};

export const calculateAllocations = (accounts, metadata) => {
  const categories = {};
  const categoryDetails = {}; 
  let totalValue = 0;

  accounts.forEach(account => {
    account.positions.forEach(pos => {
      totalValue += pos.SimulatedValue;
      const ratios = getCategoryRatios(pos.Symbol, metadata);

      Object.entries(ratios).forEach(([category, ratio]) => {
          const contributedValue = pos.SimulatedValue * ratio;
          categories[category] = (categories[category] || 0) + contributedValue;

          if (!categoryDetails[category]) {
              categoryDetails[category] = { total: 0, symbolMap: {} };
          }
          categoryDetails[category].total += contributedValue;
          
          if (!categoryDetails[category].symbolMap[pos.Symbol]) {
              categoryDetails[category].symbolMap[pos.Symbol] = 0;
          }
          categoryDetails[category].symbolMap[pos.Symbol] += contributedValue;
      });
    });
  });

  Object.keys(categoryDetails).forEach(cat => {
      const map = categoryDetails[cat].symbolMap;
      const sorted = Object.entries(map)
          .map(([sym, val]) => ({ symbol: sym, value: val }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5); 
      categoryDetails[cat].topSymbols = sorted;
      delete categoryDetails[cat].symbolMap; 
  });

  return { categories, categoryDetails, totalValue };
};

export const sortCategoriesByValue = (data) => {
  const topLevelTotals = {};
  const keys = Object.keys(data);

  keys.forEach(key => {
    const topLevel = key.split(' / ')[0];
    topLevelTotals[topLevel] = (topLevelTotals[topLevel] || 0) + data[key];
  });

  return keys.sort((a, b) => {
    const topA = a.split(' / ')[0];
    const topB = b.split(' / ')[0];

    if (topA !== topB) {
      return topLevelTotals[topB] - topLevelTotals[topA];
    }
    return data[b] - data[a];
  });
};
