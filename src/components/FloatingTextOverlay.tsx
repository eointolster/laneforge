import { StyleSheet, Text, View } from 'react-native';

import { projectedScale, worldToScreen } from '@/game/camera';
import type { CameraState, FloatingText } from '@/game/types';

type FloatingTextOverlayProps = {
  camera: CameraState;
  floatingText: FloatingText[];
};

export function FloatingTextOverlay({ camera, floatingText }: FloatingTextOverlayProps) {
  const scale = projectedScale(camera);
  const stackCounts = new Map<string, number>();

  return (
    <View pointerEvents="none" style={styles.root}>
      {floatingText.map((item) => {
        const point = worldToScreen(camera, item.position);
        if (point.x < -80 || point.x > camera.width + 80 || point.y < -80 || point.y > camera.height + 80) {
          return null;
        }

        const opacity = Math.max(0, Math.min(1, item.ttl / 0.42));
        const stackKey = `${Math.round(point.x / 28)}:${Math.round(point.y / 22)}`;
        const stackIndex = stackCounts.get(stackKey) ?? 0;
        stackCounts.set(stackKey, stackIndex + 1);
        const fontSize = getFontSize(item.size, scale);

        return (
          <Text
            key={item.id}
            numberOfLines={1}
            style={[
              styles.text,
              {
                color: item.color,
                fontSize,
                opacity,
                left: point.x + (stackIndex % 2 === 0 ? -stackIndex * 6 : stackIndex * 6),
                top: point.y - stackIndex * 15,
              },
            ]}
          >
            {item.text}
          </Text>
        );
      })}
    </View>
  );
}

function getFontSize(size: FloatingText['size'], scale: number) {
  const base = size === 'large' ? 17 : size === 'small' ? 12 : 14;
  return Math.max(12, Math.min(size === 'large' ? 22 : 18, base + scale * 4));
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  text: {
    position: 'absolute',
    width: 84,
    marginLeft: -42,
    marginTop: -18,
    textAlign: 'center',
    fontWeight: '900',
    color: '#EAF8F5',
    textShadowColor: 'rgba(0,0,0,0.82)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
