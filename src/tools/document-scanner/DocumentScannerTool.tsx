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
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../core/theme';
import { ScannedPage, FilterType, OcrProgress } from './types';
import { FILTER_OPTIONS, applyImageFilter } from './imageFilters';
import { recognizeTextFromImage } from './ocrService';
import { generatePdfFromPages, sharePdfFile } from './pdfGenerator';

export const DocumentScannerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isProcessingFilter, setIsProcessingFilter] = useState<boolean>(false);

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // OCR Modal & State
  const [ocrModalVisible, setOcrModalVisible] = useState<boolean>(false);
  const [isOcrRunning, setIsOcrRunning] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>({ status: '', progress: 0 });
  const [ocrResultText, setOcrResultText] = useState<string>('');
  const [ocrCopied, setOcrCopied] = useState<boolean>(false);

  const activePage: ScannedPage | undefined = pages[activePageIndex];

  // Pick images from gallery
  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Galeriye erişmek için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPages: ScannedPage[] = result.assets.map((asset, i) => ({
          id: `page_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          originalUri: asset.uri,
          processedUri: asset.uri,
          rotation: 0,
          filter: 'original',
          width: asset.width,
          height: asset.height,
        }));

        setPages((prev) => {
          const updated = [...prev, ...newPages];
          if (prev.length === 0) {
            setActivePageIndex(0);
          }
          return updated;
        });
      }
    } catch (error) {
      console.warn('Error picking images:', error);
      Alert.alert('Hata', 'Görsel seçilirken bir sorun oluştu.');
    }
  };

  // Capture photo with camera
  const handleCaptureWithCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Kamerayı kullanmak için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newPage: ScannedPage = {
          id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          originalUri: asset.uri,
          processedUri: asset.uri,
          rotation: 0,
          filter: 'original',
          width: asset.width,
          height: asset.height,
        };

        setPages((prev) => {
          const updated = [...prev, newPage];
          setActivePageIndex(updated.length - 1);
          return updated;
        });
      }
    } catch (error) {
      console.warn('Error taking photo:', error);
      Alert.alert('Hata', 'Fotoğraf çekilirken bir sorun oluştu.');
    }
  };

  // Rotate active page by 90 degrees
  const handleRotateActivePage = async () => {
    if (!activePage) return;
    const newRotation = (activePage.rotation + 90) % 360;

    setIsProcessingFilter(true);
    try {
      const processedUri = await applyImageFilter(
        activePage.originalUri,
        newRotation,
        activePage.filter
      );

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === activePageIndex
            ? { ...p, rotation: newRotation, processedUri }
            : p
        )
      );
    } catch (err) {
      console.warn('Rotate failed:', err);
    } finally {
      setIsProcessingFilter(false);
    }
  };

  // Change filter for active page
  const handleFilterChange = async (filter: FilterType) => {
    if (!activePage || activePage.filter === filter) return;

    setIsProcessingFilter(true);
    try {
      const processedUri = await applyImageFilter(
        activePage.originalUri,
        activePage.rotation,
        filter
      );

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === activePageIndex
            ? { ...p, filter, processedUri }
            : p
        )
      );
    } catch (err) {
      console.warn('Filter change failed:', err);
    } finally {
      setIsProcessingFilter(false);
    }
  };

  // Delete active page
  const handleDeletePage = (indexToDelete: number) => {
    setPages((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToDelete);
      if (activePageIndex >= updated.length) {
        setActivePageIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  // Move page position (reorder)
  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length || fromIndex === toIndex) return;
    setPages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
    setActivePageIndex(toIndex);
  };

  // Export & Share PDF
  const handleExportPdf = async () => {
    if (pages.length === 0) {
      Alert.alert('Uyarı', 'Lütfen önce taranacak sayfa ekleyin.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const title = `Gundelik_Belge_${new Date().toISOString().slice(0, 10)}`;
      const pdfUri = await generatePdfFromPages(pages, title);
      await sharePdfFile(pdfUri, `${title}.pdf`);
    } catch (error: any) {
      console.error('PDF export failed:', error);
      Alert.alert('Hata', error?.message || 'PDF oluşturulurken bir hata meydana geldi.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Start OCR on active page
  const handleStartOcr = async () => {
    if (!activePage) return;

    setOcrModalVisible(true);
    setIsOcrRunning(true);
    setOcrProgress({ status: 'Başlatılıyor...', progress: 0 });
    setOcrResultText('');
    setOcrCopied(false);

    try {
      const uriToRecognize = activePage.processedUri || activePage.originalUri;
      const text = await recognizeTextFromImage(uriToRecognize, 'tur+eng', (prog) => {
        setOcrProgress(prog);
      });

      setOcrResultText(text || 'Görselde okunabilir metin tespit edilemedi.');
      // Cache OCR text on page
      setPages((prev) =>
        prev.map((p, idx) =>
          idx === activePageIndex ? { ...p, ocrText: text } : p
        )
      );
    } catch (error: any) {
      console.error('OCR processing error:', error);
      setOcrResultText('Metin tanıma başarısız oldu: ' + (error?.message || 'Bilinmeyen hata'));
    } finally {
      setIsOcrRunning(false);
    }
  };

  // Copy OCR text
  const handleCopyOcrText = async () => {
    if (!ocrResultText) return;
    await Clipboard.setStringAsync(ocrResultText);
    setOcrCopied(true);
    setTimeout(() => setOcrCopied(false), 2000);
  };

  // Share OCR text
  const handleShareOcrText = async () => {
    if (!ocrResultText) return;
    if (await Sharing.isAvailableAsync()) {
      // Create a temporary data/share
      await Clipboard.setStringAsync(ocrResultText);
      Alert.alert('Kopyalandı', 'Metin panoya kopyalandı ve paylaşıma hazır.');
    } else {
      await Clipboard.setStringAsync(ocrResultText);
      setOcrCopied(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {pages.length === 0 ? (
        /* Empty State: No pages scanned yet */
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { padding: spacing.lg }]}
        >
          <View
            style={[
              styles.emptyHeroCard,
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
                styles.emptyIconCircle,
                {
                  backgroundColor: theme.primaryContainer,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <Ionicons
                name="scan-outline"
                size={48}
                color={theme.onPrimaryContainer}
              />
            </View>

            <Text
              style={[
                typography.titleMedium,
                { color: theme.textPrimary, marginTop: spacing.lg, textAlign: 'center' },
              ]}
            >
              Belge & PDF Tarayıcı
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
              Kameranızla veya galerinizden çok sayfalı belgeler tarayın, filtreler uygulayın, PDF oluşturun ve yapay zeka (OCR) ile metne dönüştürün.
            </Text>

            {/* Action Buttons */}
            <View style={[styles.emptyButtonsContainer, { marginTop: spacing.xl }]}>
              <TouchableOpacity
                onPress={handleCaptureWithCamera}
                style={[
                  styles.primaryActionButton,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Kamera ile Belge Tara"
              >
                <Ionicons name="camera" size={22} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.sm },
                  ]}
                >
                  Kamera ile Tara
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePickFromGallery}
                style={[
                  styles.secondaryActionButton,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                    marginTop: spacing.sm,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Galeriden Fotoğraf Seç"
              >
                <Ionicons name="images-outline" size={22} color={theme.textPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.textPrimary, marginLeft: spacing.sm },
                  ]}
                >
                  Galeriden Seç
                </Text>
              </TouchableOpacity>
            </View>

            {/* Feature Highlights */}
            <View style={[styles.featureList, { marginTop: spacing.xl }]}>
              <View style={styles.featureItem}>
                <Ionicons name="document-text" size={18} color={theme.accent} />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.textSecondary, marginLeft: spacing.xs },
                  ]}
                >
                  Cihaz İçi OCR (Metin Tanıma)
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="sparkles" size={18} color={theme.accent} />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.textSecondary, marginLeft: spacing.xs },
                  ]}
                >
                  Otomatik Belge Temizleme
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="share-social" size={18} color={theme.accent} />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.textSecondary, marginLeft: spacing.xs },
                  ]}
                >
                  Çok Sayfalı PDF Çıktısı
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* Active Document Scanner Interface */
        <ScrollView
          style={styles.scannerScrollView}
          contentContainerStyle={[styles.scannerContent, { padding: spacing.md }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar: Page Index & Quick Add */}
          <View
            style={[
              styles.topPageBar,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            <View style={styles.pageCountBadge}>
              <Ionicons name="document-outline" size={18} color={theme.primary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: theme.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Sayfa {activePageIndex + 1} / {pages.length}
              </Text>
            </View>

            <View style={styles.topAddButtons}>
              <TouchableOpacity
                onPress={handleCaptureWithCamera}
                style={[
                  styles.miniAddBtn,
                  { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Kamera ile sayfa ekle"
              >
                <Ionicons name="camera-outline" size={16} color={theme.onPrimaryContainer} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.onPrimaryContainer, marginLeft: 4 },
                  ]}
                >
                  Kamera
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePickFromGallery}
                style={[
                  styles.miniAddBtn,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Galeriden sayfa ekle"
              >
                <Ionicons name="add" size={16} color={theme.textPrimary} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.textPrimary, marginLeft: 2 },
                  ]}
                >
                  Ekle
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Page Viewport Card */}
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                marginTop: spacing.sm,
                padding: spacing.md,
              },
            ]}
          >
            {/* Active Image Box */}
            <View
              style={[
                styles.imageBox,
                {
                  backgroundColor: theme.inputBackground,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              {activePage && (
                <Image
                  source={{ uri: activePage.processedUri || activePage.originalUri }}
                  style={styles.activeImage}
                  resizeMode="contain"
                />
              )}

              {isProcessingFilter && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: '#FFFFFF', marginTop: spacing.xs, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 4 },
                    ]}
                  >
                    İşleniyor...
                  </Text>
                </View>
              )}
            </View>

            {/* Quick Actions Row below Preview */}
            <View style={[styles.pageControlsRow, { marginTop: spacing.sm }]}>
              {/* Rotate Button */}
              <TouchableOpacity
                onPress={handleRotateActivePage}
                disabled={isProcessingFilter}
                style={[
                  styles.iconActionButton,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Görüntüyü 90 derece döndür"
              >
                <Ionicons name="reload-outline" size={18} color={theme.textPrimary} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.textPrimary, marginLeft: 4 },
                  ]}
                >
                  Döndür (90°)
                </Text>
              </TouchableOpacity>

              {/* Move Page Left */}
              <TouchableOpacity
                onPress={() => handleMovePage(activePageIndex, activePageIndex - 1)}
                disabled={activePageIndex === 0}
                style={[
                  styles.iconSquareButton,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderRadius: borderRadius.sm,
                    opacity: activePageIndex === 0 ? 0.3 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sayfayı sola taşı"
              >
                <Ionicons name="arrow-back" size={16} color={theme.textPrimary} />
              </TouchableOpacity>

              {/* Move Page Right */}
              <TouchableOpacity
                onPress={() => handleMovePage(activePageIndex, activePageIndex + 1)}
                disabled={activePageIndex === pages.length - 1}
                style={[
                  styles.iconSquareButton,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderRadius: borderRadius.sm,
                    opacity: activePageIndex === pages.length - 1 ? 0.3 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sayfayı sağa taşı"
              >
                <Ionicons name="arrow-forward" size={16} color={theme.textPrimary} />
              </TouchableOpacity>

              {/* Delete Active Page */}
              <TouchableOpacity
                onPress={() => handleDeletePage(activePageIndex)}
                style={[
                  styles.iconActionButton,
                  { backgroundColor: theme.errorContainer, borderRadius: borderRadius.sm },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Bu sayfayı sil"
              >
                <Ionicons name="trash-outline" size={18} color={theme.onErrorContainer} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.onErrorContainer, marginLeft: 4 },
                  ]}
                >
                  Sil
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filters Selection Card */}
          <View
            style={[
              styles.filtersCard,
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
              Görsel Filtresi
            </Text>

            <View style={styles.filterTabsRow}>
              {FILTER_OPTIONS.map((opt) => {
                const isSelected = activePage?.filter === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => handleFilterChange(opt.id)}
                    disabled={isProcessingFilter}
                    style={[
                      styles.filterTabItem,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderRadius: borderRadius.sm,
                        paddingVertical: spacing.xs,
                        paddingHorizontal: spacing.sm,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${opt.label} filtresi`}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={isSelected ? theme.onPrimary : theme.textPrimary}
                    />
                    <Text
                      style={[
                        typography.labelSmall,
                        {
                          color: isSelected ? theme.onPrimary : theme.textPrimary,
                          marginLeft: 4,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Thumbnail Strip for Multi-Page Management */}
          <View
            style={[
              styles.thumbnailsContainer,
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
              Belge Sayfaları ({pages.length})
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailList}>
              {pages.map((p, idx) => {
                const isActive = idx === activePageIndex;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setActivePageIndex(idx)}
                    style={[
                      styles.thumbnailWrapper,
                      {
                        borderColor: isActive ? theme.primary : theme.cardBorder,
                        borderWidth: isActive ? 2 : 1,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Sayfa ${idx + 1}`}
                  >
                    <Image
                      source={{ uri: p.processedUri || p.originalUri }}
                      style={styles.thumbnailImage}
                    />
                    <View
                      style={[
                        styles.thumbBadge,
                        {
                          backgroundColor: isActive ? theme.primary : 'rgba(0,0,0,0.6)',
                          borderRadius: borderRadius.xs,
                        },
                      ]}
                    >
                      <Text style={[typography.labelSmall, { color: '#FFFFFF', fontSize: 10 }]}>
                        {idx + 1}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Add page button at the end */}
              <TouchableOpacity
                onPress={handlePickFromGallery}
                style={[
                  styles.thumbAddButton,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.sm,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Yeni sayfa ekle"
              >
                <Ionicons name="add" size={24} color={theme.textSecondary} />
                <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: 2 }]}>
                  Ekle
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Action Buttons Dock */}
          <View style={[styles.dockActionsRow, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
            {/* Export PDF Button */}
            <TouchableOpacity
              onPress={handleExportPdf}
              disabled={isGeneratingPdf || pages.length === 0}
              style={[
                styles.dockButton,
                {
                  backgroundColor: theme.primary,
                  borderRadius: borderRadius.md,
                  paddingVertical: spacing.md,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="PDF Olarak Dışa Aktar"
            >
              {isGeneratingPdf ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={20} color={theme.onPrimary} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.onPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    PDF Olarak Kaydet
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* OCR Extract Text Button */}
            <TouchableOpacity
              onPress={handleStartOcr}
              disabled={pages.length === 0}
              style={[
                styles.dockButton,
                {
                  backgroundColor: theme.accent,
                  borderRadius: borderRadius.md,
                  paddingVertical: spacing.md,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Metin Tanı OCR"
            >
              <Ionicons name="scan-circle-outline" size={22} color="#FFFFFF" />
              <Text
                style={[
                  typography.labelLarge,
                  { color: '#FFFFFF', marginLeft: spacing.xs },
                ]}
              >
                Metin Tanı (OCR)
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* OCR Result Modal */}
      <Modal
        visible={ocrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOcrModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContentCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleCol}>
                <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                  Yapay Zeka Metin Tanıma (OCR)
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Sayfa {activePageIndex + 1} üzerindeki metinler
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOcrModalVisible(false)}
                style={[
                  styles.modalCloseBtn,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* OCR Progress / Recognition View */}
            {isOcrRunning ? (
              <View style={[styles.ocrProgressBox, { paddingVertical: spacing.xl }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, marginTop: spacing.md },
                  ]}
                >
                  {ocrProgress.status || 'Metin taranıyor...'}
                </Text>
                <View
                  style={[
                    styles.progressBarTrack,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.xs,
                      marginTop: spacing.md,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${Math.round(ocrProgress.progress * 100)}%`,
                        borderRadius: borderRadius.xs,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    typography.labelMedium,
                    { color: theme.textSecondary, marginTop: spacing.xs },
                  ]}
                >
                  %{Math.round(ocrProgress.progress * 100)}
                </Text>
              </View>
            ) : (
              /* OCR Result Text View */
              <View style={{ flex: 1, marginTop: spacing.md }}>
                <ScrollView
                  style={[
                    styles.ocrTextBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: theme.textPrimary, lineHeight: 22 },
                    ]}
                    selectable
                  >
                    {ocrResultText}
                  </Text>
                </ScrollView>

                {/* Modal Action Buttons */}
                <View style={[styles.modalActionsRow, { marginTop: spacing.md }]}>
                  <TouchableOpacity
                    onPress={handleCopyOcrText}
                    style={[
                      styles.modalActionBtn,
                      {
                        backgroundColor: ocrCopied ? theme.success : theme.primary,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Metni Kopyala"
                  >
                    <Ionicons
                      name={ocrCopied ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color={theme.onPrimary}
                    />
                    <Text
                      style={[
                        typography.labelLarge,
                        { color: theme.onPrimary, marginLeft: spacing.xs },
                      ]}
                    >
                      {ocrCopied ? 'Kopyalandı!' : 'Metni Kopyala'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleShareOcrText}
                    style={[
                      styles.modalActionBtn,
                      {
                        backgroundColor: theme.surfaceVariant,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Metni Paylaş"
                  >
                    <Ionicons name="share-outline" size={18} color={theme.textPrimary} />
                    <Text
                      style={[
                        typography.labelLarge,
                        { color: theme.textPrimary, marginLeft: spacing.xs },
                      ]}
                    >
                      Paylaş
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyHeroCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonsContainer: {
    width: '100%',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
  },
  featureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scannerScrollView: {
    flex: 1,
  },
  scannerContent: {
    paddingBottom: 40,
  },
  topPageBar: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topAddButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewCard: {
    borderWidth: 1,
  },
  imageBox: {
    width: '100%',
    height: 320,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 38,
  },
  iconSquareButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersCard: {
    borderWidth: 1,
  },
  filterTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  filterTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  thumbnailsContainer: {
    borderWidth: 1,
  },
  thumbnailList: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  thumbnailWrapper: {
    width: 60,
    height: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  thumbAddButton: {
    width: 60,
    height: 80,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContentCard: {
    maxHeight: '80%',
    minHeight: 380,
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitleCol: {
    flex: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrProgressBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  ocrTextBox: {
    flex: 1,
    borderWidth: 1,
    maxHeight: 260,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
});
