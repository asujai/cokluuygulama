import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useTheme } from '../theme';
import { HomeScreen } from '../../screens/Home';
import { CategoryScreen } from '../../screens/Category';
import { ToolScreen } from '../../screens/Tool';
import { SearchScreen } from '../../screens/Search';
import { FavoritesScreen } from '../../screens/Favorites';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { theme, isDark } = useTheme();

  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navigationTheme: Theme = {
    ...baseTheme,
    dark: isDark,
    colors: {
      ...baseTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.textPrimary,
      border: theme.divider,
      notification: theme.accent,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Category" component={CategoryScreen} />
        <Stack.Screen name="Tool" component={ToolScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
