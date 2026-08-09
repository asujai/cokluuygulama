import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import { CleanedPhotoResult, ExifMetadata } from './types';
import {
  parseExifFromJpegBytes,
  shareOrDownloadCleanedPhoto,
  stripPhotoMetadata,
} from './exifReader';

export const ExifCleanerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [selectedPhoto, setSelectedPhoto] = useState<{
    uri: string;
    name: string;
    size?: number;
    width?: number;
    height?: number;
  } | null>(null);

  const [metadata, setMetadata] = useState<ExifMetadata | null>(null);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanResult, setCleanResult] = useState<CleanedPhotoResult | null>(null);

  // Pick Photo
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
        setSelectedPhoto({
          uri: asset.uri,
          name: asset.fileName || `foto_${Date.now()}.jpg`,
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
        });
        setCleanResult(null);

        // Read EXIF bytes
        setIsReading(true);
        try {
          const response = await fetch(asset.uri);
          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const parsed = parseExifFromJpegBytes(bytes);
          setMetadata(parsed);
        } catch (readErr) {
          console.warn('Error reading EXIF:', readErr);
          setMetadata({ hasSensitiveData: false, totalTagsCount: 0 });
        } finally {
          setIsReading(false);
        }
      }
    } catch (err) {
      console.warn('Pick photo error:', err);
    }
  };

  // Strip EXIF
  const handleCleanPhoto = async () => {
    if (!selectedPhoto) return;
    setIsCleaning(true);
    try {
      const result = await stripPhotoMetadata(selectedPhoto.uri, selectedPhoto.name, 0.95);
      setCleanResult(result);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Fotoğraf temizlenemedi.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleOpenMap = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Hata', 'Harita bağlantısı açılamadı.');
    });
  };

  const handleReset = () => {
    setSelectedPhoto(null);
    setMetadata(null);
    setCleanResult(null);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {!selectedPhoto ? (
        /* Empty / Pick Photo Hero View */
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
            <Ionicons name="shield-checkmark" size={48} color={theme.onPrimaryContainer} />
          </View>

          <Text
            style={[
              typography.titleMedium,
              { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            Fotoğraf Gizlilik & EXIF Temizleyici
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
            Fotoğraflarınızdaki GPS konum koordinatlarını, kamera modelini, çekim tarihini ve hassas meta verileri görüntüleyin ve tek dokunuşla temizleyin.
          </Text>

          <TouchableOpacity
            onPress={handlePickPhoto}
            style={[
              styles.pickButton,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.md,
                marginTop: spacing.xl,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
              },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="image" size={22} color={theme.onPrimary} />
            <Text
              style={[
                typography.labelLarge,
                { color: theme.onPrimary, marginLeft: spacing.xs },
              ]}
            >
              İncelenecek Fotoğrafı Seç
            </Text>
          </TouchableOpacity>

          {/* Feature Highlight Pills */}
          <View style={[styles.featuresRow, { marginTop: spacing.xl }]}>
            <View style={styles.featureItem}>
              <Ionicons name="location-outline" size={16} color={theme.accent} />
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginLeft: 4 }]}>
                GPS Konum Silme
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="camera-outline" size={16} color={theme.accent} />
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginLeft: 4 }]}>
                Kamera / Lens Bilgisi
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="lock-closed-outline" size={16} color={theme.accent} />
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginLeft: 4 }]}>
                %100 Cihaz İçi Güvenlik
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* Selected Photo & Metadata Breakdown */
        <View>
          {/* Photo Summary Card */}
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
            <View style={styles.photoHeaderRow}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.photoThumb} resizeMode="cover" />

              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                  {selectedPhoto.name}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
                  {selectedPhoto.width && selectedPhoto.height
                    ? `${selectedPhoto.width} × ${selectedPhoto.height} px`
                    : ''}
                </Text>

                {/* Privacy Badge */}
                {isReading ? (
                  <ActivityIndicator size="small" color={theme.primary} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                ) : metadata?.gps ? (
                  <View
                    style={[
                      styles.privacyBadge,
                      { backgroundColor: theme.errorContainer, borderRadius: borderRadius.xs, marginTop: 4 },
                    ]}
                  >
                    <Ionicons name="alert-circle" size={14} color={theme.onErrorContainer} />
                    <Text style={[typography.labelSmall, { color: theme.onErrorContainer, marginLeft: 4 }]}>
                      Yüksek Risk: GPS Konumu Açık
                    </Text>
                  </View>
                ) : metadata?.hasSensitiveData ? (
                  <View
                    style={[
                      styles.privacyBadge,
                      { backgroundColor: theme.warningContainer, borderRadius: borderRadius.xs, marginTop: 4 },
                    ]}
                  >
                    <Ionicons name="warning-outline" size={14} color={theme.onWarning} />
                    <Text style={[typography.labelSmall, { color: theme.onWarning, marginLeft: 4 }]}>
                      EXIF Bilgileri Tespit Edildi
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.privacyBadge,
                      { backgroundColor: theme.successContainer, borderRadius: borderRadius.xs, marginTop: 4 },
                    ]}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color={theme.success} />
                    <Text style={[typography.labelSmall, { color: theme.success, marginLeft: 4 }]}>
                      Temiz: Hassas Veri Yok
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={handleReset} style={{ padding: 4 }}>
                <Ionicons name="swap-horizontal" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* GPS Location Highlight Card */}
          {metadata?.gps && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.error,
                  borderRadius: borderRadius.lg,
                  marginTop: spacing.sm,
                  padding: spacing.md,
                },
              ]}
            >
              <View style={styles.gpsHeader}>
                <Ionicons name="location" size={24} color={theme.error} />
                <View style={{ marginLeft: spacing.xs, flex: 1 }}>
                  <Text style={[typography.titleSmall, { color: theme.error }]}>
                    Fotoğrafta GPS Konumu Bulundu!
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                    Fotoğraf paylaşıldığında çekildiği yer açıkça görünür.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.gpsCoordsBox,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.sm,
                    padding: spacing.sm,
                  },
                ]}
              >
                <Text style={[typography.mono, typography.bodySmall, { color: theme.textPrimary }]}>
                  Enlem: {metadata.gps.latitude}° {metadata.gps.latitudeRef} | Boylam: {metadata.gps.longitude}° {metadata.gps.longitudeRef}
                  {metadata.gps.altitude ? ` | Rakım: ${metadata.gps.altitude} m` : ''}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleOpenMap(metadata.gps!.mapUrl)}
                style={[
                  styles.mapBtn,
                  {
                    backgroundColor: theme.primaryContainer,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.sm,
                    paddingVertical: spacing.sm,
                  },
                ]}
              >
                <Ionicons name="map-outline" size={16} color={theme.onPrimaryContainer} />
                <Text style={[typography.labelMedium, { color: theme.onPrimaryContainer, marginLeft: spacing.xs }]}>
                  Google Haritalar'da Göster
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Metadata Breakdown List Card */}
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
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.xs }]}>
              Fotoğraf Meta Veri Detayları
            </Text>

            {/* Device & Camera */}
            <View style={[styles.metaSection, { borderBottomColor: theme.divider }]}>
              <Text style={[typography.labelMedium, { color: theme.primary }]}>Kamera & Donanım</Text>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Marka / Üretici:</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.make || 'Belirtilmemiş'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Model:</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.model || 'Belirtilmemiş'}
                </Text>
              </View>
              {metadata?.lensModel && (
                <View style={styles.metaRow}>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Lens:</Text>
                  <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                    {metadata.lensModel}
                  </Text>
                </View>
              )}
            </View>

            {/* Capture Settings */}
            <View style={[styles.metaSection, { borderBottomColor: theme.divider }]}>
              <Text style={[typography.labelMedium, { color: theme.primary }]}>Çekim Parametreleri</Text>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Diyafram (F-Stop):</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.fNumber || '-'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Enstantane (Pozlama):</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.exposureTime || '-'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>ISO Değeri:</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.isoSpeedRatings ? `ISO ${metadata.isoSpeedRatings}` : '-'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Odak Uzaklığı:</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.focalLength || '-'} {metadata?.focalLength35mm ? `(${metadata.focalLength35mm} eşdeğer)` : ''}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Flaş:</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.flash || 'Bilinmiyor'}
                </Text>
              </View>
            </View>

            {/* Date & Time */}
            <View style={[styles.metaSection, { borderBottomColor: 'transparent' }]}>
              <Text style={[typography.labelMedium, { color: theme.primary }]}>Tarih & Zaman</Text>
              <View style={styles.metaRow}>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Orijinal Çekim Tarihi:</Text>
                <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                  {metadata?.dateTimeOriginal || 'Bulunmuyor'}
                </Text>
              </View>
              {metadata?.software && (
                <View style={styles.metaRow}>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>Yazılım / OS:</Text>
                  <Text style={[typography.bodySmall, { color: theme.textPrimary, fontWeight: '600' }]}>
                    {metadata.software}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Strip Metadata Trigger Button */}
          <TouchableOpacity
            onPress={handleCleanPhoto}
            disabled={isCleaning}
            style={[
              styles.cleanPrimaryBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.md,
                marginTop: spacing.md,
                paddingVertical: spacing.md,
              },
            ]}
            accessibilityRole="button"
          >
            {isCleaning ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Tüm EXIF & Konum Bilgilerini Temizle
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cleaned Result Card */}
          {cleanResult && (
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
              <View style={styles.resultHeader}>
                <Ionicons name="shield-checkmark" size={32} color={theme.success} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                    Fotoğraf Tamamen Temizlendi!
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                    GPS koordinatları, kamera seri numaraları ve çekim tarihi sıfırlandı.
                  </Text>
                </View>
              </View>

              <View style={[styles.resultButtonsRow, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  onPress={() => shareOrDownloadCleanedPhoto(cleanResult.cleanedUri, cleanResult.fileName)}
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
                  <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                    Temiz Fotoğrafı İndir / Paylaş
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleReset}
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
                  <Text style={[typography.labelLarge, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                    Yeni Fotoğraf
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
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsCoordsBox: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaSection: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cleanPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    borderWidth: 1.5,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
