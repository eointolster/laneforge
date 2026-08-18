import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type MenuRouteScreenProps = {
  title: string;
  accent: string;
  children: ReactNode;
};

export function MenuRouteScreen({ title, accent, children }: MenuRouteScreenProps) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compact = width < 620 || height < 430;

  return (
    <LinearGradient colors={['#120921', '#0C1F24', '#071013']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.root, compact && styles.rootCompact]}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={[styles.title, compact && styles.titleCompact, { color: accent }]} numberOfLines={1}>{title}</Text>
          </View>
          <View style={[styles.content, compact && styles.contentCompact]}>{children}</View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
    paddingHorizontal: 42,
    paddingVertical: 20,
  },
  rootCompact: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  backButton: {
    height: 32,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,248,245,0.2)',
    backgroundColor: 'rgba(5,12,17,0.62)',
  },
  pressed: {
    opacity: 0.7,
  },
  backText: {
    color: '#EAF8F5',
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    flex: 1,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
  },
  titleCompact: {
    fontSize: 21,
  },
  content: {
    flex: 1,
    paddingTop: 14,
  },
  contentCompact: {
    paddingTop: 9,
  },
});
