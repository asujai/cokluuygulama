import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SearchScreenProps } from '../../core/navigation/types';
import { useTheme } from '../../core/theme';
import { searchTools, getAllEnabledCategories, ToolDefinition } from '../../registry';
import { SearchInput, ToolCard, EmptyState } from '../../components';

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, spacing, borderRadius, typography } = useTheme();
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    return searchTools(query);
  }, [query]);

  const categories = getAllEnabledCategories();

  const handleOpenTool = (tool: ToolDefinition) => {
    navigation.navigate('Tool', { toolId: tool.id });
  };

  const handleSelectCategory = (categoryId: string) => {
    navigation.navigate('Category', { categoryId });
  };

  const isSearching = query.trim().length > 0;

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
      {/* Search Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { marginRight: spacing.xs }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.searchInputWrapper}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Araç veya işlev ara..."
          />
        </View>
      </View>

      {/* Results or Initial State */}
      {isSearching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            {
              padding: spacing.lg,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          ListHeaderComponent={
            searchResults.length > 0 ? (
              <View style={[styles.resultsHeader, { marginBottom: spacing.md }]}>
                <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
                  {searchResults.length} sonuç bulundu
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ToolCard tool={item} onPress={() => handleOpenTool(item)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Sonuç Bulunamadı"
              description={`"${query}" aramasıyla eşleşen bir araç bulunamadı. Farklı anahtar kelimeler deneyebilirsiniz.`}
            />
          }
        />
      ) : (
        <ScrollView
          style={styles.initialStateScroll}
          contentContainerStyle={[
            styles.initialStateContent,
            { padding: spacing.lg, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.promptBox}>
            <View
              style={[
                styles.promptIconBox,
                { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full },
              ]}
            >
              <Ionicons name="search" size={32} color={theme.textSecondary} />
            </View>
            <Text
              style={[
                typography.titleSmall,
                { color: theme.textPrimary, textAlign: 'center', marginTop: spacing.md },
              ]}
            >
              Ne yapmak istiyorsunuz?
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
              Aramak istediğiniz aracın adını, açıklamasını veya anahtar kelimelerini yazın.
            </Text>
          </View>

          {/* Quick Category Suggestions */}
          <View style={{ marginTop: spacing.xl }}>
            <Text
              style={[
                typography.labelMedium,
                { color: theme.textSecondary, marginBottom: spacing.sm },
              ]}
            >
              Kategorilere Göz Atın
            </Text>

            <View style={styles.chipsContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={`chip-${category.id}`}
                  onPress={() => handleSelectCategory(category.id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.cardBorder,
                      borderRadius: borderRadius.full,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.md,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${category.name} kategorisine git`}
                >
                  <Ionicons
                    name={category.icon}
                    size={16}
                    color={category.accentColor || theme.primary}
                  />
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: theme.textPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
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
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  resultsHeader: {},
  initialStateScroll: {
    flex: 1,
  },
  initialStateContent: {
    flexGrow: 1,
  },
  promptBox: {
    alignItems: 'center',
    marginTop: 24,
  },
  promptIconBox: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 36,
  },
});
