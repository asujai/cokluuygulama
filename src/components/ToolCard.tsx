import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToolDefinition, getCategoryName } from '../registry';
import { useTheme } from '../core/theme';
import { useLibrary } from '../core/storage';

interface ToolCardProps {
  tool: ToolDefinition;
  onPress: () => void;
  variant?: 'full' | 'compact';
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  onPress,
  variant = 'full',
}) => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const { isFavorite, toggleFavorite } = useLibrary();

  const favorite = isFavorite(tool.id);
  const categoryName = getCategoryName(tool.categoryId);

  if (variant === 'compact') {
    return (
      <View
        style={[
          styles.compactCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.md,
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.compactRow}>
          <TouchableOpacity
            onPress={onPress}
            style={styles.compactMain}
            accessibilityRole="button"
            accessibilityLabel={`${tool.name} aracını aç`}
          >
            <View
              style={[
                styles.iconWrapperSmall,
                {
                  backgroundColor: theme.primaryContainer,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <Ionicons name={tool.icon} size={20} color={theme.onPrimaryContainer} />
            </View>

            <View style={styles.compactTextCol}>
              <Text
                style={[typography.titleSmall, { color: theme.textPrimary }]}
                numberOfLines={1}
              >
                {tool.name}
              </Text>
              <Text
                style={[typography.labelSmall, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {categoryName}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => toggleFavorite(tool.id)}
            style={styles.favoriteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? `${tool.name} favorilerden çıkar` : `${tool.name} favorilere ekle`
            }
          >
            <Ionicons
              name={favorite ? 'star' : 'star-outline'}
              size={20}
              color={favorite ? theme.star : theme.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.cardBorder,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${tool.name} aracını aç`}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconAndTitleRow}>
            <View
              style={[
                styles.iconWrapper,
                {
                  backgroundColor: theme.primaryContainer,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Ionicons name={tool.icon} size={24} color={theme.onPrimaryContainer} />
            </View>

            <View style={styles.titleContainer}>
              <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                {tool.name}
              </Text>
              <View
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderRadius: borderRadius.xs,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.textSecondary },
                  ]}
                >
                  {categoryName}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text
          style={[
            typography.bodyMedium,
            { color: theme.textSecondary, marginTop: spacing.sm },
          ]}
          numberOfLines={2}
        >
          {tool.description}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => toggleFavorite(tool.id)}
        style={[
          styles.favoriteButton,
          styles.favoriteButtonAbsolute,
          { top: spacing.md, right: spacing.md },
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={
          favorite ? `${tool.name} favorilerden çıkar` : `${tool.name} favorilere ekle`
        }
      >
        <Ionicons
          name={favorite ? 'star' : 'star-outline'}
          size={22}
          color={favorite ? theme.star : theme.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 44,
  },
  iconAndTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonAbsolute: {
    position: 'absolute',
  },
  compactCard: {
    borderWidth: 1,
    width: 220,
    marginRight: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapperSmall: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTextCol: {
    flex: 1,
    marginLeft: 10,
  },
});
