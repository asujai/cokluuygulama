import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ToolScreenProps } from '../../core/navigation/types';
import { useTheme } from '../../core/theme';
import { useLibrary } from '../../core/storage';
import { getToolById, getCategoryName } from '../../registry';
import { AppHeader, ErrorBoundary, EmptyState } from '../../components';

export const ToolScreen: React.FC<ToolScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isFavorite, toggleFavorite, addRecent } = useLibrary();

  const { toolId } = route.params;
  const tool = getToolById(toolId);

  // Record recent usage when the tool opens
  useEffect(() => {
    if (tool && tool.enabled) {
      addRecent(tool.id);
    }
  }, [tool, addRecent]);

  if (!tool || !tool.enabled) {
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
          title="Araç Bulunamadı"
          showBack
          onBack={() => navigation.goBack()}
        />
        <EmptyState
          icon="alert-circle-outline"
          title="Araç Kullanılamıyor"
          description="Aradığınız araç sistemde mevcut değil veya geçici olarak devre dışı bırakılmış."
          actionLabel="Ana Sayfaya Dön"
          onAction={() => navigation.navigate('Home')}
        />
      </View>
    );
  }

  const categoryName = getCategoryName(tool.categoryId);
  const favorite = isFavorite(tool.id);
  const ToolComponent = tool.component;

  const favoriteAction = (
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
        size={24}
        color={favorite ? theme.star : theme.textSecondary}
      />
    </TouchableOpacity>
  );

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
        title={tool.name}
        subtitle={categoryName}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={favoriteAction}
      />

      <View style={styles.toolHost}>
        <ErrorBoundary
          fallbackTitle={`"${tool.name}" aracında bir hata oluştu`}
          fallbackMessage="Bu araç çalıştırılırken beklenmeyen bir hata meydana geldi. Diğer araçları kullanmaya devam edebilirsiniz."
        >
          <ToolComponent />
        </ErrorBoundary>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolHost: {
    flex: 1,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
