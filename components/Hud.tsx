import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

interface Props {
  score: number;
  best: number;
  extra?: string;
  inverted?: boolean;
}

/** Top-right score readout shared by all games. */
export default function Hud({ score, best, extra, inverted = false }: Props) {
  const insets = useSafeAreaInsets();
  const fg = inverted ? Colors.background : Colors.foreground;
  return (
    <View style={[styles.wrap, { top: insets.top + 12 }]} pointerEvents="none">
      <Text style={[styles.score, { color: fg }]} testID="hud-score">
        {score}
      </Text>
      <Text style={styles.best}>BEST {best}</Text>
      {extra ? <Text style={styles.best}>{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    zIndex: 20,
  },
  score: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 3,
  },
  best: {
    color: Colors.secondary,
    fontSize: 11,
    letterSpacing: 3,
    marginTop: 2,
  },
});
