// distinct palettes for broader coverage and dynamic assignment
export const COLOR_FAMILIES = [
  // 0: Blue (Cool)
  ['fill-blue-800 bg-blue-800', 'fill-blue-700 bg-blue-700', 'fill-blue-600 bg-blue-600', 'fill-blue-500 bg-blue-500'],
  // 1: Orange (Warm)
  ['fill-orange-800 bg-orange-800', 'fill-orange-700 bg-orange-700', 'fill-orange-600 bg-orange-600', 'fill-orange-500 bg-orange-500'],
  // 2: Emerald (Cool)
  ['fill-emerald-800 bg-emerald-800', 'fill-emerald-700 bg-emerald-700', 'fill-emerald-600 bg-emerald-600', 'fill-emerald-500 bg-emerald-500'],
  // 3: Red (Warm)
  ['fill-red-800 bg-red-800', 'fill-red-700 bg-red-700', 'fill-red-600 bg-red-600', 'fill-red-500 bg-red-500'],
  // 4: Violet (Cool)
  ['fill-violet-800 bg-violet-800', 'fill-violet-700 bg-violet-700', 'fill-violet-600 bg-violet-600', 'fill-violet-500 bg-violet-500'],
  // 5: Yellow (Warm)
  ['fill-yellow-700 bg-yellow-700', 'fill-yellow-600 bg-yellow-600', 'fill-yellow-500 bg-yellow-500', 'fill-yellow-400 bg-yellow-400'],
  // 6: Cyan (Cool)
  ['fill-cyan-800 bg-cyan-800', 'fill-cyan-700 bg-cyan-700', 'fill-cyan-600 bg-cyan-600', 'fill-cyan-500 bg-cyan-500'],
  // 7: Pink (Warm)
  ['fill-pink-800 bg-pink-800', 'fill-pink-700 bg-pink-700', 'fill-pink-600 bg-pink-600', 'fill-pink-500 bg-pink-500'],
  // 8: Green (Cool)
  ['fill-green-800 bg-green-800', 'fill-green-700 bg-green-700', 'fill-green-600 bg-green-600', 'fill-green-500 bg-green-500'],
  // 9: Amber (Warm)
  ['fill-amber-700 bg-amber-700', 'fill-amber-600 bg-amber-600', 'fill-amber-500 bg-amber-500', 'fill-amber-400 bg-amber-400'],
  // 10: Indigo (Cool)
  ['fill-indigo-800 bg-indigo-800', 'fill-indigo-700 bg-indigo-700', 'fill-indigo-600 bg-indigo-600', 'fill-indigo-500 bg-indigo-500'],
  // 11: Stone (Neutral)
  ['fill-stone-700 bg-stone-700', 'fill-stone-600 bg-stone-600', 'fill-stone-500 bg-stone-500', 'fill-stone-400 bg-stone-400'],
];

export const UNKNOWN_COLOR = 'fill-gray-300 bg-gray-300';

const getFamilyIndex = (category) => {
  if (!category || category === 'Unknown') return -1;
  
  // Use top-level category for grouping
  const topLevel = category.split(' / ')[0].trim();
  
  // Simple stable hash
  let hash = 0;
  for (let i = 0; i < topLevel.length; i++) {
    hash = topLevel.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return Math.abs(hash) % COLOR_FAMILIES.length;
};

export const getColorString = (category, indexInBroadGroup) => {
  const familyIndex = getFamilyIndex(category);
  if (familyIndex === -1) return UNKNOWN_COLOR;
  
  const palette = COLOR_FAMILIES[familyIndex];
  return palette[indexInBroadGroup % palette.length];
};

export const generateColorMap = (categoriesData) => {
  const categoryKeys = Object.keys(categoriesData).sort();
  const structure = {}; 

  categoryKeys.forEach(cat => {
    const parts = cat.split(' / ');
    const top = parts[0] || 'Unclassified';
    if (!structure[top]) structure[top] = [];
    structure[top].push(cat);
  });

  const map = {};

  Object.keys(structure).forEach(top => {
    if (top === 'Unknown' || top === 'Unclassified') {
        structure[top].forEach(cat => map[cat] = UNKNOWN_COLOR);
        return;
    }

    const familyIndex = getFamilyIndex(top);
    const familyPalette = COLOR_FAMILIES[familyIndex];
    const subCats = structure[top].sort(); 
    
    subCats.forEach((cat, subIndex) => {
       const shadeIndex = subIndex % familyPalette.length;
       map[cat] = familyPalette[shadeIndex];
    });
  });

  return map;
};
