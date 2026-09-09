import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '@/components/BackButton';
import GameOver from '@/components/GameOver';
import Hud from '@/components/Hud';
import TapToStart from '@/components/TapToStart';
import Colors from '@/constants/colors';
import { COLS, getLevel } from '@/constants/brickLevels';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useRound } from '@/hooks/useRound';

const PADDLE_W = 90;
const PADDLE_H = 10;
const BALL = 12;
const BRICK_H = 22;
const BRICK_GAP = 4;
const BASE_BALL_SPEED = 5.5;
const LIVES = 3;
const LEVEL_BONUS = 500;

interface Brick {
  id: number;
  row: number;
  col: number;
  hits: number;
}

export default function BrikBreak() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const round = useRound('brikbreak');

  const playTop = insets.top + 70;
  const paddleY = height - insets.bottom - 90;
  const brickW = (width - 24 - BRICK_GAP * (COLS - 1)) / COLS;

  const paddleX = useRef((width - PADDLE_W) / 2);
  const ball = useRef({ x: width / 2, y: paddleY - BALL, vx: 0, vy: 0, stuck: true });
  const bricks = useRef<Brick[]>([]);
  const level = useRef(0);
  const lives = useRef(LIVES);
  const [, setFrame] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  const loadLevel = useCallback((idx: number) => {
    bricks.current = getLevel(idx).map((b, i) => ({ id: idx * 1000 + i, ...b }));
  }, []);

  const resetBall = useCallback(() => {
    ball.current = { x: paddleX.current + PADDLE_W / 2, y: paddleY - BALL, vx: 0, vy: 0, stuck: true };
  }, [paddleY]);

  const resetWorld = useCallback(() => {
    level.current = 0;
    lives.current = LIVES;
    paddleX.current = (width - PADDLE_W) / 2;
    loadLevel(0);
    resetBall();
    setBanner(null);
  }, [width, loadLevel, resetBall]);

  const launch = () => {
    const b = ball.current;
    if (!b.stuck) return;
    const speed = BASE_BALL_SPEED + level.current * 0.35;
    const angle = (-Math.PI / 2) + (Math.random() * 0.8 - 0.4);
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.stuck = false;
  };

  const brickRect = (br: Brick) => ({
    x: 12 + br.col * (brickW + BRICK_GAP),
    y: playTop + br.row * (BRICK_H + BRICK_GAP),
    w: brickW,
    h: BRICK_H,
  });

  useGameLoop((dt) => {
    if (round.phaseRef.current !== 'playing') return;
    const b = ball.current;
    if (b.stuck) {
      b.x = paddleX.current + PADDLE_W / 2;
      setFrame((f) => f + 1);
      return;
    }
    // Sub-step so a fast ball can't tunnel through bricks.
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;

      if (b.x <= 0) { b.x = 0; b.vx = Math.abs(b.vx); }
      if (b.x + BALL >= width) { b.x = width - BALL; b.vx = -Math.abs(b.vx); }
      if (b.y <= playTop - 30) { b.y = playTop - 30; b.vy = Math.abs(b.vy); }

      // Paddle
      if (
        b.vy > 0 &&
        b.y + BALL >= paddleY &&
        b.y + BALL <= paddleY + PADDLE_H + 6 &&
        b.x + BALL >= paddleX.current &&
        b.x <= paddleX.current + PADDLE_W
      ) {
        const hit = (b.x + BALL / 2 - (paddleX.current + PADDLE_W / 2)) / (PADDLE_W / 2);
        const speed = Math.hypot(b.vx, b.vy);
        const angle = hit * (Math.PI / 3); // up to 60°
        b.vx = Math.sin(angle) * speed;
        b.vy = -Math.cos(angle) * speed;
        b.y = paddleY - BALL;
      }

      // Bricks
      for (const br of bricks.current) {
        const r = brickRect(br);
        if (b.x < r.x + r.w && b.x + BALL > r.x && b.y < r.y + r.h && b.y + BALL > r.y) {
          const overlapX = Math.min(b.x + BALL - r.x, r.x + r.w - b.x);
          const overlapY = Math.min(b.y + BALL - r.y, r.y + r.h - b.y);
          if (overlapX < overlapY) {
            b.vx = -b.vx;
            b.x += b.vx > 0 ? overlapX : -overlapX;
          } else {
            b.vy = -b.vy;
            b.y += b.vy > 0 ? overlapY : -overlapY;
          }
          br.hits -= 1;
          round.addScore(br.hits <= 0 ? 20 : 10);
          break;
        }
      }
      bricks.current = bricks.current.filter((br) => br.hits > 0);

      if (bricks.current.length === 0) {
        round.addScore(LEVEL_BONUS);
        level.current += 1;
        loadLevel(level.current);
        resetBall();
        setBanner(`LEVEL ${level.current + 1}`);
        setTimeout(() => setBanner(null), 900);
        break;
      }

      if (b.y > height) {
        lives.current -= 1;
        if (lives.current <= 0) {
          round.end();
          return;
        }
        resetBall();
        break;
      }
    }
    setFrame((f) => f + 1);
  }, round.phase === 'playing');

  const movePaddle = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX ?? e.nativeEvent.pageX;
    paddleX.current = Math.max(0, Math.min(width - PADDLE_W, x - PADDLE_W / 2));
    if (ball.current.stuck) ball.current.x = paddleX.current + PADDLE_W / 2;
    setFrame((f) => f + 1);
  };

  const onTouchStart = (e: GestureResponderEvent) => {
    if (round.phaseRef.current === 'idle') {
      resetWorld();
      round.start();
      return;
    }
    if (round.phaseRef.current !== 'playing') return;
    movePaddle(e);
    launch();
  };

  const restart = () => {
    resetWorld();
    round.reset();
  };

  return (
    <View
      style={styles.container}
      testID="brikbreak-screen"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onTouchStart}
      onResponderMove={movePaddle}
    >
      <BackButton />
      <Hud
        score={round.score}
        best={round.best}
        extra={round.phase === 'playing' ? `LVL ${level.current + 1} · ${'●'.repeat(lives.current)}` : undefined}
      />
      {round.phase === 'idle' && <TapToStart title="BRIK BREAK" hint="DRAG TO MOVE · TAP TO LAUNCH" />}

      {bricks.current.map((br) => {
        const r = brickRect(br);
        return (
          <View
            key={br.id}
            style={[
              styles.brick,
              { left: r.x, top: r.y, width: r.w, height: r.h },
              br.hits >= 2 && styles.brickHard,
            ]}
          />
        );
      })}

      <View style={[styles.paddle, { left: paddleX.current, top: paddleY, width: PADDLE_W, height: PADDLE_H }]} />
      <View style={[styles.ball, { left: ball.current.x, top: ball.current.y }]} />

      {banner && <Text style={styles.banner}>{banner}</Text>}
      {round.phase === 'playing' && ball.current.stuck && (
        <Text style={[styles.hint, { bottom: insets.bottom + 40 }]}>TAP TO LAUNCH</Text>
      )}

      {round.phase === 'over' && (
        <GameOver score={round.score} highScore={round.best} isNewRecord={round.isNewRecord} onRestart={restart} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  brick: { position: 'absolute', backgroundColor: Colors.foreground },
  brickHard: { backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.foreground },
  paddle: { position: 'absolute', backgroundColor: Colors.foreground },
  ball: { position: 'absolute', width: BALL, height: BALL, borderRadius: BALL / 2, backgroundColor: Colors.foreground },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    color: Colors.foreground,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
  },
  hint: { position: 'absolute', alignSelf: 'center', color: Colors.dim, fontSize: 11, letterSpacing: 4 },
});
