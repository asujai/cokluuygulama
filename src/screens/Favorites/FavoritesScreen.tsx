import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoritesScreenProps } from '../../core/navigation/types';
import { useTheme } from '../../core/theme';
import { useLibrary } from '../../core/storage';
import { ToolDefinition } from '../../registry';
import { AppHeader, ToolCard, EmptyState } from '../../components';

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme, spacing } = useTheme();
  const { favoriteTools } = useLibrary();

  const handleOpenTool = (tool: ToolDefinition) => {
    navigation.navigate('Tool', { toolId: tool.id });
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
      <AppHeader
        title="Favori Araçlar"
        subtitle={`${favoriteTools.length} Kayıtlı Araç`}
        showBack
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={favoriteTools}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            padding: spacing.lg,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        renderItem={({ item }) => (
          <ToolCard tool={item} onPress={() => handleOpenTool(item)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            title="Henüz Favori Araç Yok"
            description="Sık kullandığınız araçları yıldız simgesine dokunarak favorilerinize ekleyebilir ve hızlıca erişebilirsiniz."
            actionLabel="Araçları Keşfet"
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
});
