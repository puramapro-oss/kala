'use client';

import { useEffect, useState } from 'react';

/**
 * Hook pour debouncer une valeur (recherche live, filtre).
 * La valeur renvoyée ne se met à jour qu'après `delay` ms sans changement.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
