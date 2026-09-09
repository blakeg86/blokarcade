import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

interface Props {
  inverted?: boolean;
}

export default function BackButton({ inverted = false }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const color = inverted ? Colors.background : Colors.foreground;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Pressable
      onPress={goBack}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Back to arcade"
      testID="back-button"
      style={({ pressed }) => [styles.button, { top: insets.top + 12, opacity: pressed ? 0.5 : 1 }]}
    >
      <Text style={[styles.label, { color }]}>← BACK</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 20,
    zIndex: 20,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
  },
});
