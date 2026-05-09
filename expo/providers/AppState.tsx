import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
  stats: 'reail.stats.v1',
  watch: 'reail.watch.v1',
  bets: 'reail.bets.v1',
} as const;

export interface Stats {
  scans: number;
  threatsBlocked: number;
  correctPredictions: number;
  totalPredictions: number;
}

const DEFAULT_STATS: Stats = {
  scans: 0,
  threatsBlocked: 0,
  correctPredictions: 0,
  totalPredictions: 0,
};

export type Verdict = 'STOP' | 'CAUTION' | 'OK';

export interface WatchItem {
  token: string;
  domain: string;
  badge: string;
  score: number;
  verdict: Verdict;
  addedAt: number;
}

export interface BetRecord {
  token: string;
  prediction: 'real' | 'fake';
  verdict: Verdict;
  correct: boolean;
  at: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  subtitle?: string;
  tone: 'success' | 'warn' | 'danger' | 'info';
}

const MILESTONES: Record<number, string> = {
  1: 'First scan complete.',
  5: 'Your instinct improves.',
  10: 'Sharper than most.',
  25: 'REAiL Veteran.',
  50: 'Half a hundred. Trusted eye.',
  100: 'REAiL Master. 100 scans.',
};

export const [AppStateProvider, useAppState] = createContextHook(() => {
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [bets, setBets] = useState<Record<string, BetRecord>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydrate from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [s, w, b] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.stats),
          AsyncStorage.getItem(STORAGE_KEYS.watch),
          AsyncStorage.getItem(STORAGE_KEYS.bets),
        ]);
        if (s) setStats({ ...DEFAULT_STATS, ...JSON.parse(s) });
        if (w) setWatch(JSON.parse(w));
        if (b) setBets(JSON.parse(b));
      } catch (err) {
        console.log('[AppState] hydrate error', err);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats)).catch(() => {});
  }, [stats, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.watch, JSON.stringify(watch)).catch(() => {});
  }, [watch, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.bets, JSON.stringify(bets)).catch(() => {});
  }, [bets, hydrated]);

  const pushToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `t_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    setToasts((cur) => [...cur, { ...t, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const recordScan = useCallback(
    (verdict: Verdict) => {
      setStats((prev) => {
        const next: Stats = {
          ...prev,
          scans: prev.scans + 1,
          threatsBlocked:
            prev.threatsBlocked + (verdict === 'STOP' || verdict === 'CAUTION' ? 1 : 0),
        };
        const milestone = MILESTONES[next.scans];
        if (milestone) {
          setTimeout(() => {
            pushToast({ title: milestone, subtitle: `${next.scans} scans`, tone: 'success' });
          }, 0);
        }
        return next;
      });
    },
    [pushToast]
  );

  const recordBet = useCallback(
    (token: string, prediction: 'real' | 'fake', verdict: Verdict) => {
      const correct =
        (prediction === 'real' && verdict === 'OK') ||
        (prediction === 'fake' && (verdict === 'STOP' || verdict === 'CAUTION'));
      const rec: BetRecord = {
        token,
        prediction,
        verdict,
        correct,
        at: Date.now(),
      };
      setBets((cur) => ({ ...cur, [token]: rec }));
      setStats((prev) => ({
        ...prev,
        totalPredictions: prev.totalPredictions + 1,
        correctPredictions: prev.correctPredictions + (correct ? 1 : 0),
      }));
      pushToast({
        title: correct ? 'Correct prediction.' : 'Instinct miss.',
        subtitle: correct ? 'Your instinct improves.' : 'Reality is sharper than gut.',
        tone: correct ? 'success' : 'warn',
      });
    },
    [pushToast]
  );

  const addToWatch = useCallback(
    (item: WatchItem) => {
      setWatch((cur) => {
        if (cur.find((x) => x.token === item.token)) return cur;
        return [item, ...cur].slice(0, 50);
      });
      pushToast({ title: 'Added to Watch.', subtitle: item.domain, tone: 'info' });
    },
    [pushToast]
  );

  const removeFromWatch = useCallback((token: string) => {
    setWatch((cur) => cur.filter((x) => x.token !== token));
  }, []);

  const isWatching = useCallback(
    (token: string) => watch.some((x) => x.token === token),
    [watch]
  );

  const getBet = useCallback((token: string): BetRecord | undefined => bets[token], [bets]);

  return useMemo(
    () => ({
      hydrated,
      stats,
      watch,
      toasts,
      pushToast,
      dismissToast,
      recordScan,
      recordBet,
      addToWatch,
      removeFromWatch,
      isWatching,
      getBet,
    }),
    [
      hydrated,
      stats,
      watch,
      toasts,
      pushToast,
      dismissToast,
      recordScan,
      recordBet,
      addToWatch,
      removeFromWatch,
      isWatching,
      getBet,
    ]
  );
});
