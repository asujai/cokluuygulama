import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreenProps } from '../../core/navigation/types';
import { useTheme } from '../../core/theme';
import { useLibrary } from '../../core/storage';
import { getAllEnabledCategories, ToolDefinition } from '../../registry';
import { ToolCard, CategoryCard, ThemeSelector } from '../../components';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, spacing, borderRadius, typography } = useTheme();
  const { favoriteTools, recentTools, clearRecents } = useLibrary();

  const categories = getAllEnabledCategories();

  const handleOpenTool = (tool: ToolDefinition) => {
    navigation.navigate('Tool', { toolId: tool.id });
  };

  const handleOpenCategory = (categoryId: string) => {
    navigation.navigate('Category', { categoryId });
  };

  const handleOpenSearch = () => {
    navigation.navigate('Search');
  };

  const handleOpenFavorites = () => {
    navigation.navigate('Favorites');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Top Header & Brand Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoIconBox,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Ionicons name="construct" size={22} color={theme.onPrimaryContainer} />
          </View>
          <View style={styles.brandTextCol}>
            <Text style={[typography.titleLarge, { color: theme.textPrimary, fontSize: 20 }]}>
              Gündelik
            </Text>
            <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
              Çevrimdışı Pratik Araç Kutusu
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleOpenFavorites}
            style={[
              styles.favoritesShortcutBtn,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.md,
                marginRight: spacing.xs,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Favori araçlar sayfasına git"
          >
            <Ionicons
              name={favoriteTools.length > 0 ? 'star' : 'star-outline'}
              size={18}
              color={favoriteTools.length > 0 ? theme.star : theme.textSecondary}
            />
            {favoriteTools.length > 0 && (
              <View
                style={[
                  styles.favBadge,
                  { backgroundColor: theme.primary, borderRadius: borderRadius.full },
                ]}
              >
                <Text style={[typography.labelSmall, { color: theme.onPrimary, fontSize: 9 }]}>
                  {favoriteTools.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <ThemeSelector />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar Trigger */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <TouchableOpacity
            onPress={handleOpenSearch}
            activeOpacity={0.85}
            style={[
              styles.searchTrigger,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                borderRadius: borderRadius.lg,
                paddingHorizontal: spacing.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Araç ara. Arama sayfasına git"
          >
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <Text
              style={[
                typography.bodyLarge,
                { color: theme.textMuted, marginLeft: spacing.sm, flex: 1 },
              ]}
            >
              Araç ara... (Sayaç, Şifre, Birim)
            </Text>
            <View
              style={[
                styles.searchKeyBadge,
                { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.xs },
              ]}
            >
              <Ionicons name="arrow-forward" size={14} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Favorites Section - ONLY visible when non-empty */}
        {favoriteTools.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.lg }]}>
            <View
              style={[
                styles.sectionHeaderRow,
                { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <Ionicons name="star" size={18} color={theme.star} />
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Favoriler
                </Text>
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.full,
                      marginLeft: spacing.xs,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                    {favoriteTools.length}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleOpenFavorites}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Tüm favorileri gör"
              >
                <Text style={[typography.labelMedium, { color: theme.primary }]}>
                  Tümünü Gör
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            >
              {favoriteTools.map((tool) => (
                <ToolCard
                  key={`fav-${tool.id}`}
                  tool={tool}
                  variant="compact"
                  onPress={() => handleOpenTool(tool)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories Section Grid */}
        <View style={[styles.section, { marginTop: spacing.lg, paddingHorizontal: spacing.lg }]}>
          <View style={[styles.sectionHeaderRow, { marginBottom: spacing.md }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid-outline" size={18} color={theme.primary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: theme.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Kategoriler
              </Text>
            </View>
          </View>

          <View style={styles.categoriesGrid}>
            {categories.map((category) => (
              <View key={category.id} style={styles.categoryCol}>
                <CategoryCard
                  category={category}
                  onPress={() => handleOpenCategory(category.id)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Recent Section - ONLY visible when non-empty */}
        {recentTools.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.lg }]}>
            <View
              style={[
                styles.sectionHeaderRow,
                { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Son Kullanılanlar
                </Text>
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.full,
                      marginLeft: spacing.xs,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                    {recentTools.length}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={clearRecents}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Son kullanılanları temizle"
              >
                <Text style={[typography.labelMedium, { color: theme.error }]}>
                  Temizle
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            >
              {recentTools.map((tool) => (
                <ToolCard
                  key={`rec-${tool.id}`}
                  tool={tool}
                  variant="compact"
                  onPress={() => handleOpenTool(tool)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoIconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextCol: {
    marginLeft: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoritesShortcutBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  favBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
  },
  searchKeyBadge: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  categoryCol: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
});
