import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';

interface Props {
  score: number;
  highScore: number;
  isNewRecord: boolean;
  onRestart: () => void;
  inverted?: boolean;
  title?: string;
}

export default function GameOver({
  score,
  highScore,
  isNewRecord,
  onRestart,
  inverted = false,
  title = 'GAME OVER',
}: Props) {
  const router = useRouter();
  const fg = inverted ? Colors.background : Colors.foreground;
  const bg = inverted ? 'rgba(255,255,255,0.94)' : 'rgba(0,0,0,0.94)';

  return (
    <View style={[styles.overlay, { backgroundColor: bg }]} testID="game-over">
      <Text style={[styles.title, { color: fg }]}>{title}</Text>
      <Text style={[styles.score, { color: fg }]}>{score}</Text>
      <View style={styles.bestRow}>
        <Text style={styles.best}>BEST {highScore}</Text>
        {isNewRecord && (
          <View style={[styles.badge, { backgroundColor: fg }]}>
            <Text style={[styles.badgeText, { color: inverted ? Colors.foreground : Colors.background }]}>
              NEW
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={onRestart}
        testID="play-again"
        style={({ pressed }) => [styles.primary, { borderColor: fg, opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.primaryText, { color: fg }]}>PLAY AGAIN</Text>
      </Pressable>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID="back-to-arcade"
        style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={styles.secondaryText}>BACK TO ARCADE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    marginBottom: 24,
  },
  score: {
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: 4,
    marginBottom: 8,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 48,
  },
  best: {
    color: Colors.secondary,
    fontSize: 14,
    letterSpacing: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  primary: {
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 20,
    minWidth: 240,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 5,
  },
  secondary: {
    paddingVertical: 12,
  },
  secondaryText: {
    color: Colors.secondary,
    fontSize: 12,
    letterSpacing: 4,
  },
});
