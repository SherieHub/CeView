import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from './apiClient';
import type { LinkPerformance } from '../types';

export interface LinkPerformanceState {
  data: LinkPerformance | null;
  loading: boolean;
  error: unknown | null;
  refresh(): void;
}

export function useLinkPerformance(linkId: string | null): LinkPerformanceState {
  const [data, setData] = useState<LinkPerformance | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown | null>(null);
  const reqIdRef = useRef(0);

  const fetchData = useCallback(async (currentLinkId: string | null) => {
    if (!currentLinkId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    
    reqIdRef.current += 1;
    const reqId = reqIdRef.current;
    
    setData(null);
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.attributionLinks.performance(currentLinkId);
      if (reqIdRef.current === reqId) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      if (reqIdRef.current === reqId) {
        setError(err);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData(linkId);
    return () => {
      reqIdRef.current += 1; // invalidate on unmount
    };
  }, [linkId, fetchData]);

  const refresh = useCallback(() => {
    fetchData(linkId);
  }, [linkId, fetchData]);

  return { data, loading, error, refresh };
}
