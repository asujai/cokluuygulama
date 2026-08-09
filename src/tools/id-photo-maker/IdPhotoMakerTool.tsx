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
import { BgColorOption, PhotoPreset, PrintSheetOptions } from './types';
import {
  BG_COLOR_OPTIONS,
  PHOTO_PRESETS,
  createPrintSheetImage,
  exportPrintSheetPdf,
  processIdPhoto,
  shareOrDownloadFile,
} from './idPhotoService';

// Sample demonstration portrait SVG data URI for instant testing
const DEMO_PORTRAIT_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750">
    <rect width="600" height="750" fill="#e2e8f0"/>
    
    <!-- Studio Light Backing -->
    <radialGradient id="studio" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </radialGradient>
    <rect width="600" height="750" fill="url(#studio)"/>

    <!-- Suit / Jacket -->
    <path d="M 120,750 Q 150,520 300,500 Q 450,520 480,750 Z" fill="#1e293b"/>
    <path d="M 240,750 L 300,530 L 360,750 Z" fill="#ffffff"/>
    <path d="M 285,550 L 315,550 L 310,750 L 290,750 Z" fill="#dc2626"/>

    <!-- Neck & Face -->
    <path d="M 260,530 C 260,460 340,460 340,530 Z" fill="#fdba74"/>
    <ellipse cx="300" cy="350" rx="130" ry="170" fill="#fed7aa"/>
    
    <!-- Hair -->
    <path d="M 170,330 C 160,200 440,200 430,330 C 400,220 200,220 170,330 Z" fill="#0f172a"/>

    <!-- Eyes & Features -->
    <ellipse cx="245" cy="340" rx="14" ry="9" fill="#0f172a"/>
    <ellipse cx="355" cy="340" rx="14" ry="9" fill="#0f172a"/>
    <circle cx="248" cy="338" r="4" fill="#ffffff"/>
    <circle cx="358" cy="338" r="4" fill="#ffffff"/>
    
    <path d="M 295,335 L 290,380 L 310,380 Z" fill="#f97316" opacity="0.6"/>
    <path d="M 250,430 Q 300,460 350,430" stroke="#b91c1c" stroke-width="4" fill="none"/>
  </svg>
`)}`;

