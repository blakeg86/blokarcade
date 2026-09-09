import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { GAMES } from '@/constants/games';
import { useHighScores } from '@/hooks/useHighScores';

export default function ArcadeHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getHighScore } = useHighScores();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} testID="hub-title">
          BLOKARCADE
        </Text>
        <Text style={styles.subtitle}>RUN, MATCH, STACK, BREAK & SLITHER</Text>

        <View style={styles.list}>
          {GAMES.map((game, i) => {
            const best = getHighScore(game.id);
            return (
              <Pressable
                key={game.id}
                testID={`game-${game.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Play ${game.title}`}
                onPress={() => router.push(`/${game.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.index}>{String(i + 1).padStart(2, '0')}</Text>
                  <View>
                    <Text style={styles.cardTitle}>{game.title}</Text>
                    <Text style={styles.cardTagline}>{game.tagline}</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.bestLabel}>BEST</Text>
                  <Text style={styles.bestValue}>{best}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24 },
  title: {
    color: Colors.foreground,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.secondary,
    fontSize: 11,
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 48,
  },
  list: { gap: 14 },
  card: {
    borderWidth: 1,
    borderColor: Colors.foreground,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardPressed: { backgroundColor: Colors.faint },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  index: { color: Colors.secondary, fontSize: 12, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  cardTitle: { color: Colors.foreground, fontSize: 16, fontWeight: '700', letterSpacing: 5 },
  cardTagline: { color: Colors.secondary, fontSize: 11, letterSpacing: 1.5, marginTop: 5 },
  cardRight: { alignItems: 'flex-end', marginLeft: 12 },
  bestLabel: { color: Colors.secondary, fontSize: 9, letterSpacing: 3 },
  bestValue: { color: Colors.foreground, fontSize: 18, fontWeight: '300', letterSpacing: 2, marginTop: 2 },
});
