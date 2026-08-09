import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  CompressionLevel,
  CompressionResult,
  MediaItem,
  MediaType,
  VideoResolution,
} from './types';
import {
  COMPRESSION_LEVELS,
  RESOLUTION_OPTIONS,
  compressImage,
  compressVideo,
  formatFileSize,
  shareCompressedMedia,
} from './compressionService';

export const MediaCompressorTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('medium');
  const [resolution, setResolution] = useState<VideoResolution>('original');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);

  // Pick photo from library
  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçebilmek için galeri izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const approxSize = asset.fileSize || (asset.width && asset.height ? asset.width * asset.height * 0.8 : 3 * 1024 * 1024);

        setSelectedMedia({
          uri: asset.uri,
          name: asset.fileName || `foto_${Date.now()}.jpg`,
          type: 'image',
          originalSize: approxSize,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType || 'image/jpeg',
        });
        setCompressionResult(null);
      }
    } catch (error) {
      console.warn('Error picking image:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    }
  };

  // Pick video from library
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
        const approxSize = asset.fileSize || 18 * 1024 * 1024; // 18MB fallback

        setSelectedMedia({
          uri: asset.uri,
          name: asset.fileName || `video_${Date.now()}.mp4`,
          type: 'video',
          originalSize: approxSize,
          width: asset.width || 1920,
          height: asset.height || 1080,
          duration: asset.duration ? Math.round(asset.duration / 1000) : undefined,
          mimeType: asset.mimeType || 'video/mp4',
        });
        setCompressionResult(null);
      }
    } catch (error) {
      console.warn('Error picking video:', error);
      Alert.alert('Hata', 'Video seçilirken bir hata oluştu.');
    }
  };

  // Perform compression
  const handleCompress = async () => {
    if (!selectedMedia) return;

    setIsCompressing(true);
    try {
      if (selectedMedia.type === 'image') {
        const result = await compressImage(selectedMedia, level, resolution);
        setCompressionResult(result);
      } else {
        const result = await compressVideo(selectedMedia, level, resolution);
        setCompressionResult(result);
      }
    } catch (error: any) {
      console.error('Compression failed:', error);
      Alert.alert('Hata', error?.message || 'Sıkıştırma işlemi gerçekleştirilemedi.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Share or save compressed file
  const handleShareOrSave = async () => {
    if (!compressionResult || !selectedMedia) return;
    try {
      const extension = selectedMedia.type === 'image' ? 'jpg' : 'mp4';
      const outputName = `sikistirilmis_${Date.now()}.${extension}`;
      await shareCompressedMedia(
        compressionResult.compressedUri,
        outputName,
        selectedMedia.mimeType || (selectedMedia.type === 'image' ? 'image/jpeg' : 'video/mp4')
      );
    } catch (error: any) {
      console.error('Share error:', error);
      Alert.alert('Hata', error?.message || 'Dosya paylaşılamadı.');
    }
  };

  // Reset and select new media
  const handleReset = () => {
    setSelectedMedia(null);
    setCompressionResult(null);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {!selectedMedia ? (
        /* Empty / Pick Media View */
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.xl,
              padding: spacing.xl,
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
            <Ionicons name="contract-outline" size={44} color={theme.onPrimaryContainer} />
          </View>

          <Text
            style={[
              typography.titleMedium,
              { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            Video & Fotoğraf Sıkıştırıcı
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
            Görsel ve videolarınızın kalitesini koruyarak boyutunu %80'e varan oranda küçültün. Tamamen cihaz içinde güvenli ve hızlı.
          </Text>

          {/* Media Choice Buttons */}
          <View style={[styles.choiceButtonsRow, { marginTop: spacing.xl }]}>
            <TouchableOpacity
              onPress={handlePickPhoto}
              style={[
                styles.choiceButton,
                {
                  backgroundColor: theme.primary,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Fotoğraf Seç ve Sıkıştır"
            >
              <Ionicons name="image" size={32} color={theme.onPrimary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: theme.onPrimary, marginTop: spacing.xs },
                ]}
              >
                Fotoğraf Seç
              </Text>
              <Text style={[typography.bodySmall, { color: theme.onPrimary, opacity: 0.8 }]}>
                JPEG, PNG, WebP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickVideo}
              style={[
                styles.choiceButton,
                {
                  backgroundColor: theme.accent,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Video Seç ve Sıkıştır"
            >
              <Ionicons name="videocam" size={32} color="#FFFFFF" />
              <Text
                style={[
                  typography.titleSmall,
                  { color: '#FFFFFF', marginTop: spacing.xs },
                ]}
              >
                Video Seç
              </Text>
              <Text style={[typography.bodySmall, { color: '#FFFFFF', opacity: 0.8 }]}>
                MP4, MOV, WebM
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Selected Media & Compression Controls */
        <View>
          {/* Selected Media Info Card */}
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
            <View style={styles.mediaHeaderRow}>
              <View style={styles.mediaInfoLeft}>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor:
                        selectedMedia.type === 'image'
                          ? theme.primaryContainer
                          : theme.warningContainer,
                      borderRadius: borderRadius.xs,
                    },
                  ]}
                >
                  <Ionicons
                    name={selectedMedia.type === 'image' ? 'image-outline' : 'videocam-outline'}
                    size={14}
                    color={
                      selectedMedia.type === 'image'
                        ? theme.onPrimaryContainer
                        : theme.onWarning
                    }
                  />
                  <Text
                    style={[
                      typography.labelSmall,
                      {
                        color:
                          selectedMedia.type === 'image'
                            ? theme.onPrimaryContainer
                            : theme.onWarning,
                        marginLeft: 4,
                      },
                    ]}
                  >
                    {selectedMedia.type === 'image' ? 'FOTOĞRAF' : 'VİDEO'}
                  </Text>
                </View>

                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, marginTop: 4 },
                  ]}
                  numberOfLines={1}
                >
                  {selectedMedia.name}
                </Text>

                <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
                  {selectedMedia.width && selectedMedia.height
                    ? `${selectedMedia.width} × ${selectedMedia.height}`
                    : ''}
                  {selectedMedia.duration ? ` • ${selectedMedia.duration} sn` : ''}
                </Text>
              </View>

              {/* Original File Size Pill */}
              <View
                style={[
                  styles.sizePill,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
                  Orijinal Boyut
                </Text>
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, fontWeight: '700' },
                  ]}
                >
                  {formatFileSize(selectedMedia.originalSize)}
                </Text>
              </View>
            </View>

            {/* Image Preview if photo */}
            {selectedMedia.type === 'image' && (
              <View
                style={[
                  styles.imagePreviewBox,
                  {
                    backgroundColor: theme.inputBackground,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                <Image
                  source={{ uri: selectedMedia.uri }}
                  style={styles.mediaImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Change Media Button */}
            <TouchableOpacity
              onPress={handleReset}
              style={[
                styles.changeMediaBtn,
                { borderTopColor: theme.divider, marginTop: spacing.sm },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Farklı dosya seç"
            >
              <Ionicons name="swap-horizontal" size={16} color={theme.textSecondary} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: theme.textSecondary, marginLeft: spacing.xs },
                ]}
              >
                Farklı Dosya Seç
              </Text>
            </TouchableOpacity>
          </View>

          {/* Compression Level Selector Card */}
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
              Sıkıştırma Seviyesi
            </Text>

            <View style={[styles.levelsContainer, { marginTop: spacing.sm }]}>
              {COMPRESSION_LEVELS.map((item) => {
                const isSelected = level === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setLevel(item.id)}
                    style={[
                      styles.levelCard,
                      {
                        backgroundColor: isSelected
                          ? theme.primaryContainer
                          : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderRadius: borderRadius.md,
                        padding: spacing.md,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.title}
                  >
                    <View style={styles.levelCardHeader}>
                      <View style={styles.levelTitleRow}>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? theme.primary : theme.textMuted}
                        />
                        <Text
                          style={[
                            typography.titleSmall,
                            {
                              color: isSelected ? theme.onPrimaryContainer : theme.textPrimary,
                              marginLeft: spacing.xs,
                            },
                          ]}
                        >
                          {item.title}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.badgeTag,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.cardBorder,
                            borderRadius: borderRadius.xs,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.labelSmall,
                            {
                              color: isSelected ? theme.onPrimary : theme.textSecondary,
                              fontSize: 10,
                            },
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: isSelected ? theme.onPrimaryContainer : theme.textSecondary,
                          marginTop: 4,
                          marginLeft: 28,
                        },
                      ]}
                    >
                      {item.subtitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Video Resolution Selector (if video) */}
          {selectedMedia.type === 'video' && (
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
                Video Çözünürlüğü
              </Text>

              <View style={[styles.resolutionRow, { marginTop: spacing.sm }]}>
                {RESOLUTION_OPTIONS.map((res) => {
                  const isSelected = resolution === res.id;
                  return (
                    <TouchableOpacity
                      key={res.id}
                      onPress={() => setResolution(res.id)}
                      style={[
                        styles.resChip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                          borderColor: isSelected ? theme.primary : theme.cardBorder,
                          borderRadius: borderRadius.sm,
                          paddingVertical: spacing.xs,
                          paddingHorizontal: spacing.sm,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={res.label}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: isSelected ? theme.onPrimary : theme.textPrimary },
                        ]}
                      >
                        {res.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Compress Trigger Button */}
          <TouchableOpacity
            onPress={handleCompress}
            disabled={isCompressing}
            style={[
              styles.compressPrimaryBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.md,
                marginTop: spacing.md,
                paddingVertical: spacing.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Medyayı Sıkıştır"
          >
            {isCompressing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.sm },
                  ]}
                >
                  Sıkıştırılıyor...
                </Text>
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <Ionicons name="sparkles" size={20} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.sm },
                  ]}
                >
                  Sıkıştırmayı Başlat
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Compression Results Card */}
          {compressionResult && (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.success,
                  borderRadius: borderRadius.xl,
                  marginTop: spacing.lg,
                  padding: spacing.lg,
                },
              ]}
            >
              {/* Success Banner */}
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.successIconCircle,
                    {
                      backgroundColor: theme.successContainer,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={28} color={theme.success} />
                </View>
                <View style={styles.resultHeaderTexts}>
                  <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                    Sıkıştırma Tamamlandı!
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                    Dosyanız başarıyla optimize edildi.
                  </Text>
                </View>
              </View>

              {/* Stats Comparison Grid */}
              <View style={[styles.statsGrid, { marginTop: spacing.md }]}>
                {/* Before Size */}
                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
                    Önceki Boyut
                  </Text>
                  <Text
                    style={[
                      typography.titleSmall,
                      { color: theme.textSecondary, textDecorationLine: 'line-through' },
                    ]}
                  >
                    {formatFileSize(compressionResult.originalSize)}
                  </Text>
                </View>

                {/* After Size */}
                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor: theme.successContainer,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: theme.success }]}>
                    Yeni Boyut
                  </Text>
                  <Text
                    style={[
                      typography.titleLarge,
                      { color: theme.success, fontWeight: '700' },
                    ]}
                  >
                    {formatFileSize(compressionResult.compressedSize)}
                  </Text>
                </View>
              </View>

              {/* Savings Highlight Badge */}
              <View
                style={[
                  styles.savingsBadge,
                  {
                    backgroundColor: theme.primaryContainer,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.sm,
                    padding: spacing.md,
                  },
                ]}
              >
                <Ionicons name="trending-down" size={24} color={theme.onPrimaryContainer} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text
                    style={[
                      typography.titleSmall,
                      { color: theme.onPrimaryContainer, fontWeight: '700' },
                    ]}
                  >
                    {formatFileSize(compressionResult.savedBytes)} Tasarruf (%{compressionResult.savedPercentage})
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.onPrimaryContainer }]}>
                    Cihazınızda kazanılan depolama alanı
                  </Text>
                </View>
              </View>

              {/* Action Buttons: Save & Share */}
              <View style={[styles.resultActionsRow, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  onPress={handleShareOrSave}
                  style={[
                    styles.resultActionBtn,
                    {
                      backgroundColor: theme.primary,
                      borderRadius: borderRadius.md,
                      paddingVertical: spacing.md,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sıkıştırılmış dosyayı kaydet veya paylaş"
                >
                  <Ionicons name="share-social-outline" size={20} color={theme.onPrimary} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.onPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    Kaydet / Paylaş
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleReset}
                  style={[
                    styles.resultActionBtn,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      paddingVertical: spacing.md,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Yeni medya sıkıştır"
                >
                  <Ionicons name="refresh" size={18} color={theme.textPrimary} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.textPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    Yeni Dosya
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
    alignItems: 'center',
  },
  heroIconBox: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  choiceButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
  },
  mediaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mediaInfoLeft: {
    flex: 1,
    paddingRight: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sizePill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  imagePreviewBox: {
    width: '100%',
    height: 180,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  changeMediaBtn: {
    borderTopWidth: 1,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelsContainer: {
    gap: 8,
  },
  levelCard: {
    borderWidth: 1,
  },
  levelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resolutionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resChip: {
    borderWidth: 1,
  },
  compressPrimaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    borderWidth: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successIconCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultHeaderTexts: {
    marginLeft: 12,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resultActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
