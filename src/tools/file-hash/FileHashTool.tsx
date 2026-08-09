import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { computeAllHashes, verifyChecksum, HashAlgorithm } from './hashUtils';

type InputMode = 'text' | 'file';

interface SelectedFileInfo {
  name: string;
  size: number;
  uri: string;
}

export const FileHashTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [mode, setMode] = useState<InputMode>('text');
  const [inputText, setInputText] = useState('');
  const [fileInfo, setFileInfo] = useState<SelectedFileInfo | null>(null);
  const [expectedHash, setExpectedHash] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [hashes, setHashes] = useState<{ [key in HashAlgorithm]?: string }>({});

  // Recalculate hashes whenever text or file content changes
  useEffect(() => {
    let isMounted = true;

    async function calculate() {
      if (mode === 'text') {
        if (!inputText) {
          setHashes({});
          return;
        }
        setIsCalculating(true);
        try {
          const res = await computeAllHashes(inputText);
          if (isMounted) setHashes(res);
        } catch {
          if (isMounted) setHashes({});
        } finally {
          if (isMounted) setIsCalculating(false);
        }
      }
    }

    calculate();

    return () => {
      isMounted = false;
    };
  }, [inputText, mode]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const info: SelectedFileInfo = {
          name: asset.name,
          size: asset.size ?? 0,
          uri: asset.uri,
        };
        setFileInfo(info);
        setIsCalculating(true);

        try {
          let content = '';
          if (Platform.OS === 'web') {
            const response = await fetch(asset.uri);
            content = await response.text();
          } else {
            content = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          }

          const res = await computeAllHashes(content);
          setHashes(res);
        } catch (readErr) {
          showToast('Dosya okunamadı.');
        } finally {
          setIsCalculating(false);
        }
      }
    } catch (error) {
      showToast('Dosya seçimi iptal edildi.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleCopy = async (hashVal: string, name: string) => {
    await Clipboard.setStringAsync(hashVal);
    showToast(`${name} kopyalandı!`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if expected hash matches any calculated hash
  const matchResult = React.useMemo(() => {
    if (!expectedHash.trim()) return null;

    const trimmedExp = expectedHash.trim().toLowerCase();
    for (const [algo, val] of Object.entries(hashes)) {
      if (val && val.toLowerCase() === trimmedExp) {
        return { matched: true, algorithm: algo as HashAlgorithm };
      }
    }
    return { matched: false, algorithm: null };
  }, [expectedHash, hashes]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <View style={[styles.toast, { backgroundColor: theme.primary, borderRadius: borderRadius.sm }]}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
          <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: spacing.xs }]}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Mode Selector Tabs */}
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: theme.surfaceVariant,
            borderRadius: borderRadius.md,
            padding: spacing.xxs,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            setMode('text');
            setHashes({});
          }}
          style={[
            styles.tabButton,
            {
              backgroundColor: mode === 'text' ? theme.surface : 'transparent',
              borderRadius: borderRadius.sm,
            },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={mode === 'text' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              { color: mode === 'text' ? theme.primary : theme.textSecondary, marginLeft: spacing.xs },
            ]}
          >
            Metin Özeti (Hash)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode('file');
            setHashes({});
          }}
          style={[
            styles.tabButton,
            {
              backgroundColor: mode === 'file' ? theme.surface : 'transparent',
              borderRadius: borderRadius.sm,
            },
          ]}
        >
          <Ionicons
            name="folder-open-outline"
            size={16}
            color={mode === 'file' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              { color: mode === 'file' ? theme.primary : theme.textSecondary, marginLeft: spacing.xs },
            ]}
          >
            Dosya Özeti (Checksum)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode 1: Text Input */}
      {mode === 'text' && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.xs }]}>
            Metin Girin:
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.inputBorder,
                borderRadius: borderRadius.md,
                color: theme.textPrimary,
                padding: spacing.md,
              },
            ]}
            placeholder="Hash özeti çıkarılacak metni girin..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={inputText}
            onChangeText={setInputText}
          />
        </View>
      )}

      {/* Mode 2: File Picker */}
      {mode === 'file' && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.xs }]}>
            Dosya Seçin:
          </Text>
          <TouchableOpacity
            onPress={handlePickFile}
            style={[
              styles.fileDropZone,
              {
                backgroundColor: theme.surface,
                borderColor: theme.inputBorder,
                borderRadius: borderRadius.md,
                padding: spacing.lg,
              },
            ]}
          >
            <Ionicons name="cloud-upload-outline" size={32} color={theme.primary} />
            <Text style={[typography.labelLarge, { color: theme.textPrimary, marginTop: spacing.xs }]}>
              {fileInfo ? fileInfo.name : 'Dosya Seçmek İçin Dokunun'}
            </Text>
            {fileInfo && (
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: spacing.xxs }]}>
                Boyut: {formatBytes(fileInfo.size)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Expected Checksum Verification Input */}
      <View style={{ marginTop: spacing.lg }}>
        <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.xs }]}>
          Beklenen Hash / Checksum (Doğrulama):
        </Text>
        <TextInput
          style={[
            styles.hashCheckInput,
            {
              backgroundColor: theme.surface,
              borderColor: matchResult
                ? matchResult.matched
                  ? '#16A34A'
                  : '#DC2626'
                : theme.inputBorder,
              borderRadius: borderRadius.md,
              color: theme.textPrimary,
              padding: spacing.md,
            },
          ]}
          placeholder="Karşılaştırılacak hash değerini buraya yapıştırın..."
          placeholderTextColor={theme.textMuted}
          value={expectedHash}
          onChangeText={setExpectedHash}
          autoCapitalize="none"
        />

        {/* Verification Status Badge */}
        {matchResult && (
          <View
            style={[
              styles.matchBadge,
              {
                backgroundColor: matchResult.matched ? '#DCFCE7' : '#FEE2E2',
                borderColor: matchResult.matched ? '#16A34A' : '#DC2626',
                borderRadius: borderRadius.sm,
                padding: spacing.sm,
                marginTop: spacing.xs,
              },
            ]}
          >
            <Ionicons
              name={matchResult.matched ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={matchResult.matched ? '#15803D' : '#B91C1C'}
            />
            <Text
              style={[
                typography.labelMedium,
                {
                  color: matchResult.matched ? '#15803D' : '#B91C1C',
                  marginLeft: spacing.xs,
                },
              ]}
            >
              {matchResult.matched
                ? `EŞLEŞTİ! (${matchResult.algorithm} özeti tam olarak uyuşuyor)`
                : 'EŞLEŞMEDİ! Hash değerleri uyuşmuyor.'}
            </Text>
          </View>
        )}
      </View>

      {/* Calculated Hashes Cards */}
      <View style={{ marginTop: spacing.lg }}>
        <View style={styles.resultsHeader}>
          <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
            Hesaplanan Özetler (Hashes)
          </Text>
          {isCalculating && <ActivityIndicator size="small" color={theme.primary} />}
        </View>

        {(['SHA-256', 'SHA-1', 'MD5', 'SHA-512'] as HashAlgorithm[]).map((algo) => {
          const val = hashes[algo];
          return (
            <View
              key={algo}
              style={[
                styles.hashCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginTop: spacing.xs,
                },
              ]}
            >
              <View style={styles.hashCardHeader}>
                <Text style={[typography.labelLarge, { color: theme.primary }]}>
                  {algo}
                </Text>
                {val ? (
                  <TouchableOpacity
                    onPress={() => handleCopy(val, algo)}
                    style={[
                      styles.copyBtn,
                      { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.xs },
                    ]}
                  >
                    <Ionicons name="copy-outline" size={14} color={theme.textPrimary} />
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: theme.textPrimary, marginLeft: spacing.xxs },
                      ]}
                    >
                      Kopyala
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text
                style={[
                  styles.hashText,
                  {
                    color: val ? theme.textPrimary : theme.textMuted,
                    marginTop: spacing.xs,
                  },
                ]}
                selectable
              >
                {val || (isCalculating ? 'Hesaplanıyor...' : 'Girdi bekleniyor')}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  toast: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabContainer: {
    flexDirection: 'row',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  textInput: {
    borderWidth: 1,
    minHeight: 120,
    fontSize: 15,
  },
  fileDropZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashCheckInput: {
    borderWidth: 1.5,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hashCard: {
    borderWidth: 1,
  },
  hashCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hashText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
});
