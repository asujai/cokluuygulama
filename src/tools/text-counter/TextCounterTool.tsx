import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import {
  toTurkishUpperCase,
  toTurkishLowerCase,
  toTurkishTitleCase,
  cleanWhitespace,
  removeDuplicateLines,
  sortLinesTurkish,
  reverseText,
  reverseLines,
  linesToCsv,
  csvToLines,
} from './textProcessing';

export const TextCounterTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const [text, setText] = useState('');
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const rawText = text;
    const charCount = rawText.length;
    const charCountWithoutSpaces = rawText.replace(/\s/g, '').length;

    const trimmed = rawText.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;

    const lines = rawText.length > 0 ? rawText.split('\n') : [];
    const lineCount = lines.length;

    const sentences = trimmed
      ? trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0)
      : [];
    const sentenceCount = sentences.length;

    // Average reading speed: 200 words per minute
    const readingTimeMinutes = Math.ceil(wordCount / 200);

    return {
      charCount,
      charCountWithoutSpaces,
      wordCount,
      lineCount,
      sentenceCount,
      readingTimeMinutes,
    };
  }, [text]);

  const showCopyToast = (msg = 'Kopyalandı!') => {
    setCopiedMessage(msg);
    setTimeout(() => {
      setCopiedMessage(null);
    }, 2000);
  };

  const handleCopy = async () => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showCopyToast('Metin kopyalandı');
  };

  const handleClear = () => {
    setText('');
  };

  // Processing handlers
  const handleUpperCase = () => setText(toTurkishUpperCase(text));
  const handleLowerCase = () => setText(toTurkishLowerCase(text));
  const handleTitleCase = () => setText(toTurkishTitleCase(text));
  const handleCleanSpaces = () => setText(cleanWhitespace(text));
  const handleRemoveDuplicates = () => setText(removeDuplicateLines(text));
  const handleSortAsc = () => setText(sortLinesTurkish(text, true));
  const handleSortDesc = () => setText(sortLinesTurkish(text, false));
  const handleReverseText = () => setText(reverseText(text));
  const handleReverseLines = () => setText(reverseLines(text));
  const handleLinesToCsv = () => setText(linesToCsv(text));
  const handleCsvToLines = () => setText(csvToLines(text));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Toast Feedback */}
      {copiedMessage && (
        <View
          style={[
            styles.toast,
            { backgroundColor: theme.primary, borderRadius: borderRadius.sm },
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
          <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: spacing.xs }]}>
            {copiedMessage}
          </Text>
        </View>
      )}

      {/* Stat Cards Grid */}
      <View style={styles.statsGrid}>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
            Karakter
          </Text>
          <Text style={[typography.titleLarge, { color: theme.primary, marginTop: spacing.xs }]}>
            {stats.charCount.toLocaleString('tr-TR')}
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
            Kelime
          </Text>
          <Text style={[typography.titleLarge, { color: theme.accent, marginTop: spacing.xs }]}>
            {stats.wordCount.toLocaleString('tr-TR')}
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
            Boşluksuz
          </Text>
          <Text style={[typography.titleLarge, { color: theme.textPrimary, marginTop: spacing.xs }]}>
            {stats.charCountWithoutSpaces.toLocaleString('tr-TR')}
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
            Satır
          </Text>
          <Text style={[typography.titleLarge, { color: theme.textPrimary, marginTop: spacing.xs }]}>
            {stats.lineCount.toLocaleString('tr-TR')}
          </Text>
        </View>
      </View>

      {/* Extra stats banner */}
      <View
        style={[
          styles.extraStatsBanner,
          {
            backgroundColor: theme.surfaceVariant,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginTop: spacing.md,
          },
        ]}
      >
        <View style={styles.extraStatItem}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.textSecondary} />
          <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginLeft: spacing.xs }]}>
            Cümle:{' '}
            <Text style={{ fontWeight: '700', color: theme.textPrimary }}>
              {stats.sentenceCount}
            </Text>
          </Text>
        </View>
        <View style={styles.extraStatItem}>
          <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
          <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginLeft: spacing.xs }]}>
            Okuma Süresi:~
            <Text style={{ fontWeight: '700', color: theme.textPrimary }}>
              {stats.readingTimeMinutes} dk
            </Text>
          </Text>
        </View>
      </View>

      {/* Text Input Area */}
      <View style={{ marginTop: spacing.lg }}>
        <View style={styles.inputHeader}>
          <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
            Metin Alanı
          </Text>
          <View style={styles.headerActions}>
            {text.length > 0 && (
              <>
                <TouchableOpacity
                  onPress={handleCopy}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[
                    styles.headerBtn,
                    { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.xs, marginRight: spacing.xs },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Metni kopyala"
                >
                  <Ionicons name="copy-outline" size={14} color={theme.onPrimaryContainer} />
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: theme.onPrimaryContainer, marginLeft: spacing.xxs },
                    ]}
                  >
                    Kopyala
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClear}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[
                    styles.headerBtn,
                    { backgroundColor: theme.errorContainer, borderRadius: borderRadius.xs },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Metni temizle"
                >
                  <Ionicons name="trash-outline" size={14} color={theme.onErrorContainer} />
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: theme.onErrorContainer, marginLeft: spacing.xxs },
                    ]}
                  >
                    Temizle
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

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
          placeholder="İncelemek veya dönüştürmek istediğiniz metni buraya yazın ya da yapıştırın..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          value={text}
          onChangeText={setText}
          accessibilityLabel="Metin giriş alanı"
        />
      </View>

      {/* Advanced Text Processing Tools */}
      <View style={{ marginTop: spacing.lg }}>
        <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
          Metin İşlemleri & Dönüştürücüler
        </Text>

        {/* Section 1: Harf Dönüşümleri */}
        <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: spacing.xs }]}>
          Harf & Biçim
        </Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            onPress={handleUpperCase}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="text-outline" size={16} color={theme.primary} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              BÜYÜK HARF
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLowerCase}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="text-outline" size={16} color={theme.primary} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              küçük harf
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTitleCase}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="document-text-outline" size={16} color={theme.primary} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Baş Harfler
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 2: Temizlik ve Satır İşlemleri */}
        <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs }]}>
          Temizlik & Satır İşlemleri
        </Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            onPress={handleCleanSpaces}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="cut-outline" size={16} color={theme.accent} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Boşluk Temizle
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRemoveDuplicates}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="filter-outline" size={16} color={theme.accent} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Tekrarları Sil
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSortAsc}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={theme.accent} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Sırala (A-Z)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSortDesc}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={theme.accent} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Sırala (Z-A)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 3: Ters Çevirme & Dönüştürme */}
        <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs }]}>
          Ters Çevirme & CSV
        </Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            onPress={handleReverseText}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="refresh-outline" size={16} color="#7C3AED" />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Metni Ters Çevir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReverseLines}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="reorder-two-outline" size={16} color="#7C3AED" />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Satırları Çevir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLinesToCsv}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="list-outline" size={16} color="#0891B2" />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Satır ➔ CSV
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCsvToLines}
            disabled={!text}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, opacity: text ? 1 : 0.5 },
            ]}
          >
            <Ionicons name="grid-outline" size={16} color="#0891B2" />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              CSV ➔ Satır
            </Text>
          </TouchableOpacity>
        </View>
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  extraStatsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  extraStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 28,
  },
  textInput: {
    borderWidth: 1,
    minHeight: 160,
    fontSize: 15,
    lineHeight: 22,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 42,
    flexGrow: 1,
    minWidth: '45%',
  },
});
