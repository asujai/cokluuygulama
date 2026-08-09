import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../core/theme';
import { MagnifierState, ZoomPreset } from './types';
import { zoomToScale, scaleToZoom, formatZoomLabel } from './magnifierService';

const PRESETS: ZoomPreset[] = [1, 2, 4, 8, 10];

export const MagnifierTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [state, setState] = useState<MagnifierState>({
    zoom: 0,
    isTorchOn: false,
    isFrozen: false,
    facing: 'back',
    frozenImageUri: null,
  });

  const [webStream, setWebStream] = useState<any>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Web camera initialization
  useEffect(() => {
    if (Platform.OS === 'web') {
      let active = true;
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            if (active) {
              setWebStream(stream);
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
              }
            }
          })
          .catch((err) => {
            if (active) {
              setWebError('Web kamerasını başlatılamadı. İzinlerin verildiğinden emin olun.');
            }
          });
      } else {
        setWebError('Bu tarayıcıda canlı kamera erişimi (getUserMedia) desteklenmiyor.');
      }
      return () => {
        active = false;
        if (webStream && webStream.getTracks) {
          webStream.getTracks().forEach((track: any) => track.stop());
        }
      };
    }
  }, [state.facing]);

  const scale = zoomToScale(state.zoom);

  const setZoomLevel = (newZoom: number) => {
    const clamped = Math.max(0, Math.min(1, newZoom));
    setState((prev) => ({ ...prev, zoom: clamped }));
  };

  const handlePresetSelect = (preset: ZoomPreset) => {
    setZoomLevel(scaleToZoom(preset));
  };

  const toggleTorch = () => {
    setState((prev) => ({ ...prev, isTorchOn: !prev.isTorchOn }));
  };

  const toggleFacing = () => {
    setState((prev) => ({
      ...prev,
      facing: prev.facing === 'back' ? 'front' : 'back',
    }));
  };

  const toggleFreeze = async () => {
    if (state.isFrozen) {
      // Unfreeze
      setState((prev) => ({
        ...prev,
        isFrozen: false,
        frozenImageUri: null,
      }));
    } else {
      // Freeze frame
      if (Platform.OS === 'web') {
        if (videoRef.current) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg');
              setState((prev) => ({
                ...prev,
                isFrozen: true,
                frozenImageUri: dataUrl,
              }));
            }
          } catch (e) {
            setState((prev) => ({ ...prev, isFrozen: true }));
          }
        } else {
          setState((prev) => ({ ...prev, isFrozen: true }));
        }
      } else {
        if (cameraRef.current) {
          try {
            const photo = await cameraRef.current.takePictureAsync({
              quality: 0.85,
              skipProcessing: true,
            });
            if (photo && photo.uri) {
              setState((prev) => ({
                ...prev,
                isFrozen: true,
                frozenImageUri: photo.uri,
              }));
            } else {
              setState((prev) => ({ ...prev, isFrozen: true }));
            }
          } catch (err) {
            // Fallback freeze state without static image
            setState((prev) => ({ ...prev, isFrozen: true }));
          }
        }
      }
    }
  };

  const handleShareFrozenImage = async () => {
    if (!state.frozenImageUri) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(state.frozenImageUri);
      }
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  // Permission handling
  if (!permission && Platform.OS !== 'web') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.permissionText, { color: theme.textSecondary, marginTop: spacing.md }]}>
          Kamera izinleri kontrol ediliyor...
        </Text>
      </View>
    );
  }

  if (Platform.OS !== 'web' && !permission?.granted) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background, padding: spacing.xl }]}>
        <Ionicons name="camera-outline" size={64} color={theme.primary} />
        <Text style={[styles.permissionTitle, { color: theme.textPrimary, marginTop: spacing.md }]}>
          Kamera İzni Gerekli
        </Text>
        <Text style={[styles.permissionSub, { color: theme.textSecondary, marginVertical: spacing.sm }]}>
          Büyüteç özelliğini kullanabilmek için kamera erişim izni vermeniz gerekmektedir.
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
          onPress={requestPermission}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
          <Text style={[styles.actionBtnText, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
            Kamera İzni Ver
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      {/* Top Header / Status bar */}
      <View style={styles.topBar}>
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: state.isFrozen ? theme.warning : theme.success }]}>
            <Text style={styles.badgeText}>{state.isFrozen ? 'DONDURULDU' : 'CANLI'}</Text>
          </View>
          <Text style={styles.zoomTitle}>{formatZoomLabel(state.zoom)}</Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: state.isTorchOn ? theme.star : 'rgba(255,255,255,0.2)' },
            ]}
            onPress={toggleTorch}
            disabled={state.isFrozen}
          >
            <Ionicons
              name={state.isTorchOn ? 'flash' : 'flash-outline'}
              size={22}
              color={state.isTorchOn ? '#000000' : '#FFFFFF'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={toggleFacing}
            disabled={state.isFrozen}
          >
            <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: state.isFrozen ? theme.error : 'rgba(255,255,255,0.2)' },
            ]}
            onPress={toggleFreeze}
          >
            <Ionicons name={state.isFrozen ? 'play' : 'pause'} size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Camera Preview / Freeze Area */}
      <View style={styles.previewContainer}>
        {state.isFrozen && state.frozenImageUri ? (
          <View style={styles.frozenContainer}>
            <Image
              source={{ uri: state.frozenImageUri }}
              style={[
                styles.frozenImage,
                {
                  transform: [{ scale }],
                },
              ]}
              resizeMode="contain"
            />
          </View>
        ) : Platform.OS === 'web' ? (
          webError ? (
            <View style={styles.webErrorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.warning} />
              <Text style={[styles.webErrorText, { color: '#FFFFFF' }]}>{webError}</Text>
              <Text style={[styles.webSubText, { color: theme.textMuted }]}>
                Büyüteç simülasyonu: Yakınlaştırmak için aşağıdaki zoom kontrollerini kullanabilirsiniz.
              </Text>
            </View>
          ) : (
            <View style={styles.webVideoContainer}>
              {/* @ts-ignore */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: `scale(${scale})`,
                  transition: 'transform 0.1s ease-out',
                }}
              />
            </View>
          )
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={state.facing}
            zoom={state.zoom}
            enableTorch={state.isTorchOn}
          />
        )}

        {/* Crosshair / Target reticle overlay */}
        <View style={styles.reticleOverlay} pointerEvents="none">
          <View style={styles.reticleCenter} />
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.controlsBar}>
        {/* Preset zoom quick buttons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {PRESETS.map((p) => {
            const pZoom = scaleToZoom(p);
            const isSelected = Math.abs(state.zoom - pZoom) < 0.05;
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isSelected ? theme.primary : 'rgba(255,255,255,0.15)',
                  },
                ]}
                onPress={() => handlePresetSelect(p)}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: isSelected ? theme.onPrimary : '#FFFFFF' },
                  ]}
                >
                  {p}x
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stepper Zoom Controls */}
        <View style={styles.sliderRow}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setZoomLevel(state.zoom - 0.1)}
          >
            <Ionicons name="remove" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.trackContainer}>
            <View style={styles.trackBackground}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${state.zoom * 100}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setZoomLevel(state.zoom + 0.1)}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Action Footer */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[
              styles.mainActionBtn,
              { backgroundColor: state.isFrozen ? theme.warning : theme.primary },
            ]}
            onPress={toggleFreeze}
          >
            <Ionicons
              name={state.isFrozen ? 'play-outline' : 'snow-outline'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.mainActionText}>
              {state.isFrozen ? 'Canlı Görüntüye Dön' : 'Kareyi Dondur'}
            </Text>
          </TouchableOpacity>

          {state.isFrozen && state.frozenImageUri && (
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={handleShareFrozenImage}
            >
              <Ionicons name="share-outline" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionText: {
    fontSize: 14,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  permissionSub: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  zoomTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  frozenContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  frozenImage: {
    width: '100%',
    height: '100%',
  },
  webVideoContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    textAlign: 'center',
  },
  webErrorText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  webSubText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleCenter: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
  },
  controlsBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  presetScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 12,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackContainer: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  mainActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  mainActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
