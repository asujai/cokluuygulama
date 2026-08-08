import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme';

export const TextCounterTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const [text, setText] = useState('');

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

  const handleClear = () => {
    setText('');
  };

  const handleUpperCase = () => {
    setText(text.toLocaleUpperCase('tr-TR'));
  };

  const handleLowerCase = () => {
    setText(text.toLocaleLowerCase('tr-TR'));
  };

  const handleCapitalize = () => {
    const capitalized = text
      .toLocaleLowerCase('tr-TR')
      .replace(/(?:^|\s)\S/g, (char) => char.toLocaleUpperCase('tr-TR'));
    setText(capitalized);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
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
          {text.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[
                styles.clearButton,
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
          )}
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
          placeholder="İncelemek istediğiniz metni buraya yazın veya yapıştırın..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          value={text}
          onChangeText={setText}
          accessibilityLabel="Metin giriş alanı"
        />
      </View>

      {/* Quick Text Actions */}
      <View style={[styles.actionsRow, { marginTop: spacing.md }]}>
        <TouchableOpacity
          onPress={handleUpperCase}
          disabled={!text}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.surfaceVariant,
              borderRadius: borderRadius.sm,
              opacity: text ? 1 : 0.5,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Tümünü büyük harfe çevir"
        >
          <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
            BÜYÜK
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLowerCase}
          disabled={!text}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.surfaceVariant,
              borderRadius: borderRadius.sm,
              opacity: text ? 1 : 0.5,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Tümünü küçük harfe çevir"
        >
          <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
            küçük
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCapitalize}
          disabled={!text}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.surfaceVariant,
              borderRadius: borderRadius.sm,
              opacity: text ? 1 : 0.5,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Baş harfleri büyüt"
        >
          <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
            Baş Harfler
          </Text>
        </TouchableOpacity>
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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 28,
  },
  textInput: {
    borderWidth: 1,
    minHeight: 180,
    fontSize: 15,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
