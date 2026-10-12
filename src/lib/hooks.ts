'use client';

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/** Load async data with loading/error state and a reload function. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const requestId = useRef(0);

  const reload = useCallback(async (options: { silent?: boolean } = {}) => {
    const id = ++requestId.current;
    if (!options.silent) setLoading(true);
    try {
      const result = await loaderRef.current();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === requestId.current) setError(e);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching is the external sync this effect exists for
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
