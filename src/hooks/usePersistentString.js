import { useState, useEffect } from 'react';

export const usePersistentString = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? stored : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, state);
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  }, [key, state]);

  return [state, setState];
};
