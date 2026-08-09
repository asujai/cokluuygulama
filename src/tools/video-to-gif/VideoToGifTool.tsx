import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  ConversionProgress,
  GifConversionOptions,
  GifFps,
  GifResolution,
  GifResult,
  VideoInfo,
} from './types';
import {
  RESOLUTION_MAP,
  convertVideoToGif,
  formatFileSize,
  shareOrDownloadGif,
} from './gifEncoder';

export const VideoToGifTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(null);

  // Conversion Options
  const [options, setOptions] = useState<GifConversionOptions>({
    startTime: 0,
    endTime: 3,
    fps: 10,
    resolution: '360p',
    speed: 1,
    loop: true,
  });

  // State
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ConversionProgress>({
    phase: 'extracting',
    percent: 0,
    currentFrame: 0,
    totalFrames: 0,
  });
  const [gifResult, setGifResult] = useState<GifResult | null>(null);

  // Pick Video
  const handlePickVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Video seçebilmek için galeri izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const durationSec = asset.duration ? Math.round(asset.duration / 1000) : 5;

        setSelectedVideo({
          uri: asset.uri,
          name: asset.fileName || `video_${Date.now()}.mp4`,
          duration: Math.max(1, durationSec),
          width: asset.width || 640,
          height: asset.height || 480,
          size: asset.fileSize,
        });

        setOptions((prev) => ({
          ...prev,
          startTime: 0,
          endTime: Math.min(5, Math.max(1, durationSec)),
        }));
        setGifResult(null);
      }
    } catch (err) {
      console.warn('Video picker error:', err);
    }
  };

  // Run Conversion
  const handleStartConversion = async () => {
    if (!selectedVideo) return;

    if (options.endTime <= options.startTime) {
      Alert.alert('Hata', 'Bitiş süresi başlangıç süresinden büyük olmalıdır.');
      return;
    }

    if (options.endTime - options.startTime > 15) {
      Alert.alert('Uyarı', 'Cihaz performansı için maksimum GIF süresi 15 saniyedir.');
      return;
    }

    setIsConverting(true);
    setProgress({ phase: 'extracting', percent: 0, currentFrame: 0, totalFrames: 0 });

    try {
      const result = await convertVideoToGif(
        selectedVideo.uri,
        selectedVideo.name,
        options,
        (prog) => setProgress(prog)
      );
      setGifResult(result);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'GIF dönüştürme işlemi başarısız oldu.');
    } finally {
      setIsConverting(false);
    }
  };

  const selectedDuration = Math.max(0, options.endTime - options.startTime);
  const estimatedFrames = Math.round(selectedDuration * options.fps);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {!selectedVideo ? (
        /* Empty / Pick Video View */
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.xl,
              padding: spacing.xl,
              alignItems: 'center',
            },
          ]}
        >
          <View
            style={[
              styles.heroIconBox,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Ionicons name="film-outline" size={48} color={theme.onPrimaryContainer} />
          </View>

          <Text
            style={[
              typography.titleMedium,
              { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            Video - GIF Dönüştürücü
          </Text>

          <Text
            style={[
              typography.bodyMedium,
              {
                color: theme.textSecondary,
                marginTop: spacing.xs,
                textAlign: 'center',
                lineHeight: 20,
              },
            ]}
          >
            Videolarınızdan dilediğiniz bölümü kırpın, çözünürlük ve kare hızını (FPS) ayarlayarak yüksek kaliteli animasyonlu GIF üretin.
          </Text>

          <TouchableOpacity
            onPress={handlePickVideo}
            style={[
              styles.pickBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.md,
                marginTop: spacing.xl,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
              },
            ]}
          >
            <Ionicons name="videocam" size={22} color={theme.onPrimary} />
            <Text
              style={[
                typography.labelLarge,
                { color: theme.onPrimary, marginLeft: spacing.xs },
              ]}
            >
              Video Seç
            </Text>
          </TouchableOpacity>

          {/* Quick Specs */}
          <View style={[styles.specsRow, { marginTop: spacing.xl }]}>
            <View style={styles.specItem}>
              <Ionicons name="cut-outline" size={16} color={theme.accent} />
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginLeft: 4 }]}>
                Zaman Kırpma
              </Text>
            </View>
            <View style={styles.specItem}>
              <Ionicons name="speedometer-outline" size={16} color={theme.accent} />
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginLeft: 4 }]}>
                5 - 20 FPS Hız
              </Text>
            </View>
            <View style={styles.specItem}>
              <Ionicons name="repeat-outline" size={16} color={theme.accent} />
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginLeft: 4 }]}>
                Sonsuz Döngü
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* Selected Video & Conversion Controls */
        <View>
          {/* Video Summary Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
              },
            ]}
          >
            <View style={styles.videoSummaryRow}>
              <View
                style={[
                  styles.videoIconPill,
                  {
                    backgroundColor: theme.primaryContainer,
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Ionicons name="videocam" size={24} color={theme.onPrimaryContainer} />
              </View>

              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                  {selectedVideo.name}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
                  {selectedVideo.width} × {selectedVideo.height} • Toplam: {selectedVideo.duration} sn
                  {selectedVideo.size ? ` • ${formatFileSize(selectedVideo.size)}` : ''}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setSelectedVideo(null)} style={{ padding: 4 }}>
                <Ionicons name="swap-horizontal" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Trimming Controls Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                marginTop: spacing.sm,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Zaman Aralığı & Kırpma
            </Text>

            <View style={[styles.trimInputsGrid, { marginTop: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  Başlangıç (sn):
                </Text>
                <TextInput
                  value={String(options.startTime)}
                  onChangeText={(val) => {
                    const num = parseFloat(val) || 0;
                    setOptions((prev) => ({ ...prev, startTime: Math.max(0, num) }));
                  }}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xxs,
                      padding: spacing.sm,
                    },
                  ]}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  Bitiş (sn):
                </Text>
                <TextInput
                  value={String(options.endTime)}
                  onChangeText={(val) => {
                    const num = parseFloat(val) || 0;
                    setOptions((prev) => ({ ...prev, endTime: num }));
                  }}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xxs,
                      padding: spacing.sm,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Trimming Info Badge */}
            <View
              style={[
                styles.trimBadge,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderRadius: borderRadius.sm,
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                },
              ]}
            >
              <Ionicons name="time-outline" size={16} color={theme.primary} />
              <Text
                style={[
                  typography.labelSmall,
                  { color: theme.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                GIF Süresi: {selectedDuration.toFixed(1)} sn • Yaklaşık {estimatedFrames} Kare
              </Text>
            </View>
          </View>

          {/* Quality & Resolution Settings */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                marginTop: spacing.sm,
                padding: spacing.md,
              },
            ]}
          >
            {/* Resolution */}
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Çözünürlük
            </Text>
            <View style={[styles.inlineChipsRow, { marginTop: spacing.xs }]}>
              {(['240p', '360p', '480p'] as GifResolution[]).map((res) => {
                const isSelected = options.resolution === res;
                return (
                  <TouchableOpacity
                    key={res}
                    onPress={() => setOptions((prev) => ({ ...prev, resolution: res }))}
                    style={[
                      styles.resChip,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderRadius: borderRadius.sm,
                        paddingVertical: 6,
                        paddingHorizontal: spacing.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: isSelected ? theme.onPrimary : theme.textPrimary },
                      ]}
                    >
                      {RESOLUTION_MAP[res].label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* FPS */}
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginTop: spacing.md }]}>
              Kare Hızı (FPS)
            </Text>
            <View style={[styles.inlineChipsRow, { marginTop: spacing.xs }]}>
              {([5, 10, 15, 20] as GifFps[]).map((fpsVal) => {
                const isSelected = options.fps === fpsVal;
                return (
                  <TouchableOpacity
                    key={fpsVal}
                    onPress={() => setOptions((prev) => ({ ...prev, fps: fpsVal }))}
                    style={[
                      styles.fpsChip,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderRadius: borderRadius.sm,
                        paddingVertical: 6,
                        paddingHorizontal: spacing.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: isSelected ? theme.onPrimary : theme.textPrimary },
                      ]}
                    >
                      {fpsVal} FPS
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Convert Trigger Button */}
          <TouchableOpacity
            onPress={handleStartConversion}
            disabled={isConverting}
            style={[
              styles.convertPrimaryBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.md,
                marginTop: spacing.md,
                paddingVertical: spacing.md,
              },
            ]}
            accessibilityRole="button"
          >
            {isConverting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  {progress.phase === 'extracting'
                    ? `Kareler Çıkartılıyor (${progress.currentFrame}/${progress.totalFrames})...`
                    : `GIF Kodlanıyor (%${progress.percent})...`}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  GIF'e Dönüştür
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* GIF Live Result Card */}
          {gifResult && (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.success,
                  borderRadius: borderRadius.xl,
                  marginTop: spacing.lg,
                  padding: spacing.lg,
                  alignItems: 'center',
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={28} color={theme.success} />
                <View style={{ marginLeft: spacing.xs, flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                    GIF Başarıyla Oluşturuldu!
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                    {gifResult.width} × {gifResult.height} • {gifResult.framesCount} Kare • {formatFileSize(gifResult.fileSize)}
                  </Text>
                </View>
              </View>

              {/* Looping GIF Preview Image */}
              <View
                style={[
                  styles.gifPreviewBox,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.lg,
                    marginTop: spacing.md,
                    padding: 4,
                  },
                ]}
              >
                <Image
                  source={{ uri: gifResult.uri }}
                  style={{
                    width: Math.min(300, gifResult.width),
                    height: Math.min(300, (gifResult.height * Math.min(300, gifResult.width)) / gifResult.width),
                    borderRadius: 8,
                  }}
                  resizeMode="contain"
                />
              </View>

              {/* Action Buttons */}
              <View style={[styles.resultButtonsGrid, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  onPress={() => shareOrDownloadGif(gifResult.uri, gifResult.fileName)}
                  style={[
                    styles.resultBtn,
                    {
                      backgroundColor: theme.primary,
                      borderRadius: borderRadius.md,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="download-outline" size={20} color={theme.onPrimary} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.onPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    GIF İndir / Paylaş
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setGifResult(null)}
                  style={[
                    styles.resultBtn,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="refresh" size={18} color={theme.textPrimary} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.textPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    Yeni GIF
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
  },
  heroIconBox: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
  },
  videoSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoIconPill: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimInputsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  textInput: {
    borderWidth: 1,
    fontSize: 15,
  },
  trimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resChip: {
    borderWidth: 1,
  },
  fpsChip: {
    borderWidth: 1,
  },
  convertPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultCard: {
    borderWidth: 1.5,
    width: '100%',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  gifPreviewBox: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultButtonsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  resultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
