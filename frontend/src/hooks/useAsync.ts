import { useState, useEffect, useCallback } from "react";

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string;
}

export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  errorMessage: string
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: true,
    error: "",
  });
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, isLoading: s.data === null, error: "" }));
    fetcher(ac.signal)
      .then((data) => setState({ data, isLoading: false, error: "" }))
      .catch((err: unknown) => {
        if ((err as { code?: string }).code === "ERR_CANCELED") return;
        setState((s) => ({ ...s, isLoading: false, error: errorMessage }));
      });
    return () => ac.abort();
  }, [fetcher, trigger, errorMessage]);

  const reload = useCallback(() => setTrigger((t) => t + 1), []);

  return { ...state, reload };
}
