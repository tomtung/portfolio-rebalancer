import { useState, useEffect } from 'react';

export const usePersistentObject = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  }, [key, state]);

  return [state, setState];
};
