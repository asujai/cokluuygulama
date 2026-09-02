import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../core/theme';
import { ResultCard, ResultCardProps } from './ResultCard';
import { AppHeader } from './AppHeader';

export interface ResultScreenProps extends ResultCardProps {
  onBack?: () => void;
  headerTitle?: string;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  onBack,
  headerTitle = 'İşlem Sonucu',
  ...cardProps
}) => {
  const { theme, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader title={headerTitle} showBack={!!onBack} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <ResultCard {...cardProps} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
