import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '@/components/BackButton';
import GameOver from '@/components/GameOver';
import Hud from '@/components/Hud';
import TapToStart from '@/components/TapToStart';
import Colors from '@/constants/colors';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useRound } from '@/hooks/useRound';
import {
  canTurn,
  hitsSelf,
  hitsWall,
  intervalForFoods,
  nextHead,
  placeFood,
  swipeDir,
  type Dir,
  type Point,
} from '@/lib/snake';

const COLS = 15;

export default function Snake() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const round = useRound('snake');

  const boardW = width - 32;
  const cell = boardW / COLS;
  const boardTop = insets.top + 90;
  const rows = Math.max(12, Math.floor((height - boardTop - insets.bottom - 80) / cell));
  const boardH = rows * cell;

  const body = useRef<Point[]>([]);
  const prevBody = useRef<Point[]>([]);
  const dir = useRef<Dir>('right');
  const queued = useRef<Dir | null>(null);
  const food = useRef<Point>({ x: -1, y: -1 });
  const foods = useRef(0);
  const sinceTick = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [, setFrame] = useState(0);
  const [interpolation, setInterpolation] = useState(1);

  const resetWorld = useCallback(() => {
    const cy = Math.floor(rows / 2);
    body.current = [
      { x: 5, y: cy },
      { x: 4, y: cy },
      { x: 3, y: cy },
    ];
    prevBody.current = body.current.map((p) => ({ ...p }));
    dir.current = 'right';
    queued.current = null;
    foods.current = 0;
    sinceTick.current = 0;
    food.current = placeFood(body.current, COLS, rows, Math.random);
  }, [rows]);

  useEffect(() => {
    resetWorld();
  }, [resetWorld]);

  const step = () => {
    if (queued.current && canTurn(dir.current, queued.current)) dir.current = queued.current;
    queued.current = null;
    const head = nextHead(body.current[0], dir.current);
    const eats = head.x === food.current.x && head.y === food.current.y;
    if (hitsWall(head, COLS, rows) || hitsSelf(head, body.current, eats)) {
      round.end();
      return;
    }
    prevBody.current = body.current.map((p) => ({ ...p }));
    body.current = [head, ...body.current];
    if (eats) {
      foods.current += 1;
      round.addScore(10);
      food.current = placeFood(body.current, COLS, rows, Math.random);
      prevBody.current.push({ ...prevBody.current[prevBody.current.length - 1] });
    } else {
      body.current.pop();
    }
  };

  useGameLoop((dt) => {
    if (round.phaseRef.current !== 'playing') return;
    const interval = intervalForFoods(foods.current);
    sinceTick.current += dt * (1000 / 60);
    if (sinceTick.current >= interval) {
      sinceTick.current -= interval;
      step();
    }
    setInterpolation(Math.min(1, sinceTick.current / interval));
    setFrame((f) => f + 1);
  }, round.phase === 'playing');

  const onGrant = (e: GestureResponderEvent) => {
    touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const onRelease = (e: GestureResponderEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (round.phaseRef.current === 'idle') {
      resetWorld();
      round.start();
      return;
    }
    if (round.phaseRef.current !== 'playing' || !start) return;
    const d = swipeDir(e.nativeEvent.pageX - start.x, e.nativeEvent.pageY - start.y);
    if (d) queued.current = d;
  };

  // Tap zones as a fallback for people who'd rather tap than swipe.
  const tapTurn = (d: Dir) => {
    if (round.phaseRef.current === 'playing') queued.current = d;
  };

  const restart = () => {
    resetWorld();
    round.reset();
  };

  const t = interpolation;
  const lerp = (a: number, b: number) => a + (b - a) * t;

  return (
    <View
      style={styles.container}
      testID="snake-screen"
      onStartShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderRelease={onRelease}
    >
      <BackButton />
      <Hud score={round.score} best={round.best} />
      {round.phase === 'idle' && <TapToStart title="SNAKE" hint="SWIPE TO STEER · EAT TO GROW" />}

      <View style={[styles.board, { left: 16, top: boardTop, width: boardW, height: boardH }]}>
        {round.phase !== 'idle' && food.current.x >= 0 && (
          <View
            style={[
              styles.food,
              { left: food.current.x * cell + cell * 0.25, top: food.current.y * cell + cell * 0.25, width: cell * 0.5, height: cell * 0.5 },
            ]}
          />
        )}
        {round.phase !== 'idle' &&
          body.current.map((p, i) => {
            const prev = prevBody.current[i] ?? p;
            const x = lerp(prev.x, p.x) * cell;
            const y = lerp(prev.y, p.y) * cell;
            return (
              <View
                key={i}
                style={[
                  styles.segment,
                  { left: x + 1, top: y + 1, width: cell - 2, height: cell - 2 },
                  i === 0 && styles.head,
                ]}
              />
            );
          })}
      </View>

      {round.phase === 'playing' && (
        <View style={[styles.controls, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Text style={styles.hint}>SWIPE TO STEER</Text>
          <View style={styles.dpad}>
            {(['up', 'left', 'down', 'right'] as Dir[]).map((d) => (
              <Text key={d} onPress={() => tapTurn(d)} style={styles.dpadKey} testID={`snake-${d}`}>
                {d === 'up' ? '↑' : d === 'down' ? '↓' : d === 'left' ? '←' : '→'}
              </Text>
            ))}
          </View>
        </View>
      )}

      {round.phase === 'over' && (
        <GameOver score={round.score} highScore={round.best} isNewRecord={round.isNewRecord} onRestart={restart} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  board: { position: 'absolute', borderWidth: 1, borderColor: Colors.dim, overflow: 'hidden' },
  food: { position: 'absolute', backgroundColor: Colors.foreground, borderRadius: 99 },
  segment: { position: 'absolute', backgroundColor: Colors.secondary },
  head: { backgroundColor: Colors.foreground },
  controls: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hint: { color: Colors.dim, fontSize: 10, letterSpacing: 4, marginBottom: 6 },
  dpad: { flexDirection: 'row', gap: 22 },
  dpadKey: { color: Colors.secondary, fontSize: 20, paddingHorizontal: 10, paddingVertical: 4 },
});
