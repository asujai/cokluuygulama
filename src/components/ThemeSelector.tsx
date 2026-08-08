import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../core/theme';

export const ThemeSelector: React.FC = () => {
  const { themeMode, setThemeMode, theme, spacing, borderRadius, typography } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { mode: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
    { mode: 'light', label: 'Açık', icon: 'sunny-outline' },
    { mode: 'dark', label: 'Koyu', icon: 'moon-outline' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceVariant,
          borderRadius: borderRadius.md,
          padding: spacing.xxs,
        },
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Tema seçimi"
    >
      {options.map((option) => {
        const isSelected = themeMode === option.mode;
        return (
          <TouchableOpacity
            key={option.mode}
            onPress={() => setThemeMode(option.mode)}
            style={[
              styles.optionButton,
              {
                backgroundColor: isSelected ? theme.surface : 'transparent',
                borderRadius: borderRadius.sm,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${option.label} tema`}
          >
            <Ionicons
              name={option.icon}
              size={14}
              color={isSelected ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: isSelected ? theme.textPrimary : theme.textSecondary,
                  fontWeight: isSelected ? '700' : '500',
                  marginLeft: spacing.xxs,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
});
