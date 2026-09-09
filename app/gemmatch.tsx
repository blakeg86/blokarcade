import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '@/components/BackButton';
import GameOver from '@/components/GameOver';
import Hud from '@/components/Hud';
import Colors from '@/constants/colors';
import { updateHighScore } from '@/hooks/useHighScores';
import { useRound } from '@/hooks/useRound';
import {
  GRID,
  areAdjacent,
  createGrid,
  findMatches,
  hasMove,
  resolveCascades,
  swap,
  type Grid,
} from '@/lib/gemmatch';

const INK = Colors.background; // shapes are black on the white board
const STEP_MS = 220;

function Shape({ kind, size, faded }: { kind: number; size: number; faded: boolean }) {
  const s = size * 0.58;
  const common = { opacity: faded ? 0.15 : 1 };
  switch (kind) {
    case 0:
      return <View style={[{ width: s, height: s, borderRadius: s / 2, backgroundColor: INK }, common]} />;
    case 1:
      return <View style={[{ width: s * 0.9, height: s * 0.9, backgroundColor: INK }, common]} />;
    case 2:
      return (
        <View
          style={[
            {
              width: 0,
              height: 0,
              borderLeftWidth: s / 2,
              borderRightWidth: s / 2,
              borderBottomWidth: s * 0.9,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: INK,
            },
            common,
          ]}
        />
      );
    default:
      return (
        <View
          style={[{ width: s * 0.72, height: s * 0.72, backgroundColor: INK, transform: [{ rotate: '45deg' }] }, common]}
        />
      );
  }
}

export default function GemMatch() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const round = useRound('gemmatch');
  const [grid, setGrid] = useState<Grid>(() => createGrid());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [clearing, setClearing] = useState<Set<string>>(new Set());
  const [combo, setCombo] = useState(0);
  const [moves, setMoves] = useState(0);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const boardSize = Math.min(width - 40, height - insets.top - insets.bottom - 220, 420);
  const cell = boardSize / GRID;

  useEffect(() => {
    round.start();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gem Match has no 'death', so the record is saved as the score grows.
  useEffect(() => {
    if (round.score > 0) updateHighScore('gemmatch', round.score);
  }, [round.score]);

  const finishIfStuck = useCallback(
    (g: Grid) => {
      if (!hasMove(g)) round.end();
    },
    [round],
  );

  const runCascades = (g: Grid) => {
    const steps = resolveCascades(g);
    if (steps.length === 0) {
      busy.current = false;
      finishIfStuck(g);
      return;
    }
    busy.current = true;
    steps.forEach((step, i) => {
      timers.current.push(
        setTimeout(() => {
          setClearing(step.cleared);
          setCombo(step.combo);
        }, i * STEP_MS * 2),
      );
      timers.current.push(
        setTimeout(() => {
          setClearing(new Set());
          setGrid(step.grid);
          round.addScore(step.points);
          if (i === steps.length - 1) {
            busy.current = false;
            timers.current.push(setTimeout(() => setCombo(0), 600));
            finishIfStuck(step.grid);
          }
        }, i * STEP_MS * 2 + STEP_MS),
      );
    });
  };

  const tap = (r: number, c: number) => {
    if (busy.current || round.phaseRef.current !== 'playing') return;
    if (!selected) {
      setSelected([r, c]);
      return;
    }
    if (selected[0] === r && selected[1] === c) {
      setSelected(null);
      return;
    }
    if (!areAdjacent(selected, [r, c])) {
      setSelected([r, c]);
      return;
    }
    const swapped = swap(grid, selected, [r, c]);
    setSelected(null);
    if (findMatches(swapped).size === 0) {
      // Invalid swap: flash it and snap back.
      busy.current = true;
      setGrid(swapped);
      timers.current.push(
        setTimeout(() => {
          setGrid(grid);
          busy.current = false;
        }, 160),
      );
      return;
    }
    setMoves((m) => m + 1);
    setGrid(swapped);
    runCascades(swapped);
  };

  const restart = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    busy.current = false;
    setGrid(createGrid());
    setSelected(null);
    setClearing(new Set());
    setCombo(0);
    setMoves(0);
    round.reset();
    round.start();
  };

  return (
    <View style={styles.container} testID="gemmatch-screen">
      <BackButton inverted />
      <Hud score={round.score} best={round.best} inverted extra={`MOVES ${moves}`} />

      <View style={styles.center}>
        <Text style={styles.title}>GEM MATCH</Text>
        <View style={[styles.board, { width: boardSize, height: boardSize }]}>
          {grid.map((row, r) =>
            row.map((kind, c) => {
              const isSel = selected?.[0] === r && selected?.[1] === c;
              return (
                <Pressable
                  key={`${r}-${c}`}
                  testID={`gem-${r}-${c}`}
                  onPress={() => tap(r, c)}
                  style={[
                    styles.cell,
                    { width: cell, height: cell, left: c * cell, top: r * cell },
                    isSel && styles.cellSelected,
                  ]}
                >
                  {kind >= 0 && <Shape kind={kind} size={cell} faded={clearing.has(`${r},${c}`)} />}
                </Pressable>
              );
            }),
          )}
        </View>
        <Text style={styles.combo}>{combo > 1 ? `COMBO ×${combo}` : combo === 1 ? 'MATCH' : ' '}</Text>
        <Text style={styles.hint}>TAP TWO ADJACENT SHAPES TO SWAP</Text>
      </View>

      {round.phase === 'over' && (
        <GameOver
          title="NO MOVES LEFT"
          score={round.score}
          highScore={round.best}
          isNewRecord={round.isNewRecord}
          onRestart={restart}
          inverted
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.foreground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.background, fontSize: 18, fontWeight: '700', letterSpacing: 8, marginBottom: 20 },
  board: { borderWidth: 2, borderColor: Colors.background, position: 'relative' },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: '#DDDDDD' },
  combo: { color: Colors.background, fontSize: 13, fontWeight: '700', letterSpacing: 5, marginTop: 18, height: 18 },
  hint: { color: Colors.secondary, fontSize: 10, letterSpacing: 3, marginTop: 10 },
});