export const IdPhotoMakerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Photo state
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [processedPhotoUri, setProcessedPhotoUri] = useState<string | null>(null);
  const [printSheetUri, setPrintSheetUri] = useState<string | null>(null);

  // Settings state
  const [selectedPreset, setSelectedPreset] = useState<PhotoPreset>(PHOTO_PRESETS[0]);
  const [selectedBgColor, setSelectedBgColor] = useState<BgColorOption>(BG_COLOR_OPTIONS[0]);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [headYOffset, setHeadYOffset] = useState<number>(0);
  const [photosPerPage, setPhotosPerPage] = useState<4 | 6 | 8>(6);

  // Status & Modal state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'single' | 'sheet'>('single');
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState<boolean>(false);

  // Pick from Gallery
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Galeriden görsel seçmek için medya kitaplığı izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setOriginalImageUri(uri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  };

  // Capture Camera
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setOriginalImageUri(uri);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Hata', 'Fotoğraf çekilemedi.');
    }
  };

  // Load Demo Photo
  const handleLoadDemo = () => {
    setOriginalImageUri(DEMO_PORTRAIT_URI);
  };

  // Re-process photo whenever image or options change
  useEffect(() => {
    let isMounted = true;
    if (!originalImageUri) return;

    async function renderPhoto() {
      setIsProcessing(true);
      try {
        const singleUri = await processIdPhoto(
          originalImageUri!,
          selectedPreset,
          selectedBgColor.color,
          zoomLevel,
          headYOffset
        );

        if (isMounted) {
          setProcessedPhotoUri(singleUri);

          // Generate 4x6 print sheet automatically
          const sheetOptions: PrintSheetOptions = {
            paperSize: '4x6_inch',
            photosPerPage,
            showCropMarks: true,
            backgroundColor: '#FFFFFF',
          };
          const sheetUri = await createPrintSheetImage(singleUri, selectedPreset, sheetOptions);
          setPrintSheetUri(sheetUri);
        }
      } catch (err) {
        console.error('Render photo error:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    }

    renderPhoto();

    return () => {
      isMounted = false;
    };
  }, [originalImageUri, selectedPreset, selectedBgColor, zoomLevel, headYOffset, photosPerPage]);

  const handleShareSingle = async () => {
    if (!processedPhotoUri) return;
    try {
      await shareOrDownloadFile(
        processedPhotoUri,
        `vesikalik_${selectedPreset.id}_${Date.now()}.png`,
        'image/png'
      );
    } catch (err) {
      Alert.alert('Hata', 'Görsel aktarılamadı.');
    }
  };

  const handleShareSheetPng = async () => {
    if (!printSheetUri) return;
    try {
      await shareOrDownloadFile(
        printSheetUri,
        `baski_sablonu_${Date.now()}.png`,
        'image/png'
      );
    } catch (err) {
      Alert.alert('Hata', 'Baskı şablonu aktarılamadı.');
    }
  };

  const handleExportPdf = async () => {
    if (!printSheetUri) return;
    setIsProcessing(true);
    try {
      const pdfPath = await exportPrintSheetPdf(printSheetUri, selectedPreset);
      await shareOrDownloadFile(
        pdfPath,
        `baski_sablonu_${Date.now()}.pdf`,
        'application/pdf'
      );
    } catch (err) {
      Alert.alert('Hata', 'PDF dosyası oluşturulamadı.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primaryContainer }]}>
            <Ionicons name="person-outline" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Vesikalık &amp; Biyometrik Fotoğraf</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Pasaport, kimlik ve vize için standart vesikalık hazırlayın, arka planı temizleyin ve baskı şablonu oluşturun.
            </Text>
          </View>
        </View>

        {/* Action Pickers */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={handlePickImage}
            activeOpacity={0.8}
          >
            <Ionicons name="images-outline" size={18} color={theme.onPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>Galeri</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
            onPress={handleTakePhoto}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={18} color={theme.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Kamera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
            onPress={handleLoadDemo}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Örnek Yükle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!originalImageUri ? (
        <View style={[styles.placeholderCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Ionicons name="camera-reverse-outline" size={56} color={theme.textMuted} />
          <Text style={[styles.placeholderTitle, { color: theme.textPrimary }]}>Fotoğraf Seçilmedi</Text>
          <Text style={[styles.placeholderDesc, { color: theme.textSecondary }]}>
            Biyometrik veya vesikalık dönüştürmek istediğiniz portre fotoğrafını seçin.
          </Text>
        </View>
      ) : (
        <>
          {/* Preset Standard Selector */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>1. Fotoğraf Standardı &amp; Boyut</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {PHOTO_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedPreset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedPreset(preset)}
                  >
                    <Text
                      style={[
                        styles.presetChipTitle,
                        { color: isSelected ? theme.onPrimaryContainer : theme.textPrimary },
                      ]}
                    >
                      {preset.name}
                    </Text>
                    <Text style={[styles.presetChipDesc, { color: theme.textSecondary }]}>
                      {preset.widthMm} x {preset.heightMm} mm
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Background Color Selector */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>2. Arka Plan Rengi</Text>
            <View style={styles.colorRow}>
              {BG_COLOR_OPTIONS.map((opt) => {
                const isSelected = opt.id === selectedBgColor.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.colorBadge,
                      {
                        backgroundColor: opt.color === 'transparent' ? theme.surfaceVariant : opt.color,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderWidth: isSelected ? 3 : 1,
                      },
                    ]}
                    onPress={() => setSelectedBgColor(opt)}
                  >
                    {opt.color === 'transparent' && (
                      <Ionicons name="ban-outline" size={16} color={theme.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.colorSelectedLabel, { color: theme.textSecondary }]}>
              Seçilen: <Text style={{ fontWeight: 'bold', color: theme.textPrimary }}>{selectedBgColor.label}</Text>
            </Text>
          </View>

          {/* Fine Tuning Controls */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>3. Yüz Hizalama &amp; Zoom</Text>

            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
                Yakınlaştırma (Zoom): {(zoomLevel * 100).toFixed(0)}%
              </Text>
              <View style={styles.stepGroup}>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setZoomLevel((z) => Math.max(0.8, +(z - 0.1).toFixed(1)))}
                >
                  <Ionicons name="remove" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setZoomLevel((z) => Math.min(2.0, +(z + 0.1).toFixed(1)))}
                >
                  <Ionicons name="add" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
                Kafa Yüksekliği Hizası: {headYOffset}
              </Text>
              <View style={styles.stepGroup}>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setHeadYOffset((y) => Math.max(-20, y - 5))}
                >
                  <Ionicons name="chevron-up" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setHeadYOffset((y) => Math.min(20, y + 5))}
                >
                  <Ionicons name="chevron-down" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Preview Tabs (Single vs Print Sheet) */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.tabHeader}>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'single' && { backgroundColor: theme.primary },
                ]}
                onPress={() => setActiveTab('single')}
              >
                <Text style={{ color: activeTab === 'single' ? theme.onPrimary : theme.textSecondary, fontWeight: '600' }}>
                  Tekli Vesikalık
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'sheet' && { backgroundColor: theme.primary },
                ]}
                onPress={() => setActiveTab('sheet')}
              >
                <Text style={{ color: activeTab === 'sheet' ? theme.onPrimary : theme.textSecondary, fontWeight: '600' }}>
                  10x15 Baskı Şablonu
                </Text>
              </TouchableOpacity>
            </View>

            {isProcessing ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Biyometrik fotoğraf işleniyor...
                </Text>
              </View>
            ) : activeTab === 'single' ? (
              <View style={styles.previewBox}>
                {processedPhotoUri && (
                  <Image
                    source={{ uri: processedPhotoUri }}
                    style={[
                      styles.singlePhotoImg,
                      { aspectRatio: selectedPreset.aspectRatio },
                    ]}
                    resizeMode="contain"
                  />
                )}
                <Text style={[styles.photoInfoTag, { color: theme.textMuted }]}>
                  {selectedPreset.name} ({selectedPreset.widthMm}x{selectedPreset.heightMm}mm)
                </Text>

                <TouchableOpacity
                  style={[styles.exportBtn, { backgroundColor: theme.primary }]}
                  onPress={handleShareSingle}
                >
                  <Ionicons name="download-outline" size={18} color={theme.onPrimary} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Tekli Fotoğrafı Kaydet / Paylaş</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.previewBox}>
                {/* Print Sheet Options */}
                <View style={styles.countSelectRow}>
                  <Text style={[styles.countLabel, { color: theme.textSecondary }]}>Sayfa İçi Adet:</Text>
                  <View style={styles.countBtns}>
                    {[4, 6, 8].map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.countBtn,
                          photosPerPage === num && { backgroundColor: theme.primary },
                        ]}
                        onPress={() => setPhotosPerPage(num as 4 | 6 | 8)}
                      >
                        <Text
                          style={{
                            color: photosPerPage === num ? theme.onPrimary : theme.textPrimary,
                            fontWeight: 'bold',
                            fontSize: 12,
                          }}
                        >
                          {num} Adet
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {printSheetUri && (
                  <Image source={{ uri: printSheetUri }} style={styles.sheetPhotoImg} resizeMode="contain" />
                )}

                <View style={styles.sheetExportGroup}>
                  <TouchableOpacity
                    style={[styles.exportBtn, { backgroundColor: theme.primary, flex: 1 }]}
                    onPress={handleShareSheetPng}
                  >
                    <Ionicons name="image-outline" size={18} color={theme.onPrimary} style={{ marginRight: 6 }} />
                    <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Baskı PNG</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.exportBtn, { backgroundColor: theme.accent, flex: 1 }]}
                    onPress={handleExportPdf}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#ffffff', fontWeight: '700' }}>Baskı PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  presetChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
  },
  presetChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  presetChipDesc: {
    fontSize: 11,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  colorBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelectedLabel: {
    fontSize: 12,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  tabHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
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
  singlePhotoImg: {
    width: 180,
    maxHeight: 250,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  sheetPhotoImg: {
    width: '100%',
    height: 260,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
  },
  photoInfoTag: {
    fontSize: 11,
    marginBottom: 14,
  },
  countSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  countLabel: {
    fontSize: 13,
  },
  countBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  countBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
  },
  sheetExportGroup: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
});
