import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryScreenProps } from '../../core/navigation/types';
import { useTheme } from '../../core/theme';
import { getCategoryById, getToolsByCategory, ToolDefinition } from '../../registry';
import { AppHeader, ToolCard, EmptyState } from '../../components';

export const CategoryScreen: React.FC<CategoryScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme, spacing, typography } = useTheme();
  const { categoryId } = route.params;

  const category = getCategoryById(categoryId);
  const tools = getToolsByCategory(categoryId);

  const handleOpenTool = (tool: ToolDefinition) => {
    navigation.navigate('Tool', { toolId: tool.id });
  };

  if (!category) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <AppHeader title="Kategori Bulunamadı" showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title="Kategori Bulunamadı"
          description="İstenen kategori sistemde kayıtlı değil veya devre dışı bırakılmış."
          actionLabel="Ana Sayfaya Dön"
          onAction={() => navigation.navigate('Home')}
        />
      </View>
    );
  }

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
      <AppHeader
        title={category.name}
        subtitle={`${tools.length} Araç`}
        showBack
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={tools}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            padding: spacing.lg,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        ListHeaderComponent={
          <View style={[styles.headerBox, { marginBottom: spacing.md }]}>
            <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
              {category.description}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ToolCard tool={item} onPress={() => handleOpenTool(item)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="construct-outline"
            title="Henüz Araç Bulunmuyor"
            description={`"${category.name}" kategorisine ait araçlar yakında eklenecektir.`}
            actionLabel="Ana Sayfaya Dön"
            onAction={() => navigation.navigate('Home')}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  headerBox: {},
});
