import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { ApiError } from "../api/client";

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (data: T) => void;
}

/** Carga datos de la API y descarta respuestas viejas si las dependencias cambian antes de que lleguen. */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const call = ++latest.current;
    setLoading(true);
    load()
      .then((result) => {
        if (call !== latest.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (call !== latest.current) return;
        setError(err instanceof ApiError ? err : new ApiError(0, "common.internal_error", String(err)));
      })
      .finally(() => {
        if (call === latest.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}

/** Ejecuta una acción y guarda su error para mostrarlo junto al botón que la lanzó. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, run, clearError: () => setError(null) };
}
