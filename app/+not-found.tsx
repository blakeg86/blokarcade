import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'BlokArcade' }} />
      <View style={styles.container}>
        <Text style={styles.title}>NOT FOUND</Text>
        <Text style={styles.sub}>This screen doesn't exist in BlokArcade.</Text>
        <Link href="/" style={styles.link}>
          BACK TO ARCADE
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 24 },
  title: { color: Colors.foreground, fontSize: 22, fontWeight: '700', letterSpacing: 8, marginBottom: 12 },
  sub: { color: Colors.secondary, fontSize: 13, letterSpacing: 1, marginBottom: 32 },
  link: { color: Colors.foreground, fontSize: 13, letterSpacing: 4, borderWidth: 1, borderColor: Colors.foreground, paddingVertical: 14, paddingHorizontal: 28 },
});
