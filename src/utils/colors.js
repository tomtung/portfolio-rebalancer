export const COLOR_FAMILIES = [
  ['fill-blue-800 bg-blue-800', 'fill-blue-600 bg-blue-600', 'fill-blue-500 bg-blue-500', 'fill-blue-400 bg-blue-400', 'fill-indigo-600 bg-indigo-600', 'fill-indigo-400 bg-indigo-400'],
  ['fill-emerald-800 bg-emerald-800', 'fill-emerald-600 bg-emerald-600', 'fill-teal-600 bg-teal-600', 'fill-teal-500 bg-teal-500', 'fill-cyan-600 bg-cyan-600'],
  ['fill-orange-600 bg-orange-600', 'fill-orange-500 bg-orange-500', 'fill-amber-500 bg-amber-500', 'fill-yellow-500 bg-yellow-500'],
  ['fill-purple-800 bg-purple-800', 'fill-purple-600 bg-purple-600', 'fill-fuchsia-600 bg-fuchsia-600', 'fill-pink-500 bg-pink-500'],
  ['fill-rose-700 bg-rose-700', 'fill-rose-500 bg-rose-500', 'fill-red-500 bg-red-500', 'fill-red-400 bg-red-400'],
  ['fill-stone-600 bg-stone-600', 'fill-gray-500 bg-gray-500', 'fill-slate-400 bg-slate-400'],
  ['fill-lime-600 bg-lime-600', 'fill-green-600 bg-green-600', 'fill-green-500 bg-green-500'],
];

export const UNKNOWN_COLOR = 'fill-gray-300 bg-gray-300';

export const getPaletteGroup = (category) => {
  if (!category || category === 'Unknown') return 'Unknown';
  const firstWord = category.split(' ')[0];
  if (firstWord === 'US') return 'US';
  if (firstWord === 'Intl') return 'Intl';
  if (firstWord === 'Cash') return 'Cash';
  if (firstWord === 'Target') return 'Target';
  if (category.includes('Bond')) return 'Bond';
  return 'Other';
};

export const getColorString = (category, indexInBroadGroup) => {
  if (!category || category === 'Unknown') return 'fill-gray-300 bg-gray-300';
  const group = getPaletteGroup(category);
  let familyIndex = 0;
  if (group === 'US') familyIndex = 0;
  else if (group === 'Intl') familyIndex = 1;
  else if (group === 'Bond') familyIndex = 5; 
  else if (group === 'Cash') familyIndex = 5; 
  else {
      const topLevel = category.split(' / ')[0];
      let hash = 0;
      for (let i = 0; i < topLevel.length; i++) hash = topLevel.charCodeAt(i) + ((hash << 5) - hash);
      familyIndex = Math.abs(hash) % COLOR_FAMILIES.length;
  }
  
  const palette = COLOR_FAMILIES[familyIndex];
  return palette[indexInBroadGroup % palette.length];
};

export const generateColorMap = (categoriesData) => {
  const categoryKeys = Object.keys(categoriesData).sort();
  const topLevels = new Set();
  const structure = {}; 

  categoryKeys.forEach(cat => {
    const parts = cat.split(' / ');
    const top = parts[0] || 'Unclassified';
    topLevels.add(top);
    if (!structure[top]) structure[top] = [];
    structure[top].push(cat);
  });

  const sortedTopLevels = Array.from(topLevels).sort();
  const map = {};

  sortedTopLevels.forEach((top, index) => {
    if (top === 'Unknown' || top === 'Unclassified') {
        structure[top].forEach(cat => map[cat] = UNKNOWN_COLOR);
        return;
    }

    let familyIndex = 0;
    if (top.startsWith('US')) familyIndex = 0; 
    else if (top.startsWith('Intl')) familyIndex = 1; 
    else if (top.includes('Bond') || top.includes('Fixed')) familyIndex = 5; 
    else if (top.includes('Cash')) familyIndex = 5; 
    else if (top.includes('Commodities')) familyIndex = 2; 
    else if (top.includes('Alt')) familyIndex = 4; 
    else {
        familyIndex = (index + 2) % COLOR_FAMILIES.length; 
    }

    const familyPalette = COLOR_FAMILIES[familyIndex];
    const subCats = structure[top].sort(); 
    
    subCats.forEach((cat, subIndex) => {
       const shadeIndex = subIndex % familyPalette.length;
       map[cat] = familyPalette[shadeIndex];
    });
  });

  return map;
};
