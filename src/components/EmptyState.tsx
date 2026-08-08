import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../core/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  return (
    <View style={[styles.container, { padding: spacing.xl }]}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: theme.surfaceVariant,
            borderRadius: borderRadius.full,
          },
        ]}
      >
        <Ionicons name={icon} size={40} color={theme.textSecondary} />
      </View>

      <Text
        style={[
          typography.titleSmall,
          { color: theme.textPrimary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          typography.bodyMedium,
          {
            color: theme.textSecondary,
            textAlign: 'center',
            marginTop: spacing.xs,
            lineHeight: 20,
          },
        ]}
      >
        {description}
      </Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.primary,
              borderRadius: borderRadius.md,
              marginTop: spacing.lg,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[typography.labelLarge, { color: theme.onPrimary }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  iconCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
