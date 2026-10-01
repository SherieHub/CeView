import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from './apiClient';
import type { AttributionLink } from '../types';

export interface AttributionLinksState {
  links: AttributionLink[] | null;
  error: unknown | null;
  refresh(): Promise<void>;
}

export function useAttributionLinks(): AttributionLinksState {
  const [links, setLinks] = useState<AttributionLink[] | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await apiClient.attributionLinks.list();
      if (mounted.current) setLinks(data);
    } catch (err) {
      if (mounted.current) setError(err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { links, error, refresh };
}
