import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';

interface Props {
  title: string;
  hint: string;
  inverted?: boolean;
}

/** Idle overlay shown before the first input of a round. */
export default function TapToStart({ title, hint, inverted = false }: Props) {
  const fg = inverted ? Colors.background : Colors.foreground;
  return (
    <View style={styles.wrap} pointerEvents="none" testID="tap-to-start">
      <Text style={[styles.title, { color: fg }]}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Text style={styles.hint}>TAP TO START</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    marginBottom: 16,
  },
  hint: {
    color: Colors.secondary,
    fontSize: 12,
    letterSpacing: 4,
    marginTop: 6,
  },
});
