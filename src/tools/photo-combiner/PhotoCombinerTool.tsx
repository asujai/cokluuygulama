import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import { CombinerOptions, PhotoItem, StitchDirection } from './types';
import { combinePhotos, shareOrDownloadCombinedImage } from './combinerService';

// Sample demonstration images SVG data URIs
const SAMPLE_PHOTOS_SET: PhotoItem[] = [
  {
    id: 's1',
    uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
        <rect width="800" height="400" fill="#38bdf8"/>
        <circle cx="680" cy="90" r="60" fill="#fef08a"/>
        <path d="M 0,260 Q 200,180 400,260 Q 600,200 800,270 L 800,400 L 0,400 Z" fill="#0284c7"/>
        <text x="50" y="80" fill="#ffffff" font-family="sans-serif" font-size="32" font-weight="bold">PANORAMA GÖRSEL #1 - DENİZ &amp; DAĞ</text>
      </svg>
    `)}`,
    width: 800,
    height: 400,
    aspectRatio: 2,
    title: 'Manzara 1',
  },
  {
    id: 's2',
    uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
        <rect width="800" height="400" fill="#059669"/>
        <rect x="0" y="240" width="800" height="160" fill="#047857"/>
        <circle cx="200" cy="180" r="70" fill="#fbbf24"/>
        <text x="50" y="80" fill="#ffffff" font-family="sans-serif" font-size="32" font-weight="bold">PANORAMA GÖRSEL #2 - ORMAN &amp; DOĞA</text>
      </svg>
    `)}`,
    width: 800,
    height: 400,
    aspectRatio: 2,
    title: 'Manzara 2',
  },
  {
    id: 's3',
    uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
        <rect width="800" height="400" fill="#7c3aed"/>
        <path d="M 100,300 L 250,120 L 400,300 L 550,150 L 700,300 Z" fill="#4c1d95"/>
        <text x="50" y="80" fill="#ffffff" font-family="sans-serif" font-size="32" font-weight="bold">PANORAMA GÖRSEL #3 - GECE VE DAĞLAR</text>
      </svg>
    `)}`,
    width: 800,
    height: 400,
    aspectRatio: 2,
    title: 'Manzara 3',
  },
];

const BG_COLOR_PALETTE = [
  { id: 'white', label: 'Beyaz', hex: '#FFFFFF' },
  { id: 'slate', label: 'Koyu Slate', hex: '#0F172A' },
  { id: 'gray', label: 'Açık Gri', hex: '#F1F5F9' },
  { id: 'charcoal', label: 'Karbon', hex: '#1E293B' },
  { id: 'transparent', label: 'Şeffaf', hex: 'transparent' },
];

