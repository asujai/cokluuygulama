import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorTheme, lightTheme, darkTheme, spacing, borderRadius, typography } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = '@gundelik_theme_mode';

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  theme: ColorTheme;
  isDark: boolean;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark') {
          setThemeModeState(savedMode);
        }
      } catch (error) {
        console.warn('Failed to load theme mode preference', error);
      } finally {
        setIsReady(true);
      }
    };

    loadThemeMode();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.warn('Failed to save theme mode preference', error);
    }
  };

  const isDark = useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return systemColorScheme === 'dark';
  }, [themeMode, systemColorScheme]);

  const activeTheme = useMemo(() => {
    return isDark ? darkTheme : lightTheme;
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(() => ({
    themeMode,
    setThemeMode,
    theme: activeTheme,
    isDark,
    spacing,
    borderRadius,
    typography,
  }), [themeMode, activeTheme, isDark]);

  if (!isReady) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
