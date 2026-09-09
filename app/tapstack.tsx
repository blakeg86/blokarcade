import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '@/components/BackButton';
import GameOver from '@/components/GameOver';
import Hud from '@/components/Hud';
import TapToStart from '@/components/TapToStart';
import Colors from '@/constants/colors';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useRound } from '@/hooks/useRound';
import { computeOverlap, speedForDrops } from '@/lib/tapstack';

const BLOCK_H = 26;
const BASE_SPEED = 3.2;
const VISIBLE_ROWS = 9;

interface Block {
  x: number;
  w: number;
}

export default function TapStack() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const round = useRound('tapstack');
  const baseY = height - insets.bottom - 120;
  const startW = Math.min(width * 0.5, 200);

  const stack = useRef<Block[]>([{ x: (width - startW) / 2, w: startW }]);
  const moving = useRef<Block>({ x: 0, w: startW });
  const dir = useRef(1);
  const [, setFrame] = useState(0);
  const [perfectFlash, setPerfectFlash] = useState(false);

  const resetWorld = useCallback(() => {
    stack.current = [{ x: (width - startW) / 2, w: startW }];
    moving.current = { x: 0, w: startW };
    dir.current = 1;
    setPerfectFlash(false);
  }, [width, startW]);

  useGameLoop((dt) => {
    if (round.phaseRef.current !== 'playing') return;
    const speed = speedForDrops(BASE_SPEED, stack.current.length - 1);
    const m = moving.current;
    m.x += dir.current * speed * dt;
    if (m.x + m.w >= width) {
      m.x = width - m.w;
      dir.current = -1;
    } else if (m.x <= 0) {
      m.x = 0;
      dir.current = 1;
    }
    setFrame((f) => f + 1);
  }, round.phase === 'playing');

  const tap = () => {
    if (round.phaseRef.current === 'idle') {
      resetWorld();
      round.start();
      return;
    }
    if (round.phaseRef.current !== 'playing') return;
    const top = stack.current[stack.current.length - 1];
    const m = moving.current;
    const result = computeOverlap(top.x, top.w, m.x, m.w);
    if (result.x === null) {
      round.end();
      return;
    }
    stack.current.push({ x: result.x, w: result.width });
    round.addScore(result.perfect ? 2 : 1);
    if (result.perfect) {
      setPerfectFlash(true);
      setTimeout(() => setPerfectFlash(false), 350);
    }
    // Next block starts from the opposite side at the trimmed width.
    dir.current = dir.current === 1 ? -1 : 1;
    moving.current = { x: dir.current === 1 ? 0 : width - result.width, w: result.width };
  };

  const restart = () => {
    resetWorld();
    round.reset();
  };

  const rows = stack.current.length;
  const cameraShift = Math.max(0, rows - VISIBLE_ROWS) * BLOCK_H;
  const movingTop = baseY - rows * BLOCK_H + cameraShift;

  return (
    <Pressable style={styles.container} onPress={tap} testID="tapstack-screen">
      <BackButton />
      <Hud score={round.score} best={round.best} />
      {round.phase === 'idle' && <TapToStart title="TAP STACK" hint="TAP WHEN THE BLOCK LINES UP" />}

      {stack.current.map((b, i) => {
        const top = baseY - (i + 1) * BLOCK_H + cameraShift;
        if (top > height + BLOCK_H) return null;
        return (
          <View
            key={i}
            style={[
              styles.block,
              { left: b.x, width: b.w, top },
              i === 0 && styles.base,
              i > 0 && i % 2 === 0 && styles.blockAlt,
            ]}
          />
        );
      })}

      {round.phase === 'playing' && (
        <View
          style={[
            styles.block,
            styles.movingBlock,
            { left: moving.current.x, width: moving.current.w, top: movingTop },
          ]}
        />
      )}

      {perfectFlash && <Text style={[styles.perfect, { top: insets.top + 100 }]}>PERFECT</Text>}
      {round.phase === 'playing' && (
        <Text style={[styles.hint, { bottom: insets.bottom + 40 }]}>TAP TO DROP</Text>
      )}

      {round.phase === 'over' && (
        <GameOver score={round.score} highScore={round.best} isNewRecord={round.isNewRecord} onRestart={restart} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, overflow: 'hidden' },
  block: { position: 'absolute', height: BLOCK_H - 2, backgroundColor: Colors.foreground },
  blockAlt: { backgroundColor: '#DDDDDD' },
  base: { backgroundColor: Colors.secondary },
  movingBlock: { backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.foreground },
  perfect: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 8,
  },
  hint: { position: 'absolute', alignSelf: 'center', color: Colors.dim, fontSize: 11, letterSpacing: 4 },
});
