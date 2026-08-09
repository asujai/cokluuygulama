import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { DiffOptions, DiffLine, DiffWord } from './types';
import { computeDiff, generateReportText, exportReportToFile } from './diffService';

const SAMPLE_TEXT_A = `React Native mobil uygulama geliştirme platformudur.
JavaScript ve TypeScript dili ile yazılır.
Aynı kod tabanı hem iOS hem de Android üzerinde çalışır.
Performans odaklı yerel bileşenler kullanır.`;

const SAMPLE_TEXT_B = `React Native harika bir mobil uygulama geliştirme platformudur.
JavaScript ve TypeScript dili kullanılarak yazılır.
Aynı kod tabanı hem iOS, hem Android hem de Web üzerinde çalışır.
Yüksek performanslı yerel bileşenler sunar.`;

export const TextCompareTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [textA, setTextA] = useState(SAMPLE_TEXT_A);
  const [textB, setTextB] = useState(SAMPLE_TEXT_B);

  const [options, setOptions] = useState<DiffOptions>({
    ignoreCase: false,
    ignoreWhitespace: true,
    ignoreEmptyLines: false,
    granularity: 'line',
    viewMode: 'inline',
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const diffResult = useMemo(() => {
    return computeDiff(textA, textB, options);
  }, [textA, textB, options]);

  const handlePickFile = async (target: 'A' | 'B') => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'text/*',
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        let content = '';
        if (Platform.OS === 'web') {
          const fetchRes = await fetch(asset.uri);
          content = await fetchRes.text();
        } else {
          content = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
        if (target === 'A') setTextA(content);
        else setTextB(content);
        showToast(`Metin ${target} dosyadan yüklendi.`);
      }
    } catch {
      showToast('Dosya okunamadı.');
    }
  };

  const handleSwap = () => {
    const temp = textA;
    setTextA(textB);
    setTextB(temp);
    showToast('Metin A ve Metin B yer değiştirildi.');
  };

  const handleCopyReport = async () => {
    const report = generateReportText(diffResult.lines, diffResult.summary, options);
    await Clipboard.setStringAsync(report);
    showToast('Fark raporu panoya kopyalandı.');
  };

  const handleExportReport = async () => {
    const report = generateReportText(diffResult.lines, diffResult.summary, options);
    await exportReportToFile(report);
    showToast('Fark raporu kaydedildi/paylaşıldı.');
  };

  const renderWordDiff = (words?: DiffWord[]) => {
    if (!words) return null;
    return (
      <Text style={styles.wordLineWrap}>
        {words.map((w, idx) => {
          let bg = 'transparent';
          let color = theme.textPrimary;
          let textDecorationLine: 'none' | 'line-through' = 'none';

          if (w.type === 'added') {
            bg = '#166534';
            color = '#DCFCE7';
          } else if (w.type === 'deleted') {
            bg = '#991B1B';
            color = '#FEE2E2';
            textDecorationLine = 'line-through';
          }

          return (
            <Text
              key={idx}
              style={{
                backgroundColor: bg,
                color,
                textDecorationLine,
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            >
              {w.value}
            </Text>
          );
        })}
      </Text>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Toast Notification */}
      {toastMsg && (
        <View style={[styles.toast, { backgroundColor: theme.surfaceElevated }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
          <Text style={[styles.toastText, { color: theme.textPrimary }]}>{toastMsg}</Text>
        </View>
      )}

      {/* Header Summary Panel */}
      <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.summaryTopRow}>
          <View style={styles.similarityBox}>
            <Text style={[styles.similarityVal, { color: theme.primary }]}>
              %{diffResult.summary.similarityRatio}
            </Text>
            <Text style={[styles.similarityLabel, { color: theme.textSecondary }]}>Benzerlik</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statChip, { backgroundColor: theme.successContainer }]}>
              <Text style={[styles.statNum, { color: theme.success }]}>
                +{diffResult.summary.addedLines}
              </Text>
              <Text style={[styles.statText, { color: theme.success }]}>Eklenen</Text>
            </View>

            <View style={[styles.statChip, { backgroundColor: theme.errorContainer }]}>
              <Text style={[styles.statNum, { color: theme.error }]}>
                -{diffResult.summary.deletedLines}
              </Text>
              <Text style={[styles.statText, { color: theme.error }]}>Silinen</Text>
            </View>

            <View style={[styles.statChip, { backgroundColor: theme.warningContainer }]}>
              <Text style={[styles.statNum, { color: theme.warning }]}>
                ~{diffResult.summary.modifiedLines}
              </Text>
              <Text style={[styles.statText, { color: theme.warning }]}>Değişen</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Options Toolbar */}
      <View style={[styles.toolbarCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
          <TouchableOpacity
            style={[
              styles.optionChip,
              options.viewMode === 'inline' && { backgroundColor: theme.primaryContainer },
            ]}
            onPress={() =>
              setOptions((prev) => ({
                ...prev,
                viewMode: prev.viewMode === 'inline' ? 'sideBySide' : 'inline',
              }))
            }
          >
            <Ionicons
              name={options.viewMode === 'inline' ? 'list-outline' : 'grid-outline'}
              size={16}
              color={options.viewMode === 'inline' ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                styles.optionText,
                { color: options.viewMode === 'inline' ? theme.primary : theme.textSecondary },
              ]}
            >
              {options.viewMode === 'inline' ? 'Tek Satır Görünüm' : 'Yan Yana Görünüm'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionChip,
              options.ignoreCase && { backgroundColor: theme.primaryContainer },
            ]}
            onPress={() => setOptions((prev) => ({ ...prev, ignoreCase: !prev.ignoreCase }))}
          >
            <Text
              style={[
                styles.optionText,
                { color: options.ignoreCase ? theme.primary : theme.textSecondary },
              ]}
            >
              Aa Harf Duyarsız
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionChip,
              options.ignoreWhitespace && { backgroundColor: theme.primaryContainer },
            ]}
            onPress={() =>
              setOptions((prev) => ({ ...prev, ignoreWhitespace: !prev.ignoreWhitespace }))
            }
          >
            <Text
              style={[
                styles.optionText,
                { color: options.ignoreWhitespace ? theme.primary : theme.textSecondary },
              ]}
            >
              Boşlukları Yoksay
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Text Input Area (Editors) */}
      <View style={styles.editorsRow}>
        {/* Text A Editor */}
        <View style={[styles.editorBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.editorHeader}>
            <Text style={[styles.editorTitle, { color: theme.textPrimary }]}>Metin A (Orijinal)</Text>
            <TouchableOpacity onPress={() => handlePickFile('A')}>
              <Ionicons name="document-attach-outline" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[
              styles.editorInput,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                color: theme.textPrimary,
              },
            ]}
            multiline
            value={textA}
            onChangeText={setTextA}
            placeholder="Orijinal metni girin..."
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Swap Button */}
        <TouchableOpacity style={styles.swapBtn} onPress={handleSwap}>
          <Ionicons name="swap-horizontal" size={20} color={theme.primary} />
        </TouchableOpacity>

        {/* Text B Editor */}
        <View style={[styles.editorBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.editorHeader}>
            <Text style={[styles.editorTitle, { color: theme.textPrimary }]}>Metin B (Değiştirilmiş)</Text>
            <TouchableOpacity onPress={() => handlePickFile('B')}>
              <Ionicons name="document-attach-outline" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[
              styles.editorInput,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                color: theme.textPrimary,
              },
            ]}
            multiline
            value={textB}
            onChangeText={setTextB}
            placeholder="Karşılaştırılacak metni girin..."
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </View>

      {/* Actions Toolbar */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.primary }]}
          onPress={handleCopyReport}
        >
          <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Raporu Kopyala</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.accent }]}
          onPress={handleExportReport}
        >
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Raporu İndir/Paylaş</Text>
        </TouchableOpacity>
      </View>

      {/* Diff Result List */}
      <View style={[styles.diffCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.diffTitle, { color: theme.textPrimary }]}>Fark İncelemesi</Text>

        <View style={styles.diffContainer}>
          {diffResult.lines.map((line, idx) => {
            let rowBg = 'transparent';
            let linePrefix = ' ';
            let textColor = theme.textPrimary;

            if (line.type === 'added') {
              rowBg = 'rgba(34, 197, 94, 0.12)';
              linePrefix = '+';
              textColor = theme.success;
            } else if (line.type === 'deleted') {
              rowBg = 'rgba(239, 68, 68, 0.12)';
              linePrefix = '-';
              textColor = theme.error;
            } else if (line.type === 'modified') {
              rowBg = 'rgba(245, 158, 11, 0.12)';
              linePrefix = '~';
              textColor = theme.warning;
            }

            return (
              <View key={idx} style={[styles.diffRow, { backgroundColor: rowBg }]}>
                <View style={styles.lineMeta}>
                  <Text style={[styles.lineNumText, { color: theme.textMuted }]}>
                    {line.lineA ? `A:${line.lineA}` : '   '}
                  </Text>
                  <Text style={[styles.lineNumText, { color: theme.textMuted }]}>
                    {line.lineB ? `B:${line.lineB}` : '   '}
                  </Text>
                  <Text style={[styles.prefixText, { color: textColor }]}>{linePrefix}</Text>
                </View>

                <View style={styles.lineContent}>
                  {line.type === 'modified' ? (
                    renderWordDiff(line.words)
                  ) : (
                    <Text style={[styles.lineText, { color: textColor }]}>
                      {line.text}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarityBox: {
    alignItems: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  similarityVal: {
    fontSize: 28,
    fontWeight: '800',
  },
  similarityLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statsGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 12,
  },
  statChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '700',
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  toolbarCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  toolbarScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editorsRow: {
    gap: 12,
    marginBottom: 12,
  },
  editorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editorTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  editorInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  swapBtn: {
    alignSelf: 'center',
    padding: 8,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  diffCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  diffTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  diffContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  lineNumText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  prefixText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    width: 12,
  },
  lineContent: {
    flex: 1,
  },
  lineText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  wordLineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
