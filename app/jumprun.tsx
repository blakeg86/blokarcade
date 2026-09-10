import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '@/components/BackButton';
import GameOver from '@/components/GameOver';
import Hud from '@/components/Hud';
import TapToStart from '@/components/TapToStart';
import Colors from '@/constants/colors';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useRound } from '@/hooks/useRound';

const GRAVITY = 0.9;
const JUMP_FORCE = -15;
const PLAYER = 34;
const PLAYER_X = 60;
const BASE_SPEED = 3.6; // starts gentle; ramps with distance
const MAX_SPEED_BONUS = 6;
const JUMP_BUFFER_FRAMES = 8; // a tap slightly before landing still jumps
const COYOTE_FRAMES = 4; // a tap just after leaving the ground still jumps

type ObstacleType = 'ground' | 'floating' | 'tall';
interface Obstacle {
  id: number;
  x: number;
  w: number;
  h: number;
  /** distance from ground line to obstacle bottom */
  lift: number;
  type: ObstacleType;
}

const OBSTACLE_SHAPES: Record<ObstacleType, { w: number; h: number; lift: number }> = {
  ground: { w: 26, h: 30, lift: 0 },
  floating: { w: 44, h: 18, lift: PLAYER + 14 },
  tall: { w: 22, h: 58, lift: 0 },
};

export default function JumpRun() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const round = useRound('jumprun');
  const groundY = height - insets.bottom - 140;

  const playerY = useRef(0); // offset above ground (negative = up)
  const velocity = useRef(0);
  const obstacles = useRef<Obstacle[]>([]);
  const distance = useRef(0);
  const nextSpawn = useRef(0);
  const nextId = useRef(1);
  const jumpBuffer = useRef(0);
  const airFrames = useRef(0);
  const [, setFrame] = useState(0);

  const resetWorld = useCallback(() => {
    playerY.current = 0;
    velocity.current = 0;
    obstacles.current = [];
    distance.current = 0;
    nextSpawn.current = 90;
    nextId.current = 1;
    jumpBuffer.current = 0;
    airFrames.current = 0;
  }, []);

  const jump = () => {
    if (round.phaseRef.current === 'idle') {
      resetWorld();
      round.start();
      velocity.current = JUMP_FORCE;
      return;
    }
    if (round.phaseRef.current !== 'playing') return;
    if (playerY.current >= 0 || airFrames.current <= COYOTE_FRAMES) {
      velocity.current = JUMP_FORCE;
      airFrames.current = COYOTE_FRAMES + 1;
      jumpBuffer.current = 0;
    } else {
      jumpBuffer.current = JUMP_BUFFER_FRAMES;
    }
  };

  const spawn = (speed: number) => {
    const roll = Math.random();
    const type: ObstacleType = roll < 0.45 ? 'ground' : roll < 0.75 ? 'floating' : 'tall';
    const s = OBSTACLE_SHAPES[type];
    obstacles.current.push({ id: nextId.current++, x: width + 20, ...s, type });
    // Gap is measured in frames, so the pixel gap grows with speed and a
    // full jump arc (~33 frames) always fits between obstacles.
    const minGap = 60 + speed * 2;
    nextSpawn.current = minGap + Math.random() * 50;
  };

  useGameLoop((dt) => {
    if (round.phaseRef.current !== 'playing') return;
    // Ramp: +1 speed unit every ~1500 px of distance, capped.
    const speed = BASE_SPEED + Math.min(distance.current / 1500, MAX_SPEED_BONUS);

    velocity.current += GRAVITY * dt;
    playerY.current += velocity.current * dt;
    if (playerY.current > 0) {
      playerY.current = 0;
      velocity.current = 0;
    }
    if (playerY.current >= 0) {
      airFrames.current = 0;
      if (jumpBuffer.current > 0) {
        velocity.current = JUMP_FORCE;
        jumpBuffer.current = 0;
        airFrames.current = COYOTE_FRAMES + 1;
      }
    } else {
      airFrames.current += dt;
      if (jumpBuffer.current > 0) jumpBuffer.current -= dt;
    }

    distance.current += speed * dt;
    nextSpawn.current -= dt;
    if (nextSpawn.current <= 0) spawn(speed);

    const px1 = PLAYER_X + 4;
    const px2 = PLAYER_X + PLAYER - 4;
    const pTop = groundY + playerY.current - PLAYER + 4;
    const pBottom = groundY + playerY.current - 4;

    for (const o of obstacles.current) {
      o.x -= speed * dt;
      const oTop = groundY - o.lift - o.h;
      const oBottom = groundY - o.lift;
      if (o.x < px2 && o.x + o.w > px1 && oTop < pBottom && oBottom > pTop) {
        round.end();
        return;
      }
    }
    obstacles.current = obstacles.current.filter((o) => o.x + o.w > -10);

    round.setScore(Math.floor(distance.current / 10));
    setFrame((f) => f + 1);
  }, round.phase === 'playing');

  const restart = () => {
    resetWorld();
    round.reset();
  };

  return (
    <View
      style={styles.container}
      testID="jumprun-screen"
      onStartShouldSetResponder={() => true}
      onResponderGrant={jump}
    >
      <BackButton />
      <Hud score={round.score} best={round.best} />

      {round.phase === 'idle' && <TapToStart title="JUMP RUN" hint="TAP TO JUMP OVER OBSTACLES" />}

      {/* Ground line */}
      <View style={[styles.ground, { top: groundY }]} />
      <View style={[styles.groundGlow, { top: groundY + 2 }]} />

      {/* Player */}
      <View
        style={[
          styles.player,
          { left: PLAYER_X, top: groundY + playerY.current - PLAYER },
          round.phase !== 'idle' && playerY.current < 0 && styles.playerAir,
        ]}
      />

      {/* Obstacles */}
      {obstacles.current.map((o) => (
        <View
          key={o.id}
          style={[
            styles.obstacle,
            { left: o.x, top: groundY - o.lift - o.h, width: o.w, height: o.h },
            o.type === 'floating' && styles.floating,
          ]}
        />
      ))}

      {round.phase === 'playing' && (
        <Text style={[styles.hint, { bottom: insets.bottom + 40 }]}>TAP TO JUMP</Text>
      )}

      {round.phase === 'over' && (
        <GameOver score={round.score} highScore={round.best} isNewRecord={round.isNewRecord} onRestart={restart} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  ground: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: Colors.foreground },
  groundGlow: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.dim },
  player: { position: 'absolute', width: PLAYER, height: PLAYER, backgroundColor: Colors.foreground },
  playerAir: { transform: [{ rotate: '12deg' }] },
  obstacle: { position: 'absolute', backgroundColor: Colors.foreground },
  floating: { backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.foreground },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.dim,
    fontSize: 11,
    letterSpacing: 4,
  },
});
