import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoryDefinition, getToolsByCategory } from '../registry';
import { useTheme } from '../core/theme';

interface CategoryCardProps {
  category: CategoryDefinition;
  onPress: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  onPress,
}) => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const tools = getToolsByCategory(category.id);
  const count = tools.length;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.cardBorder,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${category.name} kategorisi, ${count} araç`}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: category.accentColor
                ? `${category.accentColor}1A`
                : theme.primaryContainer,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name={category.icon}
            size={24}
            color={category.accentColor || theme.primary}
          />
        </View>

        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: count > 0 ? theme.primaryContainer : theme.surfaceVariant,
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxs,
            },
          ]}
        >
          <Text
            style={[
              typography.labelSmall,
              {
                color: count > 0 ? theme.onPrimaryContainer : theme.textMuted,
                fontWeight: '600',
              },
            ]}
          >
            {count} {count === 1 ? 'araç' : 'araç'}
          </Text>
        </View>
      </View>

      <Text
        style={[
          typography.titleSmall,
          { color: theme.textPrimary, marginTop: spacing.md },
        ]}
        numberOfLines={1}
      >
        {category.name}
      </Text>

      <Text
        style={[
          typography.bodySmall,
          { color: theme.textSecondary, marginTop: spacing.xs },
        ]}
        numberOfLines={2}
      >
        {category.description}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
