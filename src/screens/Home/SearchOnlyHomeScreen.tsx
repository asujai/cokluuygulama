import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreenProps } from '../../core/navigation/types';
import { useTheme } from '../../core/theme';
import {
  getAllEnabledTools,
  matchesTurkishQuery,
} from '../../registry';
import {
  SearchInput,
  ToolCard,
  EmptyState,
  ThemeSelector,
} from '../../components';

export const SearchOnlyHomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, spacing, borderRadius, typography } = useTheme();
  const [query, setQuery] = useState('');

  const trimmedQuery = query.trim();

  const searchResults = useMemo(() => {
    if (!trimmedQuery) {
      return [];
    }

    return getAllEnabledTools().filter((tool) =>
      matchesTurkishQuery(tool.name, trimmedQuery)
    );
  }, [trimmedQuery]);


  const isSearching = trimmedQuery.length > 0;

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
          <ThemeSelector />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Araç ismi ile ara..."
        />
      </View>

      {isSearching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          ListHeaderComponent={
            searchResults.length > 0 ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
                  {searchResults.length} sonuç bulundu
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ToolCard
              tool={item}
              onPress={() => navigation.push('Tool', { toolId: item.id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Sonuç Bulunamadı"
              description={`"${trimmedQuery}" ismiyle eşleşen bir araç bulunamadı. Lütfen araç adını kontrol edin.`}
            />
          }
        />
      ) : (
        <View
          style={[
            styles.emptyQueryContainer,
            {
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + 32,
            },
          ]}
        >
          <View
            style={[
              styles.infoIconCircle,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Ionicons name="search-outline" size={36} color={theme.textSecondary} />
          </View>
          <Text
            style={[
              typography.titleSmall,
              { color: theme.textPrimary, textAlign: 'center', marginTop: spacing.md },
            ]}
          >
            Araç Arama
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
            Uygulamalar yalnızca ismine göre arandığında görünür. Görmek istediğiniz aracın adını yukarıdaki arama alanına yazın.
          </Text>
        </View>
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
  listContent: {
    flexGrow: 1,
  },
  emptyQueryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  infoIconCircle: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
