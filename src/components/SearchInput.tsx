import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../core/theme';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Araç ara...',
  autoFocus = false,
  onClear,
}) => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.inputBackground,
          borderColor: theme.inputBorder,
          borderRadius: borderRadius.lg,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <Ionicons name="search" size={20} color={theme.textSecondary} />

      <TextInput
        style={[
          styles.input,
          typography.bodyLarge,
          {
            color: theme.textPrimary,
            marginLeft: spacing.sm,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={placeholder}
      />

      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Aramayı temizle"
        >
          <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    height: '100%',
  },
  clearButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
