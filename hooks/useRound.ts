import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameId } from '@/constants/games';
import { getHighScore, loadHighScores, updateHighScore } from '@/hooks/useHighScores';

export type Phase = 'idle' | 'playing' | 'over';

/**
 * Round bookkeeping shared by every game: phase, score, best, new-record flag.
 * Games call `start()`, `addScore()` / `setScore()` and `end()`.
 */
export function useRound(gameId: GameId) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScoreState] = useState(0);
  const [best, setBest] = useState(() => getHighScore(gameId));
  const [isNewRecord, setIsNewRecord] = useState(false);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');

  useEffect(() => {
    let active = true;
    loadHighScores().then(() => active && setBest(getHighScore(gameId)));
    return () => {
      active = false;
    };
  }, [gameId]);

  const setScore = useCallback((next: number) => {
    scoreRef.current = next;
    setScoreState(next);
  }, []);

  const addScore = useCallback((delta: number) => {
    scoreRef.current += delta;
    setScoreState(scoreRef.current);
  }, []);

  const start = useCallback(() => {
    scoreRef.current = 0;
    setScoreState(0);
    setIsNewRecord(false);
    phaseRef.current = 'playing';
    setPhase('playing');
  }, []);

  const end = useCallback(async () => {
    if (phaseRef.current === 'over') return;
    phaseRef.current = 'over';
    setPhase('over');
    const record = await updateHighScore(gameId, scoreRef.current);
    setIsNewRecord(record);
    setBest(getHighScore(gameId));
  }, [gameId]);

  const reset = useCallback(() => {
    scoreRef.current = 0;
    setScoreState(0);
    setIsNewRecord(false);
    phaseRef.current = 'idle';
    setPhase('idle');
  }, []);

  return { phase, phaseRef, score, scoreRef, best, isNewRecord, setScore, addScore, start, end, reset };
}
