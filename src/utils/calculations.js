export const getAssetClassRatios = (symbol, metadata) => {
  const rawMeta = metadata[symbol];
  if (!rawMeta) return { "Unknown": 1.0 }; 
  
  let assetClassData;
  if (typeof rawMeta === 'object' && rawMeta !== null) {
      if ('assetClass' in rawMeta) {
          assetClassData = rawMeta.assetClass;
      } else if ('description' in rawMeta) {
          // New structure but missing assetClass key altogether
          assetClassData = "Unknown";
      } else {
          // Assume old split format: { "Cat A": 0.5, "Cat B": 0.5 }
          assetClassData = rawMeta;
      }
  } else {
      assetClassData = rawMeta;
  }

  if (!assetClassData || (typeof assetClassData === 'object' && Object.keys(assetClassData).length === 0)) {
      return { "Unknown": 1.0 };
  }

  if (typeof assetClassData === 'string') return { [assetClassData.trim() || "Unknown"]: 1.0 };
  
  // For split allocations, ensure no empty keys
  const sanitized = {};
  Object.entries(assetClassData).forEach(([k, v]) => {
      sanitized[k.trim() || "Unknown"] = v;
  });
  
  if (Object.keys(sanitized).length === 0) return { "Unknown": 1.0 };
  return sanitized;
};

export const calculateAssetClassStats = (positions, metadata) => {
  const assetClasses = {};
  const assetClassDetails = {}; 
  let totalValue = 0;
  
  positions.forEach(pos => {
      totalValue += pos.SimulatedValue;
      const ratios = getAssetClassRatios(pos.Symbol, metadata);
      
      Object.entries(ratios).forEach(([assetClass, ratio]) => {
          const contributedValue = pos.SimulatedValue * ratio;
          assetClasses[assetClass] = (assetClasses[assetClass] || 0) + contributedValue;

          if (!assetClassDetails[assetClass]) {
              assetClassDetails[assetClass] = { total: 0, symbolMap: {} };
          }
          assetClassDetails[assetClass].total += contributedValue;
          
          if (!assetClassDetails[assetClass].symbolMap[pos.Symbol]) {
              assetClassDetails[assetClass].symbolMap[pos.Symbol] = 0;
          }
          assetClassDetails[assetClass].symbolMap[pos.Symbol] += contributedValue;
      });
  });

  Object.keys(assetClassDetails).forEach(cat => {
      const map = assetClassDetails[cat].symbolMap;
      const sorted = Object.entries(map)
          .map(([sym, val]) => ({ symbol: sym, value: val }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5); 
      assetClassDetails[cat].topSymbols = sorted;
      delete assetClassDetails[cat].symbolMap; 
  });

  return { assetClasses, assetClassDetails, totalValue };
};

export const calculateAllocations = (accounts, metadata) => {
  const assetClasses = {};
  const assetClassDetails = {}; 
  let totalValue = 0;

  accounts.forEach(account => {
    account.positions.forEach(pos => {
      totalValue += pos.SimulatedValue;
      const ratios = getAssetClassRatios(pos.Symbol, metadata);

      Object.entries(ratios).forEach(([assetClass, ratio]) => {
          const contributedValue = pos.SimulatedValue * ratio;
          assetClasses[assetClass] = (assetClasses[assetClass] || 0) + contributedValue;

          if (!assetClassDetails[assetClass]) {
              assetClassDetails[assetClass] = { total: 0, symbolMap: {} };
          }
          assetClassDetails[assetClass].total += contributedValue;
          
          if (!assetClassDetails[assetClass].symbolMap[pos.Symbol]) {
              assetClassDetails[assetClass].symbolMap[pos.Symbol] = 0;
          }
          assetClassDetails[assetClass].symbolMap[pos.Symbol] += contributedValue;
      });
    });
  });

  Object.keys(assetClassDetails).forEach(cat => {
      const map = assetClassDetails[cat].symbolMap;
      const sorted = Object.entries(map)
          .map(([sym, val]) => ({ symbol: sym, value: val }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5); 
      assetClassDetails[cat].topSymbols = sorted;
      delete assetClassDetails[cat].symbolMap; 
  });

  return { assetClasses, assetClassDetails, totalValue };
};

export const sortAssetClassesByValue = (data) => {
  const topLevelTotals = {};
  const keys = Object.keys(data);

  keys.forEach(key => {
    const topLevel = key.split(' / ')[0];
    topLevelTotals[topLevel] = (topLevelTotals[topLevel] || 0) + data[key];
  });

  return keys.sort((a, b) => {
    const topA = a.split(' / ')[0];
    const topB = b.split(' / ')[0];

    // Primary sort: Top-level asset class total value (Descending)
    if (topA !== topB) {
      return topLevelTotals[topB] - topLevelTotals[topA];
    }
    
    // Secondary sort: Sub-asset class name (Alphabetical Ascending)
    return a.localeCompare(b);
  });
};