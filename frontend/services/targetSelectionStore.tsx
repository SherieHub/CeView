/**
 * Shared cross-module state: which surge alert + target market the operator
 * has chosen to create content for.
 *
 * Content Studio has no market selector of its own (see ContentStudioView's
 * header comment) — Module 2 owns "which surge alert / which market", and
 * until now nothing persisted that choice across routes, so Content Studio
 * silently defaulted to the operator's top-ranked market with no confirmation
 * of *which* surge or market the generated captions were even for. This store
 * closes that gap: Dashboard's "Target this market" writes the pick here,
 * Content Studio reads it and refuses to generate anything until both fields
 * are set (see ContentTargetPicker for the picker that fills them in when
 * they aren't).
 *
 * Provider/hook shape mirrors services/connectionsStore.tsx.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DemandAlert, Market } from '../types';

export interface TargetSelection {
  alert: DemandAlert;
  market: Market;
}

export interface TargetSelectionStore {
  /** Null until both a surge alert and a target market have been chosen. */
  target: TargetSelection | null;
  setTarget(alert: DemandAlert, market: Market): void;
  /** Drops the current pick — Content Studio's "Change target market" control. */
  clearTarget(): void;
}

const TargetSelectionContext = createContext<TargetSelectionStore | null>(null);

export function TargetSelectionProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<TargetSelection | null>(null);

  const value = useMemo<TargetSelectionStore>(
    () => ({
      target,
      setTarget: (alert, market) => setTargetState({ alert, market }),
      clearTarget: () => setTargetState(null),
    }),
    [target],
  );

  return <TargetSelectionContext.Provider value={value}>{children}</TargetSelectionContext.Provider>;
}

export function useTargetSelection(): TargetSelectionStore {
  const ctx = useContext(TargetSelectionContext);
  if (!ctx) throw new Error('useTargetSelection must be used within a TargetSelectionProvider');
  return ctx;
}
