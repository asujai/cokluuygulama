import React, { useState, useRef } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  ImageToPdfItem,
  PdfFileItem,
  PdfOperationResult,
  PdfToolMode,
  SignatureOptions,
  WatermarkOptions,
} from './types';
import {
  addSignatureToPdf,
  addWatermarkToPdf,
  deletePdfPages,
  exportPdfResult,
  formatFileSize,
  getPdfPageCount,
  imagesToPdf,
  mergePdfs,
  readUriAsBytes,
  rotatePdfPages,
  shareOrDownloadPdfResult,
  splitPdfPages,
} from './pdfOperations';

export const PdfToolboxTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Active Mode
  const [activeMode, setActiveMode] = useState<PdfToolMode>('merge');

  // Shared Processing State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [result, setResult] = useState<PdfOperationResult | null>(null);

  // 1. Merge State
  const [mergeFiles, setMergeFiles] = useState<PdfFileItem[]>([]);

  // 2. Split / Delete State
  const [splitFile, setSplitFile] = useState<PdfFileItem | null>(null);
  const [pageRangeText, setPageRangeText] = useState<string>('1-2');
  const [deletePagesText, setDeletePagesText] = useState<string>('');

  // 3. Rotate State
  const [rotateFile, setRotateFile] = useState<PdfFileItem | null>(null);
  const [rotateAngle, setRotateAngle] = useState<number>(90);

  // 4. Images to PDF State
  const [imageItems, setImageItems] = useState<ImageToPdfItem[]>([]);

  // 5. Watermark State
  const [watermarkFile, setWatermarkFile] = useState<PdfFileItem | null>(null);
  const [watermarkOptions, setWatermarkOptions] = useState<WatermarkOptions>({
    text: 'GİZLİ & KOPYALANAMAZ',
    opacity: 0.25,
    fontSize: 36,
    color: '#DC2626',
    rotationAngle: 45,
  });

  // 6. Signature State
  const [signatureFile, setSignatureFile] = useState<PdfFileItem | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [signatureOptions, setSignatureOptions] = useState<SignatureOptions>({
    pageIndex: 0,
    position: 'bottom-right',
    scale: 1,
  });
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const signatureCanvasRef = useRef<any>(null);

  // ==========================================
  // File Picker Helpers
  // ==========================================
  const handlePickPdf = async (onSelected: (file: PdfFileItem) => void) => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!doc.canceled && doc.assets && doc.assets.length > 0) {
        const asset = doc.assets[0];
        const bytes = await readUriAsBytes(asset.uri);
        const pageCount = await getPdfPageCount(bytes);
        onSelected({
          id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: asset.name || 'belge.pdf',
          uri: asset.uri,
          size: asset.size || bytes.length,
          pageCount,
          bytes,
        });
        setResult(null);
      }
    } catch (err: any) {
      console.warn('PDF pick error:', err);
      Alert.alert('Hata', 'PDF dosyası seçilirken bir hata oluştu.');
    }
  };

  const handlePickMultiplePdfs = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!doc.canceled && doc.assets && doc.assets.length > 0) {
        const newItems: PdfFileItem[] = [];
        for (const asset of doc.assets) {
          const bytes = await readUriAsBytes(asset.uri);
          const pageCount = await getPdfPageCount(bytes);
          newItems.push({
            id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: asset.name || 'belge.pdf',
            uri: asset.uri,
            size: asset.size || bytes.length,
            pageCount,
            bytes,
          });
        }
        setMergeFiles((prev) => [...prev, ...newItems]);
        setResult(null);
      }
    } catch (err) {
      console.warn('Multiple PDF pick error:', err);
    }
  };

  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages: ImageToPdfItem[] = result.assets.map((asset, i) => ({
          id: `img_${Date.now()}_${i}`,
          name: asset.fileName || `gorsel_${i + 1}.jpg`,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          size: asset.fileSize,
        }));
        setImageItems((prev) => [...prev, ...newImages]);
        setResult(null);
      }
    } catch (err) {
      console.warn('Image pick error:', err);
    }
  };

  // ==========================================
  // Operations Execution
  // ==========================================

  // 1. Merge
  const handleExecuteMerge = async () => {
    if (mergeFiles.length < 2) {
      Alert.alert('Uyarı', 'Birleştirmek için en az 2 PDF dosyası eklemelisiniz.');
      return;
    }
    setIsProcessing(true);
    setProgressMessage('PDF dosyaları birleştiriliyor...');
    try {
      const filesWithBytes = [];
      for (const f of mergeFiles) {
        const bytes = f.bytes || (await readUriAsBytes(f.uri));
        filesWithBytes.push({ name: f.name, bytes });
      }
      const mergedBytes = await mergePdfs(filesWithBytes);
      const res = await exportPdfResult(mergedBytes, `Birlestirilmis_Belge_${Date.now()}.pdf`);
      setResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Birleştirme işlemi başarısız oldu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Split
  const handleExecuteSplit = async () => {
    if (!splitFile) return;
    setIsProcessing(true);
    setProgressMessage('Sayfalar ayıklanıyor...');
    try {
      const bytes = splitFile.bytes || (await readUriAsBytes(splitFile.uri));
      const newBytes = await splitPdfPages(bytes, pageRangeText);
      const res = await exportPdfResult(newBytes, `Ayiklanmis_${splitFile.name}`);
      setResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Bölme işlemi başarısız oldu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Delete Pages
  const handleExecuteDeletePages = async () => {
    if (!splitFile) return;
    setIsProcessing(true);
    setProgressMessage('İstenmeyen sayfalar siliniyor...');
    try {
      const bytes = splitFile.bytes || (await readUriAsBytes(splitFile.uri));
      const pagesToDelete = deletePagesText
        .split(/[,;\s]+/)
        .map((n) => parseInt(n, 10) - 1)
        .filter((n) => !isNaN(n) && n >= 0);

      if (pagesToDelete.length === 0) {
        throw new Error('Lütfen silinecek sayfa numaralarını giriniz (Örn: 2, 4).');
      }

      const newBytes = await deletePdfPages(bytes, pagesToDelete);
      const res = await exportPdfResult(newBytes, `Sayfalari_Silinmis_${splitFile.name}`);
      setResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Sayfa silme başarısız oldu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Rotate
  const handleExecuteRotate = async () => {
    if (!rotateFile) return;
    setIsProcessing(true);
    setProgressMessage(`Sayfalar ${rotateAngle}° döndürülüyor...`);
    try {
      const bytes = rotateFile.bytes || (await readUriAsBytes(rotateFile.uri));
      const rotatedBytes = await rotatePdfPages(bytes, rotateAngle);
      const res = await exportPdfResult(rotatedBytes, `Dondurulmus_${rotateFile.name}`);
      setResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Döndürme işlemi başarısız oldu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Images to PDF
  const handleExecuteImagesToPdf = async () => {
    if (imageItems.length === 0) return;
    setIsProcessing(true);
    setProgressMessage('Görseller A4 PDF belgesine dönüştürülüyor...');
    try {
      const pdfBytes = await imagesToPdf(imageItems, { margin: 20 });
      const res = await exportPdfResult(pdfBytes, `Gorseller_${Date.now()}.pdf`);
      setResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Görseller dönüştürülemedi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Watermark
  const handleExecuteWatermark = async () => {
    if (!watermarkFile) return;
    setIsProcessing(true);
    setProgressMessage('Filigran tüm sayfalara ekleniyor...');
    try {
      const bytes = watermarkFile.bytes || (await readUriAsBytes(watermarkFile.uri));
      const watermarkedBytes = await addWatermarkToPdf(bytes, watermarkOptions);
      const res = await exportPdfResult(watermarkedBytes, `Filigranli_${watermarkFile.name}`);
      setResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Filigran eklenemedi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Signature
  const handleExecuteSignature = async () => {
    if (!signatureFile || !signatureDataUrl) {
      Alert.alert('Uyarı', 'Lütfen önce PDF seçin ve imzanızı çizin.');
      return;
    }
    setIsProcessing(true);
    setProgressMessage('İmza belgeye damgalanıyor...');
    try {
      const bytes = signatureFile.bytes || (await readUriAsBytes(signatureFile.uri));
      const signedBytes = await addSignatureToPdf(bytes, signatureDataUrl, signatureOptions);
      const res = await exportPdfResult(signedBytes, `Imzali_${signatureFile.name}`);
      setResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'İmza ekleme başarısız oldu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Canvas Drawing Handlers for Web
  const startDrawing = (e: any) => {
    if (Platform.OS !== 'web') return;
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: any) => {
    if (!isDrawing || Platform.OS !== 'web') return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || Platform.OS !== 'web') return;
    setIsDrawing(false);
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    if (signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureDataUrl('');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Mode Navigation Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.modeScrollRow}
      >
        {[
          { id: 'merge', label: 'Birleştir', icon: 'git-merge-outline' },
          { id: 'split', label: 'Böl / Sil', icon: 'cut-outline' },
          { id: 'rotate', label: 'Döndür', icon: 'refresh-outline' },
          { id: 'images_to_pdf', label: 'Görsellerden PDF', icon: 'images-outline' },
          { id: 'watermark', label: 'Filigran', icon: 'text-outline' },
          { id: 'signature', label: 'İmza Ekle', icon: 'create-outline' },
        ].map((m) => {
          const isSelected = activeMode === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => {
                setActiveMode(m.id as PdfToolMode);
                setResult(null);
              }}
              style={[
                styles.modePill,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.cardBorder,
                  borderRadius: borderRadius.full,
                  paddingVertical: spacing.xs + 2,
                  paddingHorizontal: spacing.md,
                },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name={m.icon as any}
                size={16}
                color={isSelected ? theme.onPrimary : theme.textPrimary}
              />
              <Text
                style={[
                  typography.labelSmall,
                  {
                    color: isSelected ? theme.onPrimary : theme.textPrimary,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODE 1: PDF MERGE */}
      {/* ========================================================================= */}
      {activeMode === 'merge' && (
        <View style={{ marginTop: spacing.md }}>
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
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  PDF Dosyaları ({mergeFiles.length})
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Birleştirmek istediğiniz PDF belgelerini ekleyin.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handlePickMultiplePdfs}
                style={[
                  styles.miniAddBtn,
                  { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm },
                ]}
              >
                <Ionicons name="add" size={18} color={theme.onPrimaryContainer} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.onPrimaryContainer, marginLeft: 2 },
                  ]}
                >
                  PDF Ekle
                </Text>
              </TouchableOpacity>
            </View>

            {mergeFiles.length === 0 ? (
              <TouchableOpacity
                onPress={handlePickMultiplePdfs}
                style={[
                  styles.emptyDropzone,
                  {
                    borderColor: theme.inputBorder,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    padding: spacing.xl,
                  },
                ]}
              >
                <Ionicons name="document-attach-outline" size={40} color={theme.textMuted} />
                <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  PDF Belgelerini Seçmek İçin Dokunun
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                {mergeFiles.map((file, idx) => (
                  <View
                    key={file.id}
                    style={[
                      styles.fileRowItem,
                      {
                        backgroundColor: theme.surfaceVariant,
                        borderColor: theme.cardBorder,
                        borderRadius: borderRadius.sm,
                        marginBottom: spacing.xs,
                        padding: spacing.sm,
                      },
                    ]}
                  >
                    <View style={styles.fileLeftInfo}>
                      <Ionicons name="document-text" size={20} color={theme.primary} />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text
                          style={[typography.titleSmall, { color: theme.textPrimary }]}
                          numberOfLines={1}
                        >
                          {idx + 1}. {file.name}
                        </Text>
                        <Text style={[typography.bodySmall, { color: theme.textSecondary, fontSize: 11 }]}>
                          {file.pageCount || 1} Sayfa • {formatFileSize(file.size)}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        setMergeFiles((prev) => prev.filter((item) => item.id !== file.id))
                      }
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {mergeFiles.length > 0 && (
              <TouchableOpacity
                onPress={handleExecuteMerge}
                disabled={isProcessing}
                style={[
                  styles.executeButton,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Ionicons name="git-merge" size={20} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  PDF'leri Birleştir
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: SPLIT & DELETE */}
      {/* ========================================================================= */}
      {activeMode === 'split' && (
        <View style={{ marginTop: spacing.md }}>
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
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              PDF Bölme & Sayfa Ayıklama
            </Text>

            {!splitFile ? (
              <TouchableOpacity
                onPress={() => handlePickPdf(setSplitFile)}
                style={[
                  styles.emptyDropzone,
                  {
                    borderColor: theme.inputBorder,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    padding: spacing.xl,
                  },
                ]}
              >
                <Ionicons name="cut-outline" size={40} color={theme.textMuted} />
                <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  Bölünecek PDF Dosyasını Seçin
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <View
                  style={[
                    styles.selectedFileHeader,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                      {splitFile.name}
                    </Text>
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      Toplam: {splitFile.pageCount} Sayfa • {formatFileSize(splitFile.size)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSplitFile(null)}>
                    <Text style={[typography.labelSmall, { color: theme.error }]}>Değiştir</Text>
                  </TouchableOpacity>
                </View>

                {/* Option A: Extract page ranges */}
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
                    Aralık Ayıkla (Yeni PDF Oluştur):
                  </Text>
                  <TextInput
                    value={pageRangeText}
                    onChangeText={setPageRangeText}
                    placeholder="Örnek: 1-3, 5, 7-10"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary,
                        borderRadius: borderRadius.md,
                        marginTop: spacing.xs,
                        padding: spacing.md,
                      },
                    ]}
                  />

                  <TouchableOpacity
                    onPress={handleExecuteSplit}
                    disabled={isProcessing}
                    style={[
                      styles.executeButton,
                      {
                        backgroundColor: theme.primary,
                        borderRadius: borderRadius.md,
                        marginTop: spacing.xs,
                        paddingVertical: spacing.sm,
                      },
                    ]}
                  >
                    <Ionicons name="cut" size={18} color={theme.onPrimary} />
                    <Text style={[typography.labelMedium, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                      Bu Sayfaları Ayıkla
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Option B: Delete pages */}
                <View style={{ marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: spacing.md }}>
                  <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
                    İstenmeyen Sayfaları Sil:
                  </Text>
                  <TextInput
                    value={deletePagesText}
                    onChangeText={setDeletePagesText}
                    placeholder="Silinecek Sayfa No (Örn: 2, 4)"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary,
                        borderRadius: borderRadius.md,
                        marginTop: spacing.xs,
                        padding: spacing.md,
                      },
                    ]}
                  />

                  <TouchableOpacity
                    onPress={handleExecuteDeletePages}
                    disabled={isProcessing}
                    style={[
                      styles.executeButton,
                      {
                        backgroundColor: theme.error,
                        borderRadius: borderRadius.md,
                        marginTop: spacing.xs,
                        paddingVertical: spacing.sm,
                      },
                    ]}
                  >
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                    <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: spacing.xs }]}>
                      Bu Sayfaları Sil ve Kaydet
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: ROTATE */}
      {/* ========================================================================= */}
      {activeMode === 'rotate' && (
        <View style={{ marginTop: spacing.md }}>
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
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              PDF Sayfalarını Döndürme
            </Text>

            {!rotateFile ? (
              <TouchableOpacity
                onPress={() => handlePickPdf(setRotateFile)}
                style={[
                  styles.emptyDropzone,
                  {
                    borderColor: theme.inputBorder,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    padding: spacing.xl,
                  },
                ]}
              >
                <Ionicons name="refresh-outline" size={40} color={theme.textMuted} />
                <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  Döndürülecek PDF Belgesini Seçin
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <View
                  style={[
                    styles.selectedFileHeader,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                      {rotateFile.name}
                    </Text>
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      {rotateFile.pageCount} Sayfa
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setRotateFile(null)}>
                    <Text style={[typography.labelSmall, { color: theme.error }]}>Değiştir</Text>
                  </TouchableOpacity>
                </View>

                {/* Angle selection buttons */}
                <View style={[styles.angleSelectorRow, { marginTop: spacing.md }]}>
                  {[90, 180, 270].map((ang) => {
                    const isSelected = rotateAngle === ang;
                    return (
                      <TouchableOpacity
                        key={ang}
                        onPress={() => setRotateAngle(ang)}
                        style={[
                          styles.angleBtn,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                            borderRadius: borderRadius.md,
                            paddingVertical: spacing.md,
                          },
                        ]}
                      >
                        <Ionicons
                          name="reload"
                          size={20}
                          color={isSelected ? theme.onPrimary : theme.textPrimary}
                        />
                        <Text
                          style={[
                            typography.labelLarge,
                            {
                              color: isSelected ? theme.onPrimary : theme.textPrimary,
                              marginTop: 4,
                            },
                          ]}
                        >
                          {ang}° Döndür
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={handleExecuteRotate}
                  disabled={isProcessing}
                  style={[
                    styles.executeButton,
                    {
                      backgroundColor: theme.primary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.lg,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
                  <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                    Döndürmeyi Uygula ve Kaydet
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODE 4: IMAGES TO PDF */}
      {/* ========================================================================= */}
      {activeMode === 'images_to_pdf' && (
        <View style={{ marginTop: spacing.md }}>
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
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  Fotoğrafları PDF Yap ({imageItems.length})
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Galerinizden fotoğrafları seçin ve A4 PDF haline getirin.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handlePickImages}
                style={[
                  styles.miniAddBtn,
                  { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm },
                ]}
              >
                <Ionicons name="images" size={18} color={theme.onPrimaryContainer} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.onPrimaryContainer, marginLeft: 2 },
                  ]}
                >
                  Fotoğraf Ekle
                </Text>
              </TouchableOpacity>
            </View>

            {imageItems.length === 0 ? (
              <TouchableOpacity
                onPress={handlePickImages}
                style={[
                  styles.emptyDropzone,
                  {
                    borderColor: theme.inputBorder,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    padding: spacing.xl,
                  },
                ]}
              >
                <Ionicons name="images-outline" size={40} color={theme.textMuted} />
                <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  Galeriden Fotoğraf Seçmek İçin Dokunun
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.sm }}>
                  {imageItems.map((img, idx) => (
                    <View
                      key={img.id}
                      style={[
                        styles.imageThumbCard,
                        {
                          backgroundColor: theme.surfaceVariant,
                          borderColor: theme.cardBorder,
                          borderRadius: borderRadius.sm,
                          marginRight: spacing.sm,
                          padding: 4,
                        },
                      ]}
                    >
                      <Image source={{ uri: img.uri }} style={{ width: 80, height: 100, borderRadius: 4 }} resizeMode="cover" />
                      <Text style={[typography.labelSmall, { color: theme.textPrimary, textAlign: 'center', marginTop: 2 }]}>
                        Sayfa {idx + 1}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setImageItems((prev) => prev.filter((item) => item.id !== img.id))}
                        style={styles.thumbDeleteBtn}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  onPress={handleExecuteImagesToPdf}
                  disabled={isProcessing}
                  style={[
                    styles.executeButton,
                    {
                      backgroundColor: theme.primary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.md,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="document-text" size={20} color={theme.onPrimary} />
                  <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                    A4 PDF Olarak Oluştur
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODE 5: WATERMARK */}
      {/* ========================================================================= */}
      {activeMode === 'watermark' && (
        <View style={{ marginTop: spacing.md }}>
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
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Filigran (Watermark) Ekle
            </Text>

            {!watermarkFile ? (
              <TouchableOpacity
                onPress={() => handlePickPdf(setWatermarkFile)}
                style={[
                  styles.emptyDropzone,
                  {
                    borderColor: theme.inputBorder,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    padding: spacing.xl,
                  },
                ]}
              >
                <Ionicons name="text-outline" size={40} color={theme.textMuted} />
                <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  Filigran Eklenecek PDF Dosyasını Seçin
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <View
                  style={[
                    styles.selectedFileHeader,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                      {watermarkFile.name}
                    </Text>
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      {watermarkFile.pageCount} Sayfa
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setWatermarkFile(null)}>
                    <Text style={[typography.labelSmall, { color: theme.error }]}>Değiştir</Text>
                  </TouchableOpacity>
                </View>

                {/* Watermark inputs */}
                <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: spacing.md }]}>
                  Filigran Metni
                </Text>
                <TextInput
                  value={watermarkOptions.text}
                  onChangeText={(val) => setWatermarkOptions((prev) => ({ ...prev, text: val }))}
                  placeholder="GİZLİ / KOPYALANAMAZ / TASLAK"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                />

                {/* Color and Opacity Selector */}
                <View style={[styles.inlineChipsRow, { marginTop: spacing.md }]}>
                  {['#DC2626', '#2563EB', '#059669', '#475569'].map((c) => {
                    const isSelected = watermarkOptions.color === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setWatermarkOptions((prev) => ({ ...prev, color: c }))}
                        style={[
                          styles.colorCircle,
                          {
                            backgroundColor: c,
                            borderColor: isSelected ? theme.primary : 'transparent',
                            borderWidth: isSelected ? 3 : 0,
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={handleExecuteWatermark}
                  disabled={isProcessing}
                  style={[
                    styles.executeButton,
                    {
                      backgroundColor: theme.primary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.lg,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
                  <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                    Filigranı Uygula ve Kaydet
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODE 6: SIGNATURE */}
      {/* ========================================================================= */}
      {activeMode === 'signature' && (
        <View style={{ marginTop: spacing.md }}>
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
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              PDF Belgesini İmzala
            </Text>

            {!signatureFile ? (
              <TouchableOpacity
                onPress={() => handlePickPdf(setSignatureFile)}
                style={[
                  styles.emptyDropzone,
                  {
                    borderColor: theme.inputBorder,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    padding: spacing.xl,
                  },
                ]}
              >
                <Ionicons name="create-outline" size={40} color={theme.textMuted} />
                <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  İmzalanacak PDF Belgesini Seçin
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <View
                  style={[
                    styles.selectedFileHeader,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                      {signatureFile.name}
                    </Text>
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      {signatureFile.pageCount} Sayfa
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSignatureFile(null)}>
                    <Text style={[typography.labelSmall, { color: theme.error }]}>Değiştir</Text>
                  </TouchableOpacity>
                </View>

                {/* Signature Pad */}
                <Text style={[typography.labelMedium, { color: theme.textPrimary, marginTop: spacing.md }]}>
                  İmzanızı Çizin:
                </Text>

                {Platform.OS === 'web' ? (
                  <View style={styles.signaturePadWrapper}>
                    <canvas
                      ref={signatureCanvasRef}
                      width={340}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #94A3B8',
                        borderRadius: 8,
                        touchAction: 'none',
                        cursor: 'crosshair',
                        width: '100%',
                        maxWidth: 400,
                        height: 140,
                      }}
                    />
                    <TouchableOpacity onPress={clearSignature} style={{ marginTop: 6, alignSelf: 'flex-end' }}>
                      <Text style={[typography.labelSmall, { color: theme.error }]}>Temizle</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={async () => {
                      // Native fallback signature generator or pick signature photo
                      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
                      if (!res.canceled && res.assets?.[0]?.uri) {
                        setSignatureDataUrl(res.assets[0].uri);
                      }
                    }}
                    style={[styles.emptyDropzone, { padding: spacing.lg }]}
                  >
                    <Text style={[typography.bodyMedium, { color: theme.primary }]}>
                      İmza Görseli Seçin
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Position Picker */}
                <Text style={[typography.labelMedium, { color: theme.textPrimary, marginTop: spacing.sm }]}>
                  İmza Konumu:
                </Text>
                <View style={[styles.inlineChipsRow, { marginTop: spacing.xs }]}>
                  {[
                    { id: 'bottom-right', label: 'Sağ Alt' },
                    { id: 'bottom-left', label: 'Sol Alt' },
                    { id: 'center', label: 'Ortala' },
                  ].map((pos) => {
                    const isSelected = signatureOptions.position === pos.id;
                    return (
                      <TouchableOpacity
                        key={pos.id}
                        onPress={() =>
                          setSignatureOptions((prev) => ({ ...prev, position: pos.id as any }))
                        }
                        style={[
                          styles.miniChip,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                            borderRadius: borderRadius.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 6,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.labelSmall,
                            { color: isSelected ? theme.onPrimary : theme.textPrimary },
                          ]}
                        >
                          {pos.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={handleExecuteSignature}
                  disabled={isProcessing}
                  style={[
                    styles.executeButton,
                    {
                      backgroundColor: theme.primary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.lg,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="create" size={20} color={theme.onPrimary} />
                  <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                    İmzayı Belgeye Ekle ve Kaydet
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PROCESSING & RESULTS POPUP / CARD */}
      {/* ========================================================================= */}
      {isProcessing && (
        <View
          style={[
            styles.processingCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.primary,
              borderRadius: borderRadius.lg,
              marginTop: spacing.md,
              padding: spacing.lg,
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[typography.titleSmall, { color: theme.textPrimary, marginTop: spacing.sm }]}>
            {progressMessage || 'İşleniyor...'}
          </Text>
        </View>
      )}

      {result && !isProcessing && (
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
            <Ionicons name="checkmark-circle" size={32} color={theme.success} />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                İşlem Başarıyla Tamamlandı!
              </Text>
              <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                {result.fileName} • {result.pageCount} Sayfa • {formatFileSize(result.fileSize)}
              </Text>
            </View>
          </View>

          <View style={[styles.resultButtonsGrid, { marginTop: spacing.lg }]}>
            <TouchableOpacity
              onPress={() => shareOrDownloadPdfResult(result)}
              style={[
                styles.resultActionBtn,
                {
                  backgroundColor: theme.primary,
                  borderRadius: borderRadius.md,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <Ionicons name="download-outline" size={20} color={theme.onPrimary} />
              <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                İndir / Paylaş
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setResult(null)}
              style={[
                styles.resultActionBtn,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderRadius: borderRadius.md,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <Ionicons name="refresh" size={18} color={theme.textPrimary} />
              <Text style={[typography.labelLarge, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                Yeni İşlem
              </Text>
            </TouchableOpacity>
          </View>
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
  modeScrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  card: {
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emptyDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  fileLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedFileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textInput: {
    borderWidth: 1,
    fontSize: 15,
  },
  angleSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  angleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageThumbCard: {
    borderWidth: 1,
    position: 'relative',
  },
  thumbDeleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  inlineChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  signaturePadWrapper: {
    marginTop: 8,
  },
  miniChip: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  processingCard: {
    borderWidth: 1,
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
  resultButtonsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  resultActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
