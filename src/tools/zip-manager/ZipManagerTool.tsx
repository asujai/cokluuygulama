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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  ZipCompressionLevel,
  ZipArchiveInspection,
  ZipArchiveResult,
  ZipInputFile,
  ZipToolMode,
} from './types';
import {
  createZipArchive,
  extractSingleFileFromZip,
  formatFileSize,
  inspectZipArchive,
  readUriAsBytes,
  shareOrDownloadZipResult,
} from './zipService';

export const ZipManagerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Mode: 'create' | 'extract'
  const [mode, setMode] = useState<ZipToolMode>('create');

  // ==========================================
  // 1. Create State
  // ==========================================
  const [filesToZip, setFilesToZip] = useState<ZipInputFile[]>([]);
  const [archiveName, setArchiveName] = useState<string>('Gundelik_Arsiv');
  const [compressionLevel, setCompressionLevel] = useState<ZipCompressionLevel>('DEFLATE_NORMAL');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressProgress, setCompressProgress] = useState<number>(0);
  const [createResult, setCreateResult] = useState<ZipArchiveResult | null>(null);

  // ==========================================
  // 2. Extract State
  // ==========================================
  const [selectedZipFile, setSelectedZipFile] = useState<{
    name: string;
    uri: string;
    bytes: Uint8Array;
  } | null>(null);
  const [zipInspection, setZipInspection] = useState<ZipArchiveInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [extractingFileId, setExtractingFileId] = useState<string | null>(null);

  // Pick any files for compression
  const handlePickDocumentsToZip = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!doc.canceled && doc.assets && doc.assets.length > 0) {
        const newFiles: ZipInputFile[] = [];
        for (const asset of doc.assets) {
          const bytes = await readUriAsBytes(asset.uri);
          newFiles.push({
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: asset.name || 'dosya',
            uri: asset.uri,
            size: asset.size || bytes.length,
            type: asset.mimeType,
            bytes,
          });
        }
        setFilesToZip((prev) => [...prev, ...newFiles]);
        setCreateResult(null);
      }
    } catch (err) {
      console.warn('Doc pick error:', err);
    }
  };

  const handlePickImagesToZip = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles: ZipInputFile[] = [];
        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          const bytes = await readUriAsBytes(asset.uri);
          newFiles.push({
            id: `img_${Date.now()}_${i}`,
            name: asset.fileName || `foto_${Date.now()}_${i + 1}.jpg`,
            uri: asset.uri,
            size: asset.fileSize || bytes.length,
            type: asset.mimeType || 'image/jpeg',
            bytes,
          });
        }
        setFilesToZip((prev) => [...prev, ...newFiles]);
        setCreateResult(null);
      }
    } catch (err) {
      console.warn('Image pick error:', err);
    }
  };

  // Run Compression
  const handleExecuteCompress = async () => {
    if (filesToZip.length === 0) {
      Alert.alert('Uyarı', 'Lütfen arşive eklenecek dosya seçin.');
      return;
    }

    setIsCompressing(true);
    setCompressProgress(0);
    try {
      const res = await createZipArchive(
        filesToZip,
        archiveName,
        compressionLevel,
        (p) => setCompressProgress(p)
      );
      setCreateResult(res);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Arşiv oluşturulamadı.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Pick ZIP to Extract
  const handlePickZipToExtract = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!doc.canceled && doc.assets && doc.assets.length > 0) {
        const asset = doc.assets[0];
        setIsInspecting(true);
        try {
          const bytes = await readUriAsBytes(asset.uri);
          const inspection = await inspectZipArchive(bytes, asset.name || 'Arsiv.zip');
          setSelectedZipFile({
            name: asset.name || 'Arsiv.zip',
            uri: asset.uri,
            bytes,
          });
          setZipInspection(inspection);
        } catch (err: any) {
          Alert.alert('Hata', 'ZIP dosyası okunamadı veya bozuk: ' + (err?.message || ''));
        } finally {
          setIsInspecting(false);
        }
      }
    } catch (err) {
      console.warn('Pick zip error:', err);
    }
  };

  // Extract Single File
  const handleExtractSingleFile = async (filePath: string, fileName: string, fileId: string) => {
    if (!selectedZipFile) return;
    setExtractingFileId(fileId);
    try {
      const { uri } = await extractSingleFileFromZip(selectedZipFile.bytes, filePath, fileName);
      await shareOrDownloadZipResult(uri, fileName);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Dosya arşivden çıkarılamadı.');
    } finally {
      setExtractingFileId(null);
    }
  };

  const filteredZipItems = zipInspection
    ? zipInspection.items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : [];

  const totalInputSize = filesToZip.reduce((acc, f) => acc + f.size, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Mode Selector Segmented Tabs */}
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: 4,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setMode('create')}
          style={[
            styles.tabButton,
            {
              backgroundColor: mode === 'create' ? theme.primary : 'transparent',
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="archive-outline"
            size={18}
            color={mode === 'create' ? theme.onPrimary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              {
                color: mode === 'create' ? theme.onPrimary : theme.textSecondary,
                marginLeft: spacing.xs,
              },
            ]}
          >
            ZIP Oluştur
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode('extract')}
          style={[
            styles.tabButton,
            {
              backgroundColor: mode === 'extract' ? theme.primary : 'transparent',
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="folder-open-outline"
            size={18}
            color={mode === 'extract' ? theme.onPrimary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              {
                color: mode === 'extract' ? theme.onPrimary : theme.textSecondary,
                marginLeft: spacing.xs,
              },
            ]}
          >
            ZIP Aç / Çıkar
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* MODE 1: CREATE ZIP */}
      {/* ========================================================================= */}
      {mode === 'create' && (
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
            <View style={styles.headerRow}>
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  Arşive Eklenecek Dosyalar ({filesToZip.length})
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  {filesToZip.length > 0
                    ? `Toplam: ${formatFileSize(totalInputSize)}`
                    : 'Belge, fotoğraf, ses veya dilediğiniz dosyaları seçin.'}
                </Text>
              </View>

              <View style={styles.addButtonsGroup}>
                <TouchableOpacity
                  onPress={handlePickDocumentsToZip}
                  style={[
                    styles.miniAddBtn,
                    { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm },
                  ]}
                >
                  <Ionicons name="document-attach" size={16} color={theme.onPrimaryContainer} />
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: theme.onPrimaryContainer, marginLeft: 2 },
                    ]}
                  >
                    Belge
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePickImagesToZip}
                  style={[
                    styles.miniAddBtn,
                    { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
                  ]}
                >
                  <Ionicons name="images" size={16} color={theme.textPrimary} />
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: theme.textPrimary, marginLeft: 2 },
                    ]}
                  >
                    Fotoğraf
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {filesToZip.length === 0 ? (
              <View style={[styles.choiceButtonsRow, { marginTop: spacing.md }]}>
                <TouchableOpacity
                  onPress={handlePickDocumentsToZip}
                  style={[
                    styles.emptyChoiceBox,
                    {
                      borderColor: theme.inputBorder,
                      borderRadius: borderRadius.md,
                      padding: spacing.lg,
                    },
                  ]}
                >
                  <Ionicons name="documents-outline" size={32} color={theme.primary} />
                  <Text
                    style={[
                      typography.titleSmall,
                      { color: theme.textPrimary, marginTop: spacing.xs },
                    ]}
                  >
                    Belge Dosyaları Seç
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary, fontSize: 11 }]}>
                    PDF, DOC, TXT, XLS...
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePickImagesToZip}
                  style={[
                    styles.emptyChoiceBox,
                    {
                      borderColor: theme.inputBorder,
                      borderRadius: borderRadius.md,
                      padding: spacing.lg,
                    },
                  ]}
                >
                  <Ionicons name="images-outline" size={32} color={theme.accent} />
                  <Text
                    style={[
                      typography.titleSmall,
                      { color: theme.textPrimary, marginTop: spacing.xs },
                    ]}
                  >
                    Fotoğraflar Seç
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary, fontSize: 11 }]}>
                    JPG, PNG, WebP...
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                {filesToZip.map((file, idx) => (
                  <View
                    key={file.id}
                    style={[
                      styles.fileItemRow,
                      {
                        backgroundColor: theme.surfaceVariant,
                        borderColor: theme.cardBorder,
                        borderRadius: borderRadius.sm,
                        marginBottom: spacing.xs,
                        padding: spacing.sm,
                      },
                    ]}
                  >
                    <View style={styles.fileItemLeft}>
                      <Ionicons
                        name={
                          file.name.endsWith('.png') || file.name.endsWith('.jpg')
                            ? 'image-outline'
                            : file.name.endsWith('.pdf')
                            ? 'document-text-outline'
                            : 'document-outline'
                        }
                        size={20}
                        color={theme.primary}
                      />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text
                          style={[typography.titleSmall, { color: theme.textPrimary }]}
                          numberOfLines={1}
                        >
                          {idx + 1}. {file.name}
                        </Text>
                        <Text style={[typography.bodySmall, { color: theme.textSecondary, fontSize: 11 }]}>
                          {formatFileSize(file.size)}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        setFilesToZip((prev) => prev.filter((item) => item.id !== file.id))
                      }
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Archive Options */}
            {filesToZip.length > 0 && (
              <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: spacing.md }}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  Arşiv Dosya Adı:
                </Text>
                <TextInput
                  value={archiveName}
                  onChangeText={setArchiveName}
                  placeholder="Arsiv_Adi"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xxs,
                      padding: spacing.md,
                    },
                  ]}
                />

                {/* Compression Level Selector */}
                <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: spacing.md }]}>
                  Sıkıştırma Seviyesi:
                </Text>
                <View style={[styles.inlineChipsRow, { marginTop: spacing.xs }]}>
                  {[
                    { id: 'STORE', label: 'Depola (Hızlı)' },
                    { id: 'DEFLATE_NORMAL', label: 'Normal (Dengeli)' },
                    { id: 'DEFLATE_MAX', label: 'Maksimum (Küçük Boyut)' },
                  ].map((lvl) => {
                    const isSelected = compressionLevel === lvl.id;
                    return (
                      <TouchableOpacity
                        key={lvl.id}
                        onPress={() => setCompressionLevel(lvl.id as ZipCompressionLevel)}
                        style={[
                          styles.compressionChip,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                            borderColor: isSelected ? theme.primary : theme.cardBorder,
                            borderRadius: borderRadius.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 8,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.labelSmall,
                            { color: isSelected ? theme.onPrimary : theme.textPrimary },
                          ]}
                        >
                          {lvl.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Compress Action Button */}
                <TouchableOpacity
                  onPress={handleExecuteCompress}
                  disabled={isCompressing}
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
                  {isCompressing ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={theme.onPrimary} />
                      <Text
                        style={[
                          typography.labelLarge,
                          { color: theme.onPrimary, marginLeft: spacing.xs },
                        ]}
                      >
                        Sıkıştırılıyor (%{compressProgress})...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="archive" size={20} color={theme.onPrimary} />
                      <Text
                        style={[
                          typography.labelLarge,
                          { color: theme.onPrimary, marginLeft: spacing.xs },
                        ]}
                      >
                        ZIP Arşivini Oluştur
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Creation Results Card */}
          {createResult && (
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
                    ZIP Arşivi Başarıyla Oluşturuldu!
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                    {createResult.fileName} • {createResult.filesCount} Dosya
                  </Text>
                </View>
              </View>

              {/* Stats Box */}
              <View
                style={[
                  styles.statsGrid,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    padding: spacing.md,
                  },
                ]}
              >
                <View style={styles.statCol}>
                  <Text style={[typography.labelSmall, { color: theme.textMuted }]}>Orijinal Toplam</Text>
                  <Text style={[typography.titleSmall, { color: theme.textSecondary }]}>
                    {formatFileSize(createResult.totalOriginalSize)}
                  </Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={[typography.labelSmall, { color: theme.success }]}>ZIP Boyutu</Text>
                  <Text style={[typography.titleLarge, { color: theme.success, fontWeight: '700' }]}>
                    {formatFileSize(createResult.compressedSize)}
                  </Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={[typography.labelSmall, { color: theme.primary }]}>Tasarruf</Text>
                  <Text style={[typography.titleSmall, { color: theme.primary, fontWeight: '700' }]}>
                    %{createResult.savedPercentage}
                  </Text>
                </View>
              </View>

              <View style={[styles.resultButtonsGrid, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  onPress={() => shareOrDownloadZipResult(createResult.uri, createResult.fileName)}
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
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.onPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    ZIP İndir / Paylaş
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setFilesToZip([]);
                    setCreateResult(null);
                  }}
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
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.textPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    Yeni Arşiv
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: EXTRACT ZIP */}
      {/* ========================================================================= */}
      {mode === 'extract' && (
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
              ZIP Dosyası İnceleme & Çıkarma
            </Text>

            {!selectedZipFile ? (
              <TouchableOpacity
                onPress={handlePickZipToExtract}
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
                {isInspecting ? (
                  <ActivityIndicator size="large" color={theme.primary} />
                ) : (
                  <>
                    <Ionicons name="folder-open-outline" size={44} color={theme.textMuted} />
                    <Text style={[typography.titleSmall, { color: theme.textPrimary, marginTop: spacing.sm }]}>
                      ZIP Arşivini Seçin
                    </Text>
                    <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
                      Arşiv içerisindeki dosyaları görüntüleyin ve tek tek çıkartın.
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                {/* Archive Summary Header */}
                <View
                  style={[
                    styles.zipSummaryHeader,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                      {selectedZipFile.name}
                    </Text>
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      {zipInspection?.filesCount || 0} Dosya • Arşiv Boyutu: {formatFileSize(selectedZipFile.bytes.length)} (Açılmış: {formatFileSize(zipInspection?.totalUncompressedSize || 0)})
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedZipFile(null)}>
                    <Text style={[typography.labelSmall, { color: theme.error }]}>Farklı Seç</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Bar for Archive Files */}
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Arşiv içindeki dosyaları filtrele..."
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.sm,
                      padding: spacing.sm,
                    },
                  ]}
                />

                {/* File List */}
                <View style={{ marginTop: spacing.sm }}>
                  {filteredZipItems.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.extractedItemRow,
                        {
                          backgroundColor: item.isDirectory ? theme.surface : theme.surfaceVariant,
                          borderColor: theme.cardBorder,
                          borderRadius: borderRadius.sm,
                          marginBottom: spacing.xs,
                          padding: spacing.sm,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.isDirectory
                            ? 'folder-outline'
                            : item.name.endsWith('.png') || item.name.endsWith('.jpg')
                            ? 'image-outline'
                            : item.name.endsWith('.pdf')
                            ? 'document-text-outline'
                            : 'document-outline'
                        }
                        size={20}
                        color={item.isDirectory ? theme.accent : theme.primary}
                      />

                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text
                          style={[typography.titleSmall, { color: theme.textPrimary }]}
                          numberOfLines={1}
                        >
                          {item.path}
                        </Text>
                        {!item.isDirectory && (
                          <Text style={[typography.bodySmall, { color: theme.textSecondary, fontSize: 11 }]}>
                            {formatFileSize(item.uncompressedSize)}
                          </Text>
                        )}
                      </View>

                      {!item.isDirectory && (
                        <TouchableOpacity
                          onPress={() => handleExtractSingleFile(item.path, item.name, item.id)}
                          disabled={extractingFileId === item.id}
                          style={[
                            styles.extractMiniBtn,
                            {
                              backgroundColor: theme.primaryContainer,
                              borderRadius: borderRadius.xs,
                              paddingHorizontal: spacing.sm,
                              paddingVertical: 4,
                            },
                          ]}
                        >
                          {extractingFileId === item.id ? (
                            <ActivityIndicator size="small" color={theme.onPrimaryContainer} />
                          ) : (
                            <>
                              <Ionicons name="download-outline" size={14} color={theme.onPrimaryContainer} />
                              <Text
                                style={[
                                  typography.labelSmall,
                                  { color: theme.onPrimaryContainer, marginLeft: 2 },
                                ]}
                              >
                                İndir
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}
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
  tabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  card: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButtonsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  choiceButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyChoiceBox: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  fileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    fontSize: 15,
  },
  inlineChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compressionChip: {
    borderWidth: 1,
  },
  executeButton: {
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
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCol: {
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
  emptyDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zipSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extractedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  extractMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
