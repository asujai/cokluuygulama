import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { SrtCue, ShiftTargetMode } from './types';
import {
  parseSrt,
  serializeSrt,
  shiftCues,
  msToSrtTime,
  srtTimeToMs,
  SAMPLE_SRT_TEXT,
} from './srtParser';

export const SrtEditorTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Main State
  const [cues, setCues] = useState<SrtCue[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [rawImportText, setRawImportText] = useState('');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCue, setEditingCue] = useState<SrtCue | null>(null);
  const [editStartStr, setEditStartStr] = useState('');
  const [editEndStr, setEditEndStr] = useState('');
  const [editTextStr, setEditTextStr] = useState('');

  const [shiftModalVisible, setShiftModalVisible] = useState(false);
  const [shiftSecondsStr, setShiftSecondsStr] = useState('1.0');
  const [shiftMode, setShiftMode] = useState<ShiftTargetMode>('all');

  const [exportModalVisible, setExportModalVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Actions
  const handleLoadSample = () => {
    const parsed = parseSrt(SAMPLE_SRT_TEXT);
    setCues(parsed);
    showToast('Örnek altyazı yüklendi!');
  };

  const handlePickSrtFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const fileUri = res.assets[0].uri;
        let content = '';

        if (Platform.OS === 'web') {
          const resp = await fetch(fileUri);
          content = await resp.text();
        } else {
          content = await FileSystem.readAsStringAsync(fileUri);
        }

        const parsed = parseSrt(content);
        if (parsed.length === 0) {
          Alert.alert('Uyarı', 'Geçerli bir SRT altyazı bloğu bulunamadı.');
        } else {
          setCues(parsed);
          setImportModalVisible(false);
          showToast(`${parsed.length} altyazı karesi başarıyla yüklendi!`);
        }
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'SRT dosyası okunurken hata oluştu.');
    }
  };

  const handleImportRawText = () => {
    if (!rawImportText.trim()) {
      Alert.alert('Hata', 'Lütfen içe aktarılacak altyazı metnini girin.');
      return;
    }
    const parsed = parseSrt(rawImportText);
    if (parsed.length === 0) {
      Alert.alert('Hata', 'Metin içinde geçerli altyazı bloğu bulunamadı.');
      return;
    }
    setCues(parsed);
    setImportModalVisible(false);
    setRawImportText('');
    showToast(`${parsed.length} altyazı karesi yüklendi!`);
  };

  const handleOpenEditModal = (cue: SrtCue) => {
    setEditingCue(cue);
    setEditStartStr(msToSrtTime(cue.startMs));
    setEditEndStr(msToSrtTime(cue.endMs));
    setEditTextStr(cue.text);
    setEditModalVisible(true);
  };

  const handleSaveCue = () => {
    if (!editingCue) return;

    const startMs = srtTimeToMs(editStartStr);
    const endMs = srtTimeToMs(editEndStr);

    if (startMs >= endMs) {
      Alert.alert('Hata', 'Başlangıç süresi bitiş süresinden küçük olmalıdır.');
      return;
    }

    const updated = cues.map((c) => {
      if (c.id === editingCue.id) {
        return {
          ...c,
          startMs,
          endMs,
          text: editTextStr,
        };
      }
      return c;
    });

    // Re-sort and index
    updated.sort((a, b) => a.startMs - b.startMs);
    const reindexed = updated.map((c, i) => ({ ...c, index: i + 1 }));

    setCues(reindexed);
    setEditModalVisible(false);
    setEditingCue(null);
    showToast('Altyazı güncellendi!');
  };

  const handleDeleteCue = (id: string) => {
    const filtered = cues.filter((c) => c.id !== id);
    const reindexed = filtered.map((c, i) => ({ ...c, index: i + 1 }));
    setCues(reindexed);
    showToast('Altyazı karesi silindi.');
  };

  const handleAddCue = () => {
    let lastEndMs = 0;
    if (cues.length > 0) {
      lastEndMs = cues[cues.length - 1].endMs + 500;
    }

    const newCue: SrtCue = {
      id: `cue-${Date.now()}`,
      index: cues.length + 1,
      startMs: lastEndMs,
      endMs: lastEndMs + 2500,
      text: 'Yeni Altyazı Metni',
    };

    const updated = [...cues, newCue];
    updated.sort((a, b) => a.startMs - b.startMs);
    const reindexed = updated.map((c, i) => ({ ...c, index: i + 1 }));

    setCues(reindexed);
    handleOpenEditModal(newCue);
  };

  const handleApplyShift = () => {
    const shiftSec = parseFloat(shiftSecondsStr);
    if (isNaN(shiftSec) || shiftSec === 0) {
      Alert.alert('Hata', 'Geçerli bir zaman kaydırma miktarı giriniz.');
      return;
    }

    const targetCueIndex = shiftMode === 'from_selected' && editingCue ? editingCue.index : 1;
    const shifted = shiftCues(cues, shiftSec, targetCueIndex);
    setCues(shifted);
    setShiftModalVisible(false);
    showToast(`Altyazılar ${shiftSec > 0 ? '+' : ''}${shiftSec} sn kaydırıldı!`);
  };

  const handleExportSave = async () => {
    const srtString = serializeSrt(cues);
    if (!srtString) {
      Alert.alert('Hata', 'Dışa aktarılacak altyazı yok.');
      return;
    }

    if (Platform.OS === 'web') {
      const blob = new Blob([srtString], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subtitles_edited.srt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('SRT dosyası indirildi!');
    } else {
      const fileUri = `${FileSystem.cacheDirectory}subtitles_edited.srt`;
      await FileSystem.writeAsStringAsync(fileUri, srtString);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        showToast('SRT dosyası kaydedildi!');
      }
    }
  };

  const handleCopyToClipboard = async () => {
    const srtString = serializeSrt(cues);
    await Clipboard.setStringAsync(srtString);
    showToast('SRT metni panoya kopyalandı!');
  };

  const filteredCues = cues.filter((c) =>
    c.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDurationSec =
    cues.length > 0 ? (cues[cues.length - 1].endMs - cues[0].startMs) / 1000 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {toastMessage && (
        <View style={[styles.toast, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
          <Text style={[typography.bodyMedium, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Header Card */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.xl,
            padding: spacing.md,
            marginBottom: spacing.md,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.full },
            ]}
          >
            <Ionicons name="subtitles-outline" size={32} color={theme.onPrimaryContainer} />
          </View>

          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
              SRT Altyazı Düzenleyici
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
              Toplam {cues.length} Kare | Süre: {totalDurationSec.toFixed(1)} sn
            </Text>
          </View>
        </View>

        {/* Primary Action Toolbar */}
        <View style={[styles.actionGrid, { marginTop: spacing.md }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
            onPress={() => setImportModalVisible(true)}
          >
            <Ionicons name="document-text-outline" size={18} color={theme.onPrimary} />
            <Text style={[typography.labelMedium, { color: theme.onPrimary, marginLeft: 4 }]}>
              SRT Yükle
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
            onPress={handleLoadSample}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.textPrimary} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: 4 }]}>
              Örnek SRT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
            onPress={() => setShiftModalVisible(true)}
            disabled={cues.length === 0}
          >
            <Ionicons name="time-outline" size={18} color={theme.textPrimary} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: 4 }]}>
              Zaman Kaydır
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
            onPress={handleAddCue}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.textPrimary} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: 4 }]}>
              Ekle
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Export Bar */}
      {cues.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.sm,
                  flex: 1,
                },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary, marginLeft: spacing.xs }]}
                placeholder="Altyazılarda ara..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.exportHeaderBtn,
                { backgroundColor: theme.primary, borderRadius: borderRadius.md, marginLeft: spacing.sm },
              ]}
              onPress={() => setExportModalVisible(true)}
            >
              <Ionicons name="download-outline" size={18} color={theme.onPrimary} />
              <Text style={[typography.labelMedium, { color: theme.onPrimary, marginLeft: 4 }]}>
                Aktar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cue List */}
      {cues.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.lg,
              padding: spacing.xl,
              alignItems: 'center',
            },
          ]}
        >
          <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
          <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Henüz altyazı yüklenmedi. SRT dosyası yükleyebilir veya örnek veri ile başlayabilirsiniz.
          </Text>
        </View>
      ) : (
        <View style={styles.cueList}>
          {filteredCues.map((cue) => {
            const durSec = ((cue.endMs - cue.startMs) / 1000).toFixed(1);
            return (
              <View
                key={cue.id}
                style={[
                  styles.cueCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <View style={styles.cueCardHeader}>
                  <View style={[styles.indexBadge, { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm }]}>
                    <Text style={[typography.labelSmall, { color: theme.onPrimaryContainer, fontWeight: 'bold' }]}>
                      #{cue.index}
                    </Text>
                  </View>

                  <Text style={[typography.bodySmall, { color: theme.textSecondary, flex: 1, marginLeft: spacing.sm }]}>
                    {msToSrtTime(cue.startMs)} → {msToSrtTime(cue.endMs)} ({durSec}s)
                  </Text>

                  <View style={styles.cueCardActions}>
                    <TouchableOpacity
                      onPress={() => handleOpenEditModal(cue)}
                      style={{ padding: spacing.xs }}
                    >
                      <Ionicons name="create-outline" size={20} color={theme.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteCue(cue.id)}
                      style={{ padding: spacing.xs, marginLeft: 4 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginTop: spacing.xs, lineHeight: 20 }]}>
                  {cue.text}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Import Modal */}
      <Modal visible={importModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderRadius: borderRadius.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>SRT İçe Aktar</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalPickBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
              onPress={handlePickSrtFile}
            >
              <Ionicons name="folder-open-outline" size={20} color={theme.onPrimary} />
              <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                Cihazdan .SRT Dosyası Seç
              </Text>
            </TouchableOpacity>

            <Text style={[typography.bodySmall, { color: theme.textSecondary, marginVertical: spacing.sm, textAlign: 'center' }]}>
              — veya ham SRT metnini aşağıya yapıştırın —
            </Text>

            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.surfaceVariant,
                  color: theme.textPrimary,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                },
              ]}
              multiline
              numberOfLines={8}
              placeholder="1\n00:00:01,000 --> 00:00:03,000\nMetin buraya..."
              placeholderTextColor={theme.textSecondary}
              value={rawImportText}
              onChangeText={setRawImportText}
            />

            <View style={[styles.modalActionRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
                onPress={() => setImportModalVisible(false)}
              >
                <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                onPress={handleImportRawText}
              >
                <Text style={[typography.labelMedium, { color: theme.onPrimary }]}>Ayrıştır ve Yükle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Cue Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderRadius: borderRadius.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>Altyazı Düzenle #{editingCue?.index}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.timeEditRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Başlangıç (HH:MM:SS,mmm)</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: theme.surfaceVariant,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.sm,
                      padding: spacing.sm,
                    },
                  ]}
                  value={editStartStr}
                  onChangeText={setEditStartStr}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Bitiş (HH:MM:SS,mmm)</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: theme.surfaceVariant,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.sm,
                      padding: spacing.sm,
                    },
                  ]}
                  value={editEndStr}
                  onChangeText={setEditEndStr}
                />
              </View>
            </View>

            <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: spacing.sm }]}>Altyazı Metni</Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.surfaceVariant,
                  color: theme.textPrimary,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginTop: 4,
                },
              ]}
              multiline
              numberOfLines={4}
              value={editTextStr}
              onChangeText={setEditTextStr}
            />

            <View style={[styles.modalActionRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                onPress={handleSaveCue}
              >
                <Text style={[typography.labelMedium, { color: theme.onPrimary }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shift Time Modal */}
      <Modal visible={shiftModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderRadius: borderRadius.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>Zaman Kaydırma (+/- saniye)</Text>
              <TouchableOpacity onPress={() => setShiftModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
              Tüm altyazı zaman damgalarını ileri (+) veya geri (-) kaydırın. Negatif zamanlar 00:00:00,000 noktasına clamping edilir.
            </Text>

            <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: spacing.sm }]}>Kaydırma Miktarı (saniye)</Text>
            <TextInput
              style={[
                styles.timeInput,
                {
                  backgroundColor: theme.surfaceVariant,
                  color: theme.textPrimary,
                  borderRadius: borderRadius.sm,
                  padding: spacing.sm,
                  marginTop: 4,
                },
              ]}
              keyboardType="numeric"
              placeholder="örneğin: 1.5 veya -2.0"
              placeholderTextColor={theme.textSecondary}
              value={shiftSecondsStr}
              onChangeText={setShiftSecondsStr}
            />

            {/* Quick Shift Chips */}
            <View style={[styles.presetRow, { marginTop: spacing.sm }]}>
              {['+0.5', '+1.0', '+2.5', '-0.5', '-1.0', '-2.5'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.presetChip, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  onPress={() => setShiftSecondsStr(p)}
                >
                  <Text style={[typography.labelSmall, { color: theme.textPrimary }]}>{p}s</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.modalActionRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
                onPress={() => setShiftModalVisible(false)}
              >
                <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                onPress={handleApplyShift}
              >
                <Text style={[typography.labelMedium, { color: theme.onPrimary }]}>Uygula</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export / Share Modal */}
      <Modal visible={exportModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderRadius: borderRadius.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>SRT Dışa Aktar</Text>
              <TouchableOpacity onPress={() => setExportModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.surfaceVariant,
                  color: theme.textPrimary,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  maxHeight: 250,
                },
              ]}
              multiline
              editable={false}
              value={serializeSrt(cues)}
            />

            <View style={[styles.modalActionRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
                onPress={handleCopyToClipboard}
              >
                <Ionicons name="copy-outline" size={18} color={theme.textPrimary} />
                <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: 4 }]}>Kopyala</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                onPress={handleExportSave}
              >
                <Ionicons name="download-outline" size={18} color={theme.onPrimary} />
                <Text style={[typography.labelMedium, { color: theme.onPrimary, marginLeft: 4 }]}>SRT İndir / Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
  },
  headerCard: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 40,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  exportHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 40,
  },
  emptyCard: {
    borderWidth: 1,
    marginTop: 20,
  },
  cueList: {},
  cueCard: {
    borderWidth: 1,
  },
  cueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indexBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cueCardActions: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  textArea: {
    textAlignVertical: 'top',
  },
  timeEditRow: {
    flexDirection: 'row',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
