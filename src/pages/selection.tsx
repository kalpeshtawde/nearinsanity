import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Cartoon } from './cartoon-data';

/** Storage key for the selection — survives refreshes (browser data). */
const STORAGE_KEY = 'ni-selected-cartoons';

/** Selection is capped at the largest pack (50). */
export const MAX_SELECTION = 50;

interface SelectionContextValue {
  selected: Cartoon[];
  toggle: (cartoon: Cartoon) => void;
  isSelected: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  max: number;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

function loadFromStorage(): Cartoon[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Cartoon[]) : [];
  } catch {
    return [];
  }
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Cartoon[]>(loadFromStorage);

  // Persist on every change so a page refresh keeps the selection.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    } catch {
      /* storage unavailable (e.g. private mode) — selection just won't persist */
    }
  }, [selected]);

  const toggle = useCallback((cartoon: Cartoon) => {
    setSelected((prev) => {
      if (prev.some((c) => c.id === cartoon.id)) {
        return prev.filter((c) => c.id !== cartoon.id);
      }
      if (prev.length >= MAX_SELECTION) return prev; // capped at the 50-pack
      return [...prev, cartoon];
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selected.some((c) => c.id === id),
    [selected],
  );

  const remove = useCallback(
    (id: string) => setSelected((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  const clear = useCallback(() => setSelected([]), []);

  const value = useMemo(
    () => ({ selected, toggle, isSelected, remove, clear, max: MAX_SELECTION }),
    [selected, toggle, isSelected, remove, clear],
  );

  return (
    <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside SelectionProvider');
  return ctx;
}