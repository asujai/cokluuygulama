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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import { BackgroundFillMode, BackgroundRemoverOptions, SegmentationResult } from './types';
import { removeBackground, shareOrDownloadImage } from './backgroundRemoverService';

export const BackgroundRemoverTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Image State
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<SegmentationResult | null>(null);
  const [viewMode, setViewMode] = useState<'result' | 'original'>('result');

  // Segmentation Parameters
  const [fillMode, setFillMode] = useState<BackgroundFillMode>('transparent');
  const [solidColor, setSolidColor] = useState<string>('#FFFFFF');
  const [tolerance, setTolerance] = useState<number>(35);
  const [feather, setFeather] = useState<number>(2);
  const [keyColorPreset, setKeyColorPreset] = useState<'auto' | 'green' | 'white' | 'black' | 'custom'>('auto');
  const [customKeyColor, setCustomKeyColor] = useState<string>('#00FF00');
  const [preserveSkin, setPreserveSkin] = useState<boolean>(true);

  // Pick Image from Gallery
  const handlePickImage = async () => {
    try {
      const pickRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!pickRes.canceled && pickRes.assets && pickRes.assets.length > 0) {
        const uri = pickRes.assets[0].uri;
        setSelectedImageUri(uri);
        setResult(null);
        // Process automatically on selection
        runSegmentation(uri, fillMode, solidColor, tolerance, feather, keyColorPreset, customKeyColor, preserveSkin);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Görsel seçilemedi.');
    }
  };

  // Run Segmentation Algorithm
  const runSegmentation = async (
    imgUri: string | null,
    mode: BackgroundFillMode,
    bgColor: string,
    tol: number,
    fth: number,
    keyPreset: string,
    customKey: string,
    skin: boolean
  ) => {
    const uriToProcess = imgUri || selectedImageUri;
    if (!uriToProcess) return;

    try {
      setIsProcessing(true);

      let sampleKeyColor: string | undefined = undefined;
      if (keyPreset === 'green') sampleKeyColor = '#00FF00';
      else if (keyPreset === 'white') sampleKeyColor = '#FFFFFF';
      else if (keyPreset === 'black') sampleKeyColor = '#000000';
      else if (keyPreset === 'custom') sampleKeyColor = customKey;

      const opts: BackgroundRemoverOptions = {
        fillMode: mode,
        solidColor: bgColor,
        tolerance: tol,
        feather: fth,
        sampleKeyColor,
        preserveSubjectSkin: skin,
      };

      const res = await removeBackground(uriToProcess, opts);
      setResult(res);
      setViewMode('result');
    } catch (err: any) {
      Alert.alert('İşlem Hatası', err?.message || 'Arka plan ayrıştırma sırasında hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-run with updated controls
  const handleApplyChanges = () => {
    runSegmentation(selectedImageUri, fillMode, solidColor, tolerance, feather, keyColorPreset, customKeyColor, preserveSkin);
  };

  // Share / Export Result
  const handleShare = async () => {
    if (!result) return;
    try {
      await shareOrDownloadImage(
        result.outputUri,
        fillMode === 'transparent' ? 'arka_plan_silinmis.png' : 'arka_plan_degistirilmis.png'
      );
    } catch (err: any) {
      Alert.alert('Paylaşım Hatası', err?.message || 'Görsel indirilemedi.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Ionicons name="color-wand-outline" size={32} color={theme.primary} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Arka Plan Silici</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Yerel ve hızlı renk/kenar ayrıştırma ile nesneleri arka plandan ayırın veya değiştirin.
          </Text>
        </View>
      </View>

      {/* Image Upload Box */}
      {!selectedImageUri ? (
        <View style={[styles.uploadBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Ionicons name="image-outline" size={56} color={theme.textMuted} />
          <Text style={[styles.uploadTitle, { color: theme.textPrimary }]}>Fotoğraf Seçin</Text>
          <Text style={[styles.uploadSub, { color: theme.textSecondary }]}>
            Arka planını temizlemek veya değiştirmek istediğiniz görseli galerinizden yükleyin.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handlePickImage}
          >
            <Ionicons name="images-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {/* Top Bar with Change & View Toggle */}
          <View style={[styles.topBar, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <TouchableOpacity style={[styles.smallChangeBtn, { borderColor: theme.cardBorder }]} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={16} color={theme.primary} />
              <Text style={[styles.smallChangeBtnText, { color: theme.primary }]}>Fotoğrafı Değiştir</Text>
            </TouchableOpacity>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  viewMode === 'result' && { backgroundColor: theme.primary },
                ]}
                onPress={() => setViewMode('result')}
              >
                <Text style={[styles.toggleBtnText, { color: viewMode === 'result' ? '#FFFFFF' : theme.textPrimary }]}>
                  İşlenmiş
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  viewMode === 'original' && { backgroundColor: theme.primary },
                ]}
                onPress={() => setViewMode('original')}
              >
                <Text style={[styles.toggleBtnText, { color: viewMode === 'original' ? '#FFFFFF' : theme.textPrimary }]}>
                  Orijinal
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Image Display Box */}
          <View style={[styles.previewContainer, { backgroundColor: fillMode === 'transparent' ? '#E2E8F0' : solidColor }]}>
            {isProcessing ? (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.processingText, { color: theme.textPrimary }]}>
                  Arka Plan Ayrıştırılıyor...
                </Text>
              </View>
            ) : viewMode === 'result' && result ? (
              <Image source={{ uri: result.outputUri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <Image source={{ uri: selectedImageUri }} style={styles.previewImage} resizeMode="contain" />
            )}
          </View>

          {result && (
            <View style={styles.infoMetaRow}>
              <Text style={[styles.infoMetaText, { color: theme.textSecondary }]}>
                Ayrıştırılan Alan: %{result.removedPixelsPercentage} • Çözünürlük: {result.width}x{result.height}px
              </Text>
            </View>
          )}

          {/* Control Options Panel */}
          <View style={[styles.controlsCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Arka Plan Modu & Renk</Text>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeChip,
                  { borderColor: theme.cardBorder },
                  fillMode === 'transparent' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => {
                  setFillMode('transparent');
                  runSegmentation(selectedImageUri, 'transparent', solidColor, tolerance, feather, keyColorPreset, customKeyColor, preserveSkin);
                }}
              >
                <Ionicons name="image-outline" size={18} color={fillMode === 'transparent' ? theme.primary : theme.textSecondary} />
                <Text style={[styles.modeChipText, { color: fillMode === 'transparent' ? theme.primary : theme.textPrimary }]}>
                  Şeffaf PNG
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeChip,
                  { borderColor: theme.cardBorder },
                  fillMode === 'white' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => {
                  setFillMode('white');
                  runSegmentation(selectedImageUri, 'white', '#FFFFFF', tolerance, feather, keyColorPreset, customKeyColor, preserveSkin);
                }}
              >
                <View style={[styles.colorDot, { backgroundColor: '#FFFFFF', borderWidth: 1 }]} />
                <Text style={[styles.modeChipText, { color: fillMode === 'white' ? theme.primary : theme.textPrimary }]}>
                  Beyaz
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeChip,
                  { borderColor: theme.cardBorder },
                  fillMode === 'solid' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => {
                  setFillMode('solid');
                  runSegmentation(selectedImageUri, 'solid', solidColor, tolerance, feather, keyColorPreset, customKeyColor, preserveSkin);
                }}
              >
                <View style={[styles.colorDot, { backgroundColor: solidColor }]} />
                <Text style={[styles.modeChipText, { color: fillMode === 'solid' ? theme.primary : theme.textPrimary }]}>
                  Özel Renk
                </Text>
              </TouchableOpacity>
            </View>

            {fillMode === 'solid' && (
              <View style={styles.colorPaletteRow}>
                {['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#000000'].map((colorHex) => (
                  <TouchableOpacity
                    key={colorHex}
                    style={[
                      styles.paletteDot,
                      { backgroundColor: colorHex },
                      solidColor === colorHex && { borderWidth: 3, borderColor: theme.primary },
                    ]}
                    onPress={() => {
                      setSolidColor(colorHex);
                      runSegmentation(selectedImageUri, 'solid', colorHex, tolerance, feather, keyColorPreset, customKeyColor, preserveSkin);
                    }}
                  />
                ))}
              </View>
            )}

            <Text style={[styles.cardTitle, { color: theme.textPrimary, marginTop: spacing.md }]}>
              Hassasiyet & Kenar Yumuşatma
            </Text>

            {/* Tolerance Control */}
            <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
              Renk Hassasiyeti (Tolerans): %{tolerance}
            </Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => setTolerance((t) => Math.max(5, t - 5))}
              >
                <Ionicons name="remove" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.stepInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                keyboardType="numeric"
                value={String(tolerance)}
                onChangeText={(val) => setTolerance(Math.max(5, Math.min(95, Number(val) || 35)))}
              />
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => setTolerance((t) => Math.min(95, t + 5))}
              >
                <Ionicons name="add" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Feather Radius Control */}
            <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
              Kenar Yumuşatma (Feather): {feather}px
            </Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => setFeather((f) => Math.max(0, f - 1))}
              >
                <Ionicons name="remove" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.stepInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                keyboardType="numeric"
                value={String(feather)}
                onChangeText={(val) => setFeather(Math.max(0, Math.min(10, Number(val) || 0)))}
              />
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => setFeather((f) => Math.min(10, f + 1))}
              >
                <Ionicons name="add" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Skin Preservation Toggle */}
            <TouchableOpacity
              style={styles.toggleCheckRow}
              onPress={() => setPreserveSkin(!preserveSkin)}
            >
              <Ionicons
                name={preserveSkin ? 'checkbox' : 'square-outline'}
                size={22}
                color={theme.primary}
              />
              <Text style={[styles.toggleCheckText, { color: theme.textPrimary }]}>
                İnsan / Ten Tonlarını Koru (Yüz & Cilt Ayrıştırma Koruması)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: spacing.md }]}
              onPress={handleApplyChanges}
            >
              <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Ayrıştırmayı Yeniden Uygula</Text>
            </TouchableOpacity>
          </View>

          {/* Export / Share Button */}
          {result && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.success, marginBottom: 32 }]}
              onPress={handleShare}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Görseli İndir / Paylaş</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  uploadBox: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  uploadSub: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  smallChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallChangeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewContainer: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  processingOverlay: {
    alignItems: 'center',
  },
  processingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  infoMetaRow: {
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  infoMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  controlsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 6,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  toggleCheckText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
});
