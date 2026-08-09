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
import { useTheme } from '../../core/theme';
import {
  FilePartItem,
  MergeResult,
  SplitMode,
  SplitResult,
  SplitUnit,
} from './types';
import {
  computeSha256,
  formatFileSize,
  mergeParts,
  readUriAsBytes,
  shareOrDownloadFile,
  splitFile,
} from './fileSplitterService';

export const LargeFileSplitterTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'split' | 'merge'>('split');

  // SPLIT STATE
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<number>(0);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);

  const [splitMode, setSplitMode] = useState<SplitMode>('size');
  const [chunkSizeVal, setChunkSizeVal] = useState<number>(500);
  const [chunkUnit, setChunkUnit] = useState<SplitUnit>('KB');
  const [targetPartsCount, setTargetPartsCount] = useState<number>(3);

  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);

  // MERGE STATE
  const [mergePartsList, setMergePartsList] = useState<{ name: string; bytes: Uint8Array; uri: string }[]>([]);
  const [expectedChecksum, setExpectedChecksum] = useState<string>('');
  const [outputMergedName, setOutputMergedName] = useState<string>('birlesmis_dosya');
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  // Pick file for splitting
  const handlePickFileToSplit = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const bytes = await readUriAsBytes(asset.uri);

        setSelectedFileUri(asset.uri);
        setSelectedFileName(asset.name || 'dosya');
        setSelectedFileSize(asset.size || bytes.length);
        setFileBytes(bytes);
        setSplitResult(null);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Dosya okunamadı.');
    }
  };

  // Run Split Action
  const handleExecuteSplit = async () => {
    if (!fileBytes || !selectedFileName) {
      Alert.alert('Uyarı', 'Lütfen bölünecek bir dosya seçin.');
      return;
    }

    try {
      setIsSplitting(true);
      const res = await splitFile(
        fileBytes,
        selectedFileName,
        splitMode,
        chunkSizeVal,
        chunkUnit,
        targetPartsCount
      );
      setSplitResult(res);
    } catch (err: any) {
      Alert.alert('Bölme Hatası', err?.message || 'Dosya bölünürken hata oluştu.');
    } finally {
      setIsSplitting(false);
    }
  };

  // Share individual split part
  const handleSharePart = async (part: FilePartItem) => {
    try {
      await shareOrDownloadFile(part.bytes, part.name);
    } catch (err: any) {
      Alert.alert('Paylaşım Hatası', err?.message || 'Parça indirilemedi.');
    }
  };

  // Pick parts for merging
  const handlePickPartsToMerge = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const loaded = await Promise.all(
          res.assets.map(async (asset) => {
            const bytes = await readUriAsBytes(asset.uri);
            return {
              name: asset.name || 'part',
              bytes,
              uri: asset.uri,
            };
          })
        );

        setMergePartsList((prev) => [...prev, ...loaded]);
        setMergeResult(null);

        // Auto derive output filename from first part
        if (loaded.length > 0) {
          const first = loaded[0].name;
          const cleanName = first.replace(/\.part\d+$/i, '');
          if (cleanName && cleanName !== first) {
            setOutputMergedName(cleanName);
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Parçalar yüklenemedi.');
    }
  };

  // Run Merge Action
  const handleExecuteMerge = async () => {
    if (mergePartsList.length === 0) {
      Alert.alert('Uyarı', 'Lütfen birleştirilecek parçaları seçin.');
      return;
    }

    try {
      setIsMerging(true);
      const res = await mergeParts(mergePartsList, outputMergedName, expectedChecksum.trim());
      setMergeResult(res);
    } catch (err: any) {
      Alert.alert('Birleştirme Hatası', err?.message || 'Parçalar birleştirilirken hata oluştu.');
    } finally {
      setIsMerging(false);
    }
  };

  // Download Merged Result File
  const handleShareMerged = async () => {
    if (!mergeResult) return;
    try {
      // Re-read merged bytes from state or window blob
      const sorted = [...mergePartsList].sort((a, b) => a.name.localeCompare(b.name));
      let total = 0;
      sorted.forEach((s) => (total += s.bytes.length));
      const combined = new Uint8Array(total);
      let off = 0;
      sorted.forEach((s) => {
        combined.set(s.bytes, off);
        off += s.bytes.length;
      });

      await shareOrDownloadFile(combined, mergeResult.mergedFileName);
    } catch (err: any) {
      Alert.alert('Paylaşım Hatası', err?.message || 'Birleşmiş dosya indirilemedi.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Ionicons name="cut-outline" size={32} color={theme.primary} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Büyük Dosya Bölücü & Birleştirici</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Büyük dosyaları seçtiğiniz boyutlarda parçalara bölün veya parçaları SHA-256 doğrulaması ile birleştirin.
          </Text>
        </View>
      </View>

      {/* Main Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'split' && { backgroundColor: theme.primary }]}
          onPress={() => setActiveTab('split')}
        >
          <Ionicons name="cut-outline" size={18} color={activeTab === 'split' ? '#FFFFFF' : theme.textPrimary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'split' ? '#FFFFFF' : theme.textPrimary }]}>
            Dosya Bölme (Splitter)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'merge' && { backgroundColor: theme.primary }]}
          onPress={() => setActiveTab('merge')}
        >
          <Ionicons name="layers-outline" size={18} color={activeTab === 'merge' ? '#FFFFFF' : theme.textPrimary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'merge' ? '#FFFFFF' : theme.textPrimary }]}>
            Parça Birleştirme (Merger)
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: SPLITTER */}
      {activeTab === 'split' && (
        <View>
          {!selectedFileUri ? (
            <View style={[styles.uploadBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Ionicons name="document-text-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.uploadTitle, { color: theme.textPrimary }]}>Bölünecek Dosyayı Seçin</Text>
              <Text style={[styles.uploadSub, { color: theme.textSecondary }]}>
                İstediğiniz türde (video, zip, pdf, imaj) büyük dosyayı cihazınızdan seçin.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handlePickFileToSplit}
              >
                <Ionicons name="folder-open-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Dosya Seç</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {/* Selected File Card */}
              <View style={[styles.fileCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                <Ionicons name="document-attach" size={28} color={theme.primary} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.fileName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {selectedFileName}
                  </Text>
                  <Text style={[styles.fileMeta, { color: theme.textSecondary }]}>
                    {formatFileSize(selectedFileSize)} ({selectedFileSize.toLocaleString()} B)
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.smallChangeBtn, { borderColor: theme.cardBorder }]}
                  onPress={handlePickFileToSplit}
                >
                  <Text style={[styles.smallChangeBtnText, { color: theme.primary }]}>Değiştir</Text>
                </TouchableOpacity>
              </View>

              {/* Split Mode & Configuration */}
              <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Bölme Seçenekleri</Text>

                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeChip,
                      { borderColor: theme.cardBorder },
                      splitMode === 'size' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                    ]}
                    onPress={() => setSplitMode('size')}
                  >
                    <Text style={[styles.modeChipText, { color: splitMode === 'size' ? theme.primary : theme.textPrimary }]}>
                      Parça Boyutuna Göre
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeChip,
                      { borderColor: theme.cardBorder },
                      splitMode === 'count' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                    ]}
                    onPress={() => setSplitMode('count')}
                  >
                    <Text style={[styles.modeChipText, { color: splitMode === 'count' ? theme.primary : theme.textPrimary }]}>
                      Eşit Parça Sayısına Göre
                    </Text>
                  </TouchableOpacity>
                </View>

                {splitMode === 'size' ? (
                  <View style={styles.rowTwo}>
                    <View style={{ flex: 1, marginRight: spacing.xs }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Parça Boyutu:</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                        keyboardType="numeric"
                        value={String(chunkSizeVal)}
                        onChangeText={(val) => setChunkSizeVal(Math.max(1, Number(val) || 100))}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.xs }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Birim:</Text>
                      <View style={styles.unitRow}>
                        {(['B', 'KB', 'MB'] as SplitUnit[]).map((u) => (
                          <TouchableOpacity
                            key={u}
                            style={[
                              styles.unitChip,
                              { borderColor: theme.cardBorder },
                              chunkUnit === u && { backgroundColor: theme.primary, borderColor: theme.primary },
                            ]}
                            onPress={() => setChunkUnit(u)}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: chunkUnit === u ? '#FFFFFF' : theme.textPrimary }}>
                              {u}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Bölünecek Parça Sayısı (N):</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                      keyboardType="numeric"
                      value={String(targetPartsCount)}
                      onChangeText={(val) => setTargetPartsCount(Math.max(2, Math.min(100, Number(val) || 2)))}
                    />
                  </View>
                )}

                {isSplitting ? (
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 16 }} />
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: spacing.md }]}
                    onPress={handleExecuteSplit}
                  >
                    <Ionicons name="cut-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Dosyayı Böl</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Split Results Table */}
              {splitResult && (
                <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder, marginBottom: 32 }]}>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                    Oluşturulan Parçalar ({splitResult.totalParts} Parça)
                  </Text>
                  <Text style={[styles.checksumMeta, { color: theme.textMuted }]}>
                    Orijinal SHA-256: {splitResult.originalChecksumSha256.substring(0, 16)}...
                  </Text>

                  {splitResult.parts.map((part) => (
                    <View key={part.partIndex} style={[styles.partRow, { borderColor: theme.cardBorder }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.partName, { color: theme.textPrimary }]}>{part.name}</Text>
                        <Text style={[styles.partMeta, { color: theme.textSecondary }]}>
                          Boyut: {formatFileSize(part.size)} • Offsets: [{part.startByte} - {part.endByte}]
                        </Text>
                        <Text style={[styles.partHash, { color: theme.textMuted }]}>
                          SHA-256: {part.checksumSha256.substring(0, 20)}...
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.downloadPartBtn, { backgroundColor: theme.primaryContainer }]}
                        onPress={() => handleSharePart(part)}
                      >
                        <Ionicons name="download-outline" size={18} color={theme.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* TAB 2: MERGER */}
      {activeTab === 'merge' && (
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder, marginBottom: 32 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Parçaları Seçin & Birleştirin</Text>
          <Text style={[styles.uploadSub, { color: theme.textSecondary, marginBottom: 12 }]}>
            Yüklediğiniz .part1, .part2 veya sırasız parçaları seçin. Sistem bunları otomatik sıralar.
          </Text>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.primary, marginBottom: 12 }]}
            onPress={handlePickPartsToMerge}
          >
            <Ionicons name="folder-open-outline" size={20} color={theme.primary} />
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Parça Dosyaları Ekle (.part1, .part2...)</Text>
          </TouchableOpacity>

          {mergePartsList.length > 0 && (
            <View>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Yüklenen Parçalar ({mergePartsList.length}):</Text>
              {mergePartsList.map((p, idx) => (
                <View key={idx} style={[styles.partRow, { borderColor: theme.cardBorder }]}>
                  <Ionicons name="document" size={20} color={theme.primary} />
                  <Text style={[styles.partName, { color: theme.textPrimary, flex: 1, marginLeft: 8 }]}>
                    {p.name} ({formatFileSize(p.bytes.length)})
                  </Text>
                  <TouchableOpacity onPress={() => setMergePartsList((list) => list.filter((_, i) => i !== idx))}>
                    <Ionicons name="trash-outline" size={18} color={theme.error} />
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>Çıktı Dosya Adı:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={outputMergedName}
                onChangeText={setOutputMergedName}
                placeholder="birlesmis_dosya.ext"
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Doğrulama SHA-256 Hash'i (İsteğe Bağlı):</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={expectedChecksum}
                onChangeText={setExpectedChecksum}
                placeholder="Örn: a1b2c3d4..."
              />

              {isMerging ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 16 }} />
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.success, marginTop: spacing.md }]}
                  onPress={handleExecuteMerge}
                >
                  <Ionicons name="layers-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Parçaları Birleştir</Text>
                </TouchableOpacity>
              )}

              {mergeResult && (
                <View style={[styles.resultBox, { backgroundColor: theme.successContainer, marginTop: 16 }]}>
                  <Ionicons name="checkmark-circle" size={32} color={theme.success} />
                  <Text style={[styles.resultTitle, { color: theme.textPrimary }]}>Dosya Başarıyla Birleştirildi!</Text>
                  <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>
                    {mergeResult.mergedFileName} ({formatFileSize(mergeResult.mergedFileSize)})
                  </Text>
                  {expectedChecksum ? (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: mergeResult.checksumMatch ? theme.success : theme.error, marginTop: 4 }}>
                      SHA-256 Doğrulaması: {mergeResult.checksumMatch ? 'EŞLEŞTİ OK' : 'HATA - Eşleşmedi!'}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: spacing.sm }]}
                    onPress={handleShareMerged}
                  >
                    <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Birleşmiş Dosyayı İndir</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
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
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
  },
  fileMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  smallChangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallChangeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rowTwo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unitRow: {
    flexDirection: 'row',
    height: 42,
  },
  unitChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 2,
  },
  checksumMeta: {
    fontSize: 11,
    marginBottom: 12,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  partName: {
    fontSize: 14,
    fontWeight: '600',
  },
  partMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  partHash: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  downloadPartBtn: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  resultBox: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  resultMeta: {
    fontSize: 13,
    marginTop: 4,
  },
});
