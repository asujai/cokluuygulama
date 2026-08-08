import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';

const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const NUMBER_CHARS = '0123456789';
const SYMBOL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

// Helper to get random integer in range [0, max - 1] using Crypto
function getRandomInt(max: number): number {
  if (max <= 1) return 0;
  const randomBytes = Crypto.getRandomValues(new Uint32Array(1));
  return randomBytes[0] % max;
}

// Fisher-Yates shuffle using cryptographically strong randomness
function cryptoShuffle(array: string[]): string[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export const PasswordGeneratorTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [length, setLength] = useState<number>(16);
  const [includeUppercase, setIncludeUppercase] = useState<boolean>(true);
  const [includeLowercase, setIncludeLowercase] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const generatePassword = useCallback(() => {
    // Ensure at least one character set is selected
    const activeSets: string[] = [];
    if (includeUppercase) activeSets.push(UPPERCASE_CHARS);
    if (includeLowercase) activeSets.push(LOWERCASE_CHARS);
    if (includeNumbers) activeSets.push(NUMBER_CHARS);
    if (includeSymbols) activeSets.push(SYMBOL_CHARS);

    if (activeSets.length === 0) {
      setPassword('');
      return;
    }

    const chars: string[] = [];

    // Guarantee at least one character from each active character set
    activeSets.forEach((set) => {
      const index = getRandomInt(set.length);
      chars.push(set[index]);
    });

    // Combined pool for the remaining characters
    const combinedPool = activeSets.join('');

    // Fill remaining length
    const remainingCount = Math.max(0, length - chars.length);
    for (let i = 0; i < remainingCount; i++) {
      const index = getRandomInt(combinedPool.length);
      chars.push(combinedPool[index]);
    }

    // Cryptographically shuffle to avoid predictable leading characters
    const shuffled = cryptoShuffle(chars);
    setPassword(shuffled.join(''));
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  // Generate initial password on mount or when settings change
  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const handleCopy = async () => {
    if (!password) return;
    try {
      await Clipboard.setStringAsync(password);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.warn('Failed to copy password:', error);
    }
  };

  const changeLength = (delta: number) => {
    setLength((prev) => Math.min(64, Math.max(8, prev + delta)));
  };

  // Password strength calculation
  const strengthInfo = useMemo(() => {
    if (!password) {
      return { score: 0, label: 'Seçim Yapılmadı', color: theme.textMuted };
    }

    let score = 0;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (password.length >= 24) score += 1;
    if (includeUppercase && includeLowercase) score += 1;
    if (includeNumbers) score += 1;
    if (includeSymbols) score += 1;

    if (score <= 2) {
      return { score: 1, label: 'Zayıf', color: theme.error };
    } else if (score <= 3) {
      return { score: 2, label: 'Orta', color: theme.warning };
    } else if (score <= 4) {
      return { score: 3, label: 'Güçlü', color: theme.accent };
    } else {
      return { score: 4, label: 'Çok Güçlü', color: theme.success };
    }
  }, [password, includeUppercase, includeLowercase, includeNumbers, includeSymbols, theme]);

  const atLeastOneOptionChecked =
    includeUppercase || includeLowercase || includeNumbers || includeSymbols;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Generated Password Display Card */}
      <View
        style={[
          styles.passwordCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
          },
        ]}
      >
        <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
          Üretilen Güvenli Şifre
        </Text>

        <View
          style={[
            styles.passwordDisplayBox,
            {
              backgroundColor: theme.inputBackground,
              borderRadius: borderRadius.md,
              marginTop: spacing.sm,
              padding: spacing.md,
            },
          ]}
        >
          <Text
            style={[
              typography.mono,
              {
                color: password ? theme.textPrimary : theme.textMuted,
                fontSize: password.length > 28 ? 15 : 18,
                fontWeight: '600',
                letterSpacing: 1.5,
              },
            ]}
            selectable
          >
            {password || 'Lütfen en az bir karakter türü seçin'}
          </Text>
        </View>

        {/* Strength Indicator */}
        {password.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.strengthHeader}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                Güvenlik Seviyesi:
              </Text>
              <Text style={[typography.labelSmall, { color: strengthInfo.color, fontWeight: '700' }]}>
                {strengthInfo.label}
              </Text>
            </View>
            <View style={styles.strengthBarContainer}>
              {[1, 2, 3, 4].map((step) => (
                <View
                  key={`strength-${step}`}
                  style={[
                    styles.strengthBarSegment,
                    {
                      backgroundColor:
                        step <= strengthInfo.score
                          ? strengthInfo.color
                          : theme.surfaceVariant,
                      borderRadius: borderRadius.xs,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons: Generate New and Copy */}
        <View style={[styles.buttonsRow, { marginTop: spacing.lg }]}>
          <TouchableOpacity
            onPress={generatePassword}
            disabled={!atLeastOneOptionChecked}
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.md,
                opacity: atLeastOneOptionChecked ? 1 : 0.5,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Yeni şifre üret"
          >
            <Ionicons name="refresh" size={18} color={theme.onPrimaryContainer} />
            <Text
              style={[
                typography.labelLarge,
                { color: theme.onPrimaryContainer, marginLeft: spacing.xs },
              ]}
            >
              Yeniden Üret
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCopy}
            disabled={!password}
            style={[
              styles.actionButton,
              {
                backgroundColor: copied ? theme.success : theme.primary,
                borderRadius: borderRadius.md,
                opacity: password ? 1 : 0.5,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Şifreyi kopyala"
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={18}
              color={theme.onPrimary}
            />
            <Text
              style={[
                typography.labelLarge,
                { color: theme.onPrimary, marginLeft: spacing.xs },
              ]}
            >
              {copied ? 'Kopyalandı!' : 'Kopyala'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Length Stepper Card */}
      <View
        style={[
          styles.optionsCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginTop: spacing.md,
          },
        ]}
      >
        <View style={styles.lengthHeaderRow}>
          <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
            Şifre Uzunluğu
          </Text>
          <View
            style={[
              styles.lengthBadge,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xxs,
              },
            ]}
          >
            <Text
              style={[
                typography.titleSmall,
                { color: theme.onPrimaryContainer, fontWeight: '700' },
              ]}
            >
              {length} Karakter
            </Text>
          </View>
        </View>

        {/* Stepper Buttons and Presets */}
        <View style={[styles.stepperContainer, { marginTop: spacing.md }]}>
          <TouchableOpacity
            onPress={() => changeLength(-4)}
            style={[
              styles.stepQuickBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
            ]}
            accessibilityRole="button"
            accessibilityLabel="4 karakter azalt"
          >
            <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>-4</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeLength(-1)}
            style={[
              styles.stepperBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
            ]}
            accessibilityRole="button"
            accessibilityLabel="1 karakter azalt"
          >
            <Ionicons name="remove" size={20} color={theme.textPrimary} />
          </TouchableOpacity>

          <View style={styles.lengthCenterText}>
            <Text style={[typography.titleLarge, { color: theme.textPrimary }]}>
              {length}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => changeLength(1)}
            style={[
              styles.stepperBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
            ]}
            accessibilityRole="button"
            accessibilityLabel="1 karakter artır"
          >
            <Ionicons name="add" size={20} color={theme.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeLength(4)}
            style={[
              styles.stepQuickBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
            ]}
            accessibilityRole="button"
            accessibilityLabel="4 karakter artır"
          >
            <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>+4</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Length Chips */}
        <View style={[styles.quickChipsRow, { marginTop: spacing.md }]}>
          {[8, 12, 16, 24, 32, 48, 64].map((preset) => {
            const isSelected = length === preset;
            return (
              <TouchableOpacity
                key={`preset-${preset}`}
                onPress={() => setLength(preset)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                    borderRadius: borderRadius.sm,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${preset} karakter uzunluk`}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: isSelected ? theme.onPrimary : theme.textPrimary },
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Character Type Toggles Card */}
      <View
        style={[
          styles.optionsCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginTop: spacing.md,
          },
        ]}
      >
        <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
          Karakter Türleri
        </Text>

        {/* Uppercase Toggle */}
        <TouchableOpacity
          onPress={() => setIncludeUppercase(!includeUppercase)}
          style={[
            styles.toggleRow,
            { borderBottomColor: theme.divider, paddingVertical: spacing.sm },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeUppercase }}
          accessibilityLabel="Büyük Harfler A-Z"
        >
          <View style={styles.toggleTextCol}>
            <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
              Büyük Harfler (A-Z)
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
              ABCDEF...
            </Text>
          </View>
          <Ionicons
            name={includeUppercase ? 'checkbox' : 'square-outline'}
            size={24}
            color={includeUppercase ? theme.primary : theme.textMuted}
          />
        </TouchableOpacity>

        {/* Lowercase Toggle */}
        <TouchableOpacity
          onPress={() => setIncludeLowercase(!includeLowercase)}
          style={[
            styles.toggleRow,
            { borderBottomColor: theme.divider, paddingVertical: spacing.sm },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeLowercase }}
          accessibilityLabel="Küçük Harfler a-z"
        >
          <View style={styles.toggleTextCol}>
            <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
              Küçük Harfler (a-z)
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
              abcdef...
            </Text>
          </View>
          <Ionicons
            name={includeLowercase ? 'checkbox' : 'square-outline'}
            size={24}
            color={includeLowercase ? theme.primary : theme.textMuted}
          />
        </TouchableOpacity>

        {/* Numbers Toggle */}
        <TouchableOpacity
          onPress={() => setIncludeNumbers(!includeNumbers)}
          style={[
            styles.toggleRow,
            { borderBottomColor: theme.divider, paddingVertical: spacing.sm },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeNumbers }}
          accessibilityLabel="Rakamlar 0-9"
        >
          <View style={styles.toggleTextCol}>
            <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
              Rakamlar (0-9)
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
              0123456789
            </Text>
          </View>
          <Ionicons
            name={includeNumbers ? 'checkbox' : 'square-outline'}
            size={24}
            color={includeNumbers ? theme.primary : theme.textMuted}
          />
        </TouchableOpacity>

        {/* Symbols Toggle */}
        <TouchableOpacity
          onPress={() => setIncludeSymbols(!includeSymbols)}
          style={[
            styles.toggleRow,
            { paddingVertical: spacing.sm },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeSymbols }}
          accessibilityLabel="Özel Semboller"
        >
          <View style={styles.toggleTextCol}>
            <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
              Özel Semboller (!@#$%)
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
              !@#$%^&*()_+-=...
            </Text>
          </View>
          <Ionicons
            name={includeSymbols ? 'checkbox' : 'square-outline'}
            size={24}
            color={includeSymbols ? theme.primary : theme.textMuted}
          />
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
  passwordCard: {
    borderWidth: 1,
  },
  passwordDisplayBox: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    gap: 6,
    height: 6,
  },
  strengthBarSegment: {
    flex: 1,
    height: '100%',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  optionsCard: {
    borderWidth: 1,
  },
  lengthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lengthBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepQuickBtn: {
    paddingHorizontal: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lengthCenterText: {
    minWidth: 40,
    alignItems: 'center',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  presetChip: {
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    minHeight: 48,
  },
  toggleTextCol: {
    flex: 1,
  },
});
