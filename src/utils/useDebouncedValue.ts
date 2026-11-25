import { useEffect, useState } from 'react';

/**
 * Lightweight debounce hook for search inputs (default 130 ms).
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 130): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    if (!value) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
