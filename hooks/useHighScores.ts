import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { GameId } from '@/constants/games';

// Kept under the original spelling on purpose: changing it would wipe
// existing players' high scores. See project notes.
export const STORAGE_KEY = 'BLOCARCADE_HIGH_SCORES';

export type HighScores = Partial<Record<GameId, number>>;

let cache: HighScores | null = null;
let loading: Promise<HighScores> | null = null;
const listeners = new Set<(scores: HighScores) => void>();

function notify() {
  const snapshot = { ...(cache ?? {}) };
  listeners.forEach((l) => l(snapshot));
}

export async function loadHighScores(): Promise<HighScores> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : {};
        cache = parsed && typeof parsed === 'object' ? (parsed as HighScores) : {};
      } catch {
        cache = {};
      }
      return cache;
    })();
  }
  return loading;
}

export function getHighScore(gameId: GameId): number {
  return cache?.[gameId] ?? 0;
}

/** Records a score. Resolves true when it beat the stored record. */
export async function updateHighScore(gameId: GameId, score: number): Promise<boolean> {
  const scores = await loadHighScores();
  const previous = scores[gameId] ?? 0;
  if (score <= previous) return false;
  cache = { ...scores, [gameId]: score };
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage failure shouldn't break gameplay; the in-memory record stands.
  }
  return true;
}

export function useHighScores() {
  const [scores, setScores] = useState<HighScores>(cache ?? {});
  const [ready, setReady] = useState(cache !== null);

  useEffect(() => {
    let active = true;
    listeners.add(setScores);
    loadHighScores().then((s) => {
      if (active) {
        setScores({ ...s });
        setReady(true);
      }
    });
    return () => {
      active = false;
      listeners.delete(setScores);
    };
  }, []);

  const get = useCallback((gameId: GameId) => scores[gameId] ?? 0, [scores]);

  return { scores, ready, getHighScore: get, updateHighScore };
}
