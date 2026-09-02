import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/core/theme';
import { LibraryProvider, useLibrary } from './src/core/storage';
import { AppNavigator } from './src/core/navigation';
import { ErrorBoundary } from './src/components';
import { validateRegistries } from './src/registry';

// Validate registry integrity on startup
validateRegistries();

const AppContent: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { isHydrated } = useLibrary();

  // Prevent UI flash before AsyncStorage hydration is complete
  if (!isHydrated) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ErrorBoundary
        fallbackTitle="Gündelik başlatılamadı"
        fallbackMessage="Uygulama başlatılırken beklenmeyen bir sorun oluştu. Tekrar deneyin."
      >
        <AppNavigator />
      </ErrorBoundary>
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LibraryProvider>
          <AppContent />
        </LibraryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
