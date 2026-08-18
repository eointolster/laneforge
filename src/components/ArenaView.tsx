import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Canvas } from '@shopify/react-native-skia';
import { Platform, type GestureResponderEvent, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { CameraState, GameState, GraphicsQuality, Point } from '@/game/types';
import { DrawEffects } from '@/rendering/drawEffects';
import { DrawEntities } from '@/rendering/drawEntities';
import { DrawMap } from '@/rendering/drawMap';
import { createArena3DRenderer } from '@/rendering/gl/arena3dRenderer';

type ArenaViewProps = {
  state: GameState;
  camera: CameraState;
  graphicsQuality: GraphicsQuality;
  onLayoutSize: (size: { width: number; height: number }) => void;
  onZoomChange: (zoom: number, focalPoint?: Point) => void;
};

export const ArenaView = memo(function ArenaView({ state, camera, graphicsQuality, onLayoutSize, onZoomChange }: ArenaViewProps) {
  const stateRef = useRef(state);
  const cameraRef = useRef(camera);
  const qualityRef = useRef(graphicsQuality);
  const rendererRef = useRef<ReturnType<typeof createArena3DRenderer> | null>(null);
  const mountedRef = useRef(true);
  const [renderMode, setRenderMode] = useState<'loading' | 'gl' | 'fallback'>('loading');
  const pinchStartZoomRef = useRef(camera.zoom);
  const pinchLiveZoomRef = useRef(camera.zoom);
  const manualPinchStartDistanceRef = useRef(0);
  const canUseSkiaFallback = Platform.OS !== 'web' || typeof (globalThis as typeof globalThis & { CanvasKit?: unknown }).CanvasKit !== 'undefined';

  stateRef.current = state;
  cameraRef.current = camera;
  qualityRef.current = graphicsQuality;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      rendererRef.current?.stop();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.stop();
    rendererRef.current = null;
    setRenderMode('loading');

    const fallbackTimer = setTimeout(() => {
      if (mountedRef.current && !rendererRef.current && canUseSkiaFallback) {
        setRenderMode('fallback');
      }
    }, 2200);

    return () => clearTimeout(fallbackTimer);
  }, [canUseSkiaFallback, graphicsQuality]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      onLayoutSize({ width, height });
      rendererRef.current?.resize();
    }
  }, [onLayoutSize]);

  const handleContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    try {
      rendererRef.current?.stop();
      rendererRef.current = createArena3DRenderer(
        gl,
        () => stateRef.current,
        () => cameraRef.current,
        () => qualityRef.current,
      );
      rendererRef.current.start();
      if (mountedRef.current) {
        setRenderMode('gl');
      }
    } catch (error) {
      console.warn('ArenaView GL renderer failed, using Skia fallback.', error);
      rendererRef.current?.stop();
      rendererRef.current = null;
      if (mountedRef.current) {
        setRenderMode('fallback');
      }
    }
  }, []);

  const handlePinchStart = useCallback(() => {
    pinchStartZoomRef.current = cameraRef.current.zoom;
    pinchLiveZoomRef.current = cameraRef.current.zoom;
  }, []);

  const handlePinchUpdate = useCallback((scale: number, focalPoint: Point) => {
    pinchLiveZoomRef.current = pinchStartZoomRef.current * scale;
    onZoomChange(pinchLiveZoomRef.current, focalPoint);
  }, [onZoomChange]);

  const handleManualPinchStart = useCallback((event: GestureResponderEvent) => {
    const distance = touchDistance(event);
    if (!distance) return;

    manualPinchStartDistanceRef.current = distance;
    handlePinchStart();
  }, [handlePinchStart]);

  const handleManualPinchMove = useCallback((event: GestureResponderEvent) => {
    const distance = touchDistance(event);
    if (!distance || manualPinchStartDistanceRef.current <= 0) return;

    handlePinchUpdate(distance / manualPinchStartDistanceRef.current, touchFocalPoint(event));
  }, [handlePinchUpdate]);

  const handleManualPinchEnd = useCallback((event?: GestureResponderEvent) => {
    if (event && event.nativeEvent.touches.length >= 2) return;

    manualPinchStartDistanceRef.current = 0;
  }, []);

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .shouldCancelWhenOutside(false)
    .cancelsTouchesInView(false)
    .onStart(() => {
      handlePinchStart();
    })
    .onUpdate((event: { scale: number; focalX: number; focalY: number }) => {
      handlePinchUpdate(event.scale, { x: event.focalX, y: event.focalY });
    });

  return (
    <GestureDetector gesture={pinchGesture}>
      <View
        collapsable={false}
        style={styles.container}
        onLayout={handleLayout}
        onTouchStart={handleManualPinchStart}
        onTouchMove={handleManualPinchMove}
        onTouchEnd={handleManualPinchEnd}
        onTouchCancel={handleManualPinchEnd}
      >
        {renderMode !== 'fallback' ? (
          <GLView
            key={graphicsQuality}
            pointerEvents="none"
            style={styles.canvas}
            onContextCreate={handleContextCreate}
            msaaSamples={graphicsQuality === 'high' ? 2 : 0}
            enableExperimentalWorkletSupport={false}
          />
        ) : null}
        {renderMode === 'fallback' && canUseSkiaFallback ? (
          <Canvas pointerEvents="none" style={styles.canvas}>
            <DrawMap camera={camera} />
            <DrawEntities state={state} camera={camera} />
            <DrawEffects camera={camera} chainArcs={state.chainArcs} effects={state.effects} warnings={state.warnings} floatingText={[]} />
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  );
});

function touchDistance(event: GestureResponderEvent) {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return 0;

  return Math.hypot(second.locationX - first.locationX, second.locationY - first.locationY);
}

function touchFocalPoint(event: GestureResponderEvent): Point {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) {
    return { x: 0, y: 0 };
  }

  return {
    x: (first.locationX + second.locationX) / 2,
    y: (first.locationY + second.locationY) / 2,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1817',
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
});
