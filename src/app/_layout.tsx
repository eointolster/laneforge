import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initMusic, releaseMusic, setMusicEnabled } from '@/audio/music';
import { initSfx, releaseSfx, setSfxEnabled } from '@/audio/sfx';
import { loadProfile } from '@/game/playerProfile';

export default function RootLayout() {
  useEffect(() => {
    void initSfx();
    void initMusic();
    void loadProfile().then((profile) => {
      setSfxEnabled(profile.sfxEnabled);
      setMusicEnabled(profile.sfxEnabled);
    });
    return () => {
      releaseSfx();
      releaseMusic();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar hidden />
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071013',
  },
});