export const PhotoCombinerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Photo list state
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [direction, setDirection] = useState<StitchDirection>('vertical');
  const [spacingValue, setSpacingValue] = useState<number>(12);
  const [paddingValue, setPaddingValue] = useState<number>(16);
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  const [radiusValue, setRadiusValue] = useState<number>(12);

  // Result state
  const [combinedUri, setCombinedUri] = useState<string | null>(null);
  const [combinedDimensions, setCombinedDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState<boolean>(false);

  // Pick photos from library
  const handlePickPhotos = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Galeriden görsel seçmek için izin vermelisiniz.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newItems: PhotoItem[] = result.assets.map((asset, idx) => ({
          id: `${Date.now()}_${idx}`,
          uri: asset.uri,
          width: asset.width || 800,
          height: asset.height || 600,
          aspectRatio: (asset.width || 800) / (asset.height || 600),
          title: `Görsel #${photos.length + idx + 1}`,
        }));

        setPhotos((prev) => [...prev, ...newItems]);
      }
    } catch (err) {
      console.error('Pick photos error:', err);
      Alert.alert('Hata', 'Fotoğraflar seçilirken bir hata oluştu.');
    }
  };

  // Capture single photo from camera
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera izni vermelisiniz.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newItem: PhotoItem = {
          id: Date.now().toString(),
          uri: asset.uri,
          width: asset.width || 800,
          height: asset.height || 600,
          aspectRatio: (asset.width || 800) / (asset.height || 600),
          title: `Kamera Çekimi #${photos.length + 1}`,
        };
        setPhotos((prev) => [...prev, newItem]);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Hata', 'Fotoğraf çekilirken bir hata oluştu.');
    }
  };

  // Load sample demo set
  const handleLoadDemo = () => {
    setPhotos(SAMPLE_PHOTOS_SET);
  };

  // Move photo up in list
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setPhotos((prev) => {
      const arr = [...prev];
      const temp = arr[index];
      arr[index] = arr[index - 1];
      arr[index - 1] = temp;
      return arr;
    });
  };

  // Move photo down in list
  const handleMoveDown = (index: number) => {
    if (index >= photos.length - 1) return;
    setPhotos((prev) => {
      const arr = [...prev];
      const temp = arr[index];
      arr[index] = arr[index + 1];
      arr[index + 1] = temp;
      return arr;
    });
  };

  // Delete photo from list
  const handleDeletePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Render combined photo whenever options or photo list change
  useEffect(() => {
    let isMounted = true;
    if (photos.length === 0) {
      setCombinedUri(null);
      return;
    }

    async function processStitch() {
      setIsProcessing(true);
      try {
        const options: CombinerOptions = {
          direction,
          spacing: spacingValue,
          padding: paddingValue,
          backgroundColor: bgColor,
          borderRadius: radiusValue,
          scalingMode: 'fit',
        };

        const res = await combinePhotos(photos, options);
        if (isMounted) {
          setCombinedUri(res.outputUri);
          setCombinedDimensions({ width: res.width, height: res.height });
        }
      } catch (err) {
        console.error('Stitch error:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    }

    processStitch();

    return () => {
      isMounted = false;
    };
  }, [photos, direction, spacingValue, paddingValue, bgColor, radiusValue]);

  // Export / Share combined result
  const handleShareOrDownload = async () => {
    if (!combinedUri) return;
    try {
      await shareOrDownloadCombinedImage(combinedUri, `combined_${Date.now()}.png`);
    } catch (err) {
      Alert.alert('Hata', 'Görsel kaydedilirken veya paylaşılırken hata oluştu.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primaryContainer }]}>
            <Ionicons name="images-outline" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Fotoğraf Birleştirici (Stitcher)</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Birden fazla fotoğrafı dikey veya yatay olarak boşluk, köşe ve arka plan seçenekleriyle birleştirin.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={handlePickPhotos}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.onPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>Fotoğraf Ekle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
            onPress={handleTakePhoto}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={18} color={theme.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Çek</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
            onPress={handleLoadDemo}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Örnek Set</Text>
          </TouchableOpacity>
        </View>
      </View>

      {photos.length === 0 ? (
        <View style={[styles.placeholderCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Ionicons name="images-outline" size={56} color={theme.textMuted} />
          <Text style={[styles.placeholderTitle, { color: theme.textPrimary }]}>Fotoğraf Eklenmedi</Text>
          <Text style={[styles.placeholderDesc, { color: theme.textSecondary }]}>
            Birleştirmek için galeriden 2 veya daha fazla fotoğraf seçin.
          </Text>
        </View>
      ) : (
        <>
          {/* Photo List & Order Manager */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Seçilen Fotoğraflar ({photos.length} Adet)
              </Text>
              <TouchableOpacity onPress={() => setPhotos([])}>
                <Text style={{ color: theme.error, fontSize: 13, fontWeight: '600' }}>Tümünü Temizle</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.photoList}>
              {photos.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.photoListItem, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumbImg} resizeMode="cover" />
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={[styles.photoItemTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {item.title || `Fotoğraf #${index + 1}`}
                    </Text>
                    <Text style={[styles.photoItemSub, { color: theme.textMuted }]}>
                      {item.width} x {item.height} px
                    </Text>
                  </View>

                  <View style={styles.reorderBtns}>
                    <TouchableOpacity
                      disabled={index === 0}
                      onPress={() => handleMoveUp(index)}
                      style={[styles.miniBtn, index === 0 && { opacity: 0.3 }]}
                    >
                      <Ionicons name="chevron-up" size={18} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={index === photos.length - 1}
                      onPress={() => handleMoveDown(index)}
                      style={[styles.miniBtn, index === photos.length - 1 && { opacity: 0.3 }]}
                    >
                      <Ionicons name="chevron-down" size={18} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleDeletePhoto(item.id)} style={styles.miniBtn}>
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Stitch Options & Controls */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Birleştirme &amp; Düzen Ayarları</Text>

            {/* Direction Selector */}
            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>Hizalama Yönü:</Text>
              <View style={styles.directionToggle}>
                <TouchableOpacity
                  style={[
                    styles.directionBtn,
                    direction === 'vertical' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setDirection('vertical')}
                >
                  <Ionicons
                    name="resize-outline"
                    size={16}
                    color={direction === 'vertical' ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.directionBtnText,
                      { color: direction === 'vertical' ? theme.onPrimary : theme.textSecondary },
                    ]}
                  >
                    Dikey (Üst Üste)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.directionBtn,
                    direction === 'horizontal' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setDirection('horizontal')}
                >
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={16}
                    color={direction === 'horizontal' ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.directionBtnText,
                      { color: direction === 'horizontal' ? theme.onPrimary : theme.textSecondary },
                    ]}
                  >
                    Yatay (Yan Yana)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Spacing Between Images */}
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
                Fotoğraflar Arası Boşluk: {spacingValue} px
              </Text>
              <View style={styles.stepGroup}>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setSpacingValue((s) => Math.max(0, s - 4))}
                >
                  <Ionicons name="remove" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setSpacingValue((s) => Math.min(40, s + 4))}
                >
                  <Ionicons name="add" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Outer Padding */}
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
                Dış Çerçeve Kenar Boşluğu: {paddingValue} px
              </Text>
              <View style={styles.stepGroup}>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setPaddingValue((p) => Math.max(0, p - 4))}
                >
                  <Ionicons name="remove" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setPaddingValue((p) => Math.min(40, p + 4))}
                >
                  <Ionicons name="add" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Corner Radius */}
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
                Fotoğraf Köşe Yuvarlama: {radiusValue} px
              </Text>
              <View style={styles.stepGroup}>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setRadiusValue((r) => Math.max(0, r - 4))}
                >
                  <Ionicons name="remove" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setRadiusValue((r) => Math.min(30, r + 4))}
                >
                  <Ionicons name="add" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Background Color Picker */}
            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>Arka Plan Rengi:</Text>
              <View style={styles.colorPaletteRow}>
                {BG_COLOR_PALETTE.map((c) => {
                  const isSelected = bgColor === c.hex;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.colorChip,
                        {
                          backgroundColor: c.hex === 'transparent' ? theme.surfaceVariant : c.hex,
                          borderColor: isSelected ? theme.primary : theme.cardBorder,
                          borderWidth: isSelected ? 3 : 1,
                        },
                      ]}
                      onPress={() => setBgColor(c.hex)}
                    >
                      {c.hex === 'transparent' && (
                        <Ionicons name="ban-outline" size={16} color={theme.textMuted} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Live Preview Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Birleştirilmiş Önizleme</Text>

            {isProcessing ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Fotoğraflar dikiliyor &amp; birleştiriliyor...
                </Text>
              </View>
            ) : combinedUri ? (
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: combinedUri }}
                  style={[
                    styles.previewImage,
                    {
                      aspectRatio:
                        combinedDimensions.width > 0 && combinedDimensions.height > 0
                          ? combinedDimensions.width / combinedDimensions.height
                          : 1,
                    },
                  ]}
                  resizeMode="contain"
                />

                <Text style={[styles.dimTag, { color: theme.textMuted }]}>
                  Sonuç Boyutu: {combinedDimensions.width} x {combinedDimensions.height} px
                </Text>

                <TouchableOpacity
                  style={[styles.exportBtn, { backgroundColor: theme.primary }]}
                  onPress={handleShareOrDownload}
                >
                  <Ionicons name="share-outline" size={20} color={theme.onPrimary} style={{ marginRight: 8 }} />
                  <Text style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 15 }}>
                    Uzun Görseli Kaydet / Paylaş
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 10,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  placeholderDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  photoList: {
    gap: 8,
  },
  photoListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  thumbImg: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  photoItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  reorderBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  miniBtn: {
    padding: 6,
  },
  controlRow: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  directionToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  directionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    gap: 6,
  },
  directionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 13,
  },
  stepGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  previewBox: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    maxHeight: 400,
    borderRadius: 12,
    marginBottom: 10,
  },
  dimTag: {
    fontSize: 12,
    marginBottom: 14,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
});
