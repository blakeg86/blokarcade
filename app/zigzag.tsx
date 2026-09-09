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
import { BASE_WIDTH, SEGMENT_LENGTH, nextSegment, speedForScore, type Segment } from '@/lib/zigzag';

const BALL = 16;
const BASE_SCROLL = 3.4;
const DRIFT = 2.6;

interface PlacedSegment extends Segment {
  y: number; // top of segment on screen
}

export default function ZigZag() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const round = useRound('zigzag');
  const centerX = width / 2;
  const playerY = height * 0.62;
  const halfPlay = width / 2 - 24;

  const segments = useRef<PlacedSegment[]>([]);
  const dirState = useRef<{ dir: 1 | -1; left: number }>({ dir: 1, left: 0 });
  const playerX = useRef(0); // relative to centre
  const playerDir = useRef<1 | -1>(1);
  const passed = useRef(0);
  const [, setFrame] = useState(0);

  const resetWorld = useCallback(() => {
    dirState.current = { dir: 1, left: 0 };
    playerX.current = 0;
    playerDir.current = 1;
    passed.current = 0;
    // Start with a straight runway under the player, then build the path upward.
    const list: PlacedSegment[] = [];
    let prev: Segment = { x: 0, index: 0, width: BASE_WIDTH };
    let y = playerY + SEGMENT_LENGTH * 3;
    for (let i = 0; i < 4; i++) {
      list.push({ ...prev, index: 0, y });
      y -= SEGMENT_LENGTH;
    }
    while (y > -SEGMENT_LENGTH * 2) {
      prev = nextSegment(prev, halfPlay, Math.random, dirState.current);
      list.push({ ...prev, y });
      y -= SEGMENT_LENGTH;
    }
    segments.current = list;
  }, [playerY, halfPlay]);

  useGameLoop((dt) => {
    if (round.phaseRef.current !== 'playing') return;
    const scroll = speedForScore(BASE_SCROLL, round.scoreRef.current) * dt;
    const drift = speedForScore(DRIFT, round.scoreRef.current) * dt;
    playerX.current += playerDir.current * drift;

    const list = segments.current;
    for (const s of list) s.y += scroll;

    // Recycle segments that scrolled off the bottom and extend the path on top.
    while (list.length && list[0].y > height + SEGMENT_LENGTH) {
      list.shift();
      passed.current += 1;
    }
    let top = list[list.length - 1];
    while (top.y > -SEGMENT_LENGTH * 2) {
      const next = nextSegment(top, halfPlay, Math.random, dirState.current);
      const placed = { ...next, y: top.y - SEGMENT_LENGTH };
      list.push(placed);
      top = placed;
    }

    // Segment under the player
    const under = list.find((s) => playerY >= s.y && playerY < s.y + SEGMENT_LENGTH);
    if (!under) {
      round.end();
      return;
    }
    if (Math.abs(playerX.current - under.x) > under.width / 2 - BALL / 3) {
      round.end();
      return;
    }
    round.setScore(Math.max(0, under.index - 1));
    setFrame((f) => f + 1);
  }, round.phase === 'playing');

  const tap = () => {
    if (round.phaseRef.current === 'idle') {
      resetWorld();
      round.start();
      return;
    }
    if (round.phaseRef.current !== 'playing') return;
    playerDir.current = playerDir.current === 1 ? -1 : 1;
  };

  const restart = () => {
    resetWorld();
    round.reset();
  };

  return (
    <Pressable style={styles.container} onPress={tap} testID="zigzag-screen">
      <BackButton />
      <Hud score={round.score} best={round.best} />
      {round.phase === 'idle' && <TapToStart title="ZIG ZAG" hint="TAP TO CHANGE DIRECTION" />}

      {segments.current.map((s, i) => (
        <View
          key={`${s.index}-${i}`}
          style={[
            styles.segment,
            { left: centerX + s.x - s.width / 2, top: s.y, width: s.width, height: SEGMENT_LENGTH + 1 },
          ]}
        />
      ))}

      {round.phase !== 'idle' && (
        <View style={[styles.ball, { left: centerX + playerX.current - BALL / 2, top: playerY - BALL / 2 }]} />
      )}

      {round.phase === 'playing' && (
        <Text style={[styles.hint, { bottom: insets.bottom + 40 }]}>TAP TO TURN</Text>
      )}

      {round.phase === 'over' && (
        <GameOver score={round.score} highScore={round.best} isNewRecord={round.isNewRecord} onRestart={restart} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, overflow: 'hidden' },
  segment: { position: 'absolute', backgroundColor: Colors.foreground },
  ball: {
    position: 'absolute',
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    backgroundColor: Colors.background,
    borderWidth: 3,
    borderColor: Colors.foreground,
    zIndex: 5,
  },
  hint: { position: 'absolute', alignSelf: 'center', color: Colors.dim, fontSize: 11, letterSpacing: 4 },
});
