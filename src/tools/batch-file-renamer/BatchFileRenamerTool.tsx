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
import { BatchRenameResult, FileItem, RenameConfig, RenameMode } from './types';
import {
  computeNewName,
  downloadFileOrScript,
  executeBatchRename,
} from './batchRenamerService';

export const BatchFileRenamerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Files State
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<BatchRenameResult | null>(null);

  // Renaming Rule Config State
  const [mode, setMode] = useState<RenameMode>('pattern');
  const [prefix, setPrefix] = useState<string>('');
  const [suffix, setSuffix] = useState<string>('');
  const [baseName, setBaseName] = useState<string>('Belge');
  const [useNumbering, setUseNumbering] = useState<boolean>(true);
  const [startNumber, setStartNumber] = useState<number>(1);
  const [numberPadding, setNumberPadding] = useState<number>(2);
  const [numberPosition, setNumberPosition] = useState<'prefix' | 'suffix' | 'replace'>('suffix');
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [casing, setCasing] = useState<'preserve' | 'lowercase' | 'uppercase' | 'titlecase'>('preserve');
  const [extensionCasing, setExtensionCasing] = useState<'preserve' | 'lowercase' | 'uppercase'>('lowercase');

  const currentConfig: RenameConfig = {
    mode,
    prefix,
    suffix,
    baseName,
    useNumbering,
    startNumber,
    numberPadding,
    numberPosition,
    findText,
    replaceText,
    casing,
    extensionCasing,
  };

  // Select Multiple Files
  const handlePickFiles = async () => {
    try {
      const pickRes = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (pickRes.canceled || !pickRes.assets || pickRes.assets.length === 0) {
        return;
      }

      const newItems: FileItem[] = pickRes.assets.map((asset, idx) => ({
        id: `file_${Date.now()}_${idx}`,
        originalName: asset.name || `file_${idx + 1}`,
        newName: asset.name || `file_${idx + 1}`,
        size: asset.size || 0,
        uri: asset.uri,
        mimeType: asset.mimeType,
        status: 'pending',
      }));

      setFiles((prev) => [...prev, ...newItems]);
      setResult(null);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Dosyalar seçilemedi.');
    }
  };

  // Clear File List
  const handleClearFiles = () => {
    setFiles([]);
    setResult(null);
  };

  // Execute Batch Rename
  const handleExecuteRename = async () => {
    if (files.length === 0) {
      Alert.alert('Uyarı', 'Lütfen en az bir dosya ekleyin.');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await executeBatchRename(files, currentConfig);
      setResult(res);
      Alert.alert(
        'Tamamlandı',
        `${res.successCount} dosya için toplu yeniden adlandırma tamamlandı.`
      );
    } catch (err: any) {
      Alert.alert('İşlem Hatası', err?.message || 'Yeniden adlandırma sırasında hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Ionicons name="document-text-outline" size={32} color={theme.primary} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Toplu Dosya Yeniden Adlandırıcı</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Birden çok dosyayı önek, sonek, sıralı numaralandırma veya metin değiştirme ile topluca adlandırın.
          </Text>
        </View>
      </View>

      {/* File Loader / File List Bar */}
      <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Seçilen Dosyalar ({files.length})
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: theme.primary, marginRight: 8 }]}
              onPress={handlePickFiles}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.smallBtnText}>Dosya Ekle</Text>
            </TouchableOpacity>
            {files.length > 0 && (
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: theme.errorContainer }]}
                onPress={handleClearFiles}
              >
                <Text style={{ color: theme.error, fontSize: 12, fontWeight: '600' }}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {files.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="folder-open-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Toplu Dosya Seçin</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Birden fazla belge veya fotoğraf seçerek isimlerini tek tıkla düzenleyin.
            </Text>
          </View>
        ) : null}
      </View>

      {files.length > 0 && (
        <View>
          {/* Renaming Mode Tabs */}
          <View style={[styles.modeBar, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'pattern' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setMode('pattern')}
            >
              <Text style={[styles.modeTabText, { color: mode === 'pattern' ? '#FFFFFF' : theme.textPrimary }]}>
                Desen / Numara
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'find_replace' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setMode('find_replace')}
            >
              <Text style={[styles.modeTabText, { color: mode === 'find_replace' ? '#FFFFFF' : theme.textPrimary }]}>
                Bul & Değiştir
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'casing' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setMode('casing')}
            >
              <Text style={[styles.modeTabText, { color: mode === 'casing' ? '#FFFFFF' : theme.textPrimary }]}>
                Harf Durumu
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode 1: Pattern / Numbering Rules */}
          {mode === 'pattern' && (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Şablon & Numaralandırma Kuralları</Text>

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Temel Dosya İsmi (Boş bırakılırsa orijinal isim korunur):</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={baseName}
                onChangeText={setBaseName}
                placeholder="Örn: Belge, Foto, Rapor"
                placeholderTextColor={theme.textMuted}
              />

              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Önek (Prefix):</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    value={prefix}
                    onChangeText={setPrefix}
                    placeholder="Örn: 2026_"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Sonek (Suffix):</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    value={suffix}
                    onChangeText={setSuffix}
                    placeholder="Örn: _v1"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              {/* Numbering Switch */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setUseNumbering(!useNumbering)}
              >
                <Ionicons
                  name={useNumbering ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={theme.primary}
                />
                <Text style={[styles.toggleText, { color: theme.textPrimary }]}>
                  Sıralı Numaralandırma Ekle (1, 2, 3...)
                </Text>
              </TouchableOpacity>

              {useNumbering && (
                <View style={styles.rowTwo}>
                  <View style={{ flex: 1, marginRight: spacing.xs }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Başlangıç Sayısı:</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                      keyboardType="numeric"
                      value={String(startNumber)}
                      onChangeText={(val) => setStartNumber(Number(val) || 1)}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.xs }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Basamak Hanesi (Padding):</Text>
                    <View style={styles.padSelectorRow}>
                      {[1, 2, 3, 4].map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.padChip,
                            { borderColor: theme.cardBorder },
                            numberPadding === p && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                          ]}
                          onPress={() => setNumberPadding(p)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: numberPadding === p ? theme.primary : theme.textPrimary }}>
                            {p === 1 ? '1' : p === 2 ? '01' : p === 3 ? '001' : '0001'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Mode 2: Find & Replace */}
          {mode === 'find_replace' && (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Metin Arama & Değiştirme</Text>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Aranacak Metin:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={findText}
                onChangeText={setFindText}
                placeholder="Örn: IMG_, DRAFT, taslak"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Yeni Yerine Yazılacak Metin:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={replaceText}
                onChangeText={setReplaceText}
                placeholder="Örn: FOTO_, FINAL"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          )}

          {/* Mode 3: Casing Rules */}
          {mode === 'casing' && (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Harf Durumu Değiştirme</Text>
              <View style={styles.casingRow}>
                {[
                  { id: 'preserve', label: 'Orijinal' },
                  { id: 'lowercase', label: 'küçük harf' },
                  { id: 'uppercase', label: 'BÜYÜK HARF' },
                  { id: 'titlecase', label: 'Baş Harf Büyük' },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.casingChip,
                      { borderColor: theme.cardBorder },
                      casing === c.id && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                    ]}
                    onPress={() => setCasing(c.id as any)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: casing === c.id ? theme.primary : theme.textPrimary }}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Extension Casing */}
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Uzantı Biçimlendirme:</Text>
            <View style={styles.casingRow}>
              <TouchableOpacity
                style={[
                  styles.casingChip,
                  { borderColor: theme.cardBorder },
                  extensionCasing === 'lowercase' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => setExtensionCasing('lowercase')}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: extensionCasing === 'lowercase' ? theme.primary : theme.textPrimary }}>
                  Küçük (.pdf)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.casingChip,
                  { borderColor: theme.cardBorder },
                  extensionCasing === 'uppercase' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => setExtensionCasing('uppercase')}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: extensionCasing === 'uppercase' ? theme.primary : theme.textPrimary }}>
                  Büyük (.PDF)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.casingChip,
                  { borderColor: theme.cardBorder },
                  extensionCasing === 'preserve' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => setExtensionCasing('preserve')}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: extensionCasing === 'preserve' ? theme.primary : theme.textPrimary }}>
                  Aynen Koru
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live Preview List / Table */}
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>İsim Önizleme Tablosu</Text>

            {files.map((item, idx) => {
              const previewName = computeNewName(item.originalName, idx, currentConfig);
              return (
                <View key={item.id} style={[styles.previewRow, { borderColor: theme.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.origNameText, { color: theme.textSecondary }]} numberOfLines={1}>
                      Eski: {item.originalName} ({formatSize(item.size)})
                    </Text>
                    <Text style={[styles.newNameText, { color: theme.primary }]} numberOfLines={1}>
                      Yeni: {previewName}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Execute Button */}
          {isProcessing ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 20 }} />
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primary, marginBottom: 16 }]}
              onPress={handleExecuteRename}
            >
              <Ionicons name="checkmark-done-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Toplu Yeniden Adlandır</Text>
            </TouchableOpacity>
          )}

          {/* Batch Script Export Box */}
          {result && (
            <View style={[styles.scriptExportCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Yeniden Adlandırma Komut Dosyaları</Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary, marginBottom: 12 }]}>
                Masaüstü işletim sistemlerinde orijinal dosyaları doğrudan topluca adlandırmak için komut dosyasını indirebilirsiniz.
              </Text>
              <View style={styles.rowTwo}>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: theme.primary, flex: 1, marginRight: 4 }]}
                  onPress={() => downloadFileOrScript(result.scriptContentBat, 'rename_script.bat', 'application/x-bat')}
                >
                  <Ionicons name="logo-windows" size={16} color="#FFFFFF" />
                  <Text style={styles.smallBtnText}>Windows (.bat)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: theme.accent, flex: 1, marginLeft: 4 }]}
                  onPress={() => downloadFileOrScript(result.scriptContentSh, 'rename_script.sh', 'text/x-sh')}
                >
                  <Ionicons name="terminal-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.smallBtnText}>Mac/Linux (.sh)</Text>
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
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
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
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  modeBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabText: {
    fontSize: 13,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  toggleText: {
    fontSize: 14,
    marginLeft: 8,
  },
  padSelectorRow: {
    flexDirection: 'row',
  },
  padChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 2,
  },
  casingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  casingChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  previewRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  origNameText: {
    fontSize: 12,
  },
  newNameText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  scriptExportCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
});
