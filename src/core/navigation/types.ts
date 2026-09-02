import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SupportedInputType } from '../../registry/inputInference';

export interface SelectedInputMetadata {
  uri: string;
  name?: string;
  mimeType?: string;
  type?: SupportedInputType;
  size?: number;
}

export type RootStackParamList = {
  Home: undefined;
  Category: { categoryId: string };
  Tool: { toolId: string; selectedInput?: SelectedInputMetadata };
  Search: undefined;
  Favorites: undefined;
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type CategoryScreenProps = NativeStackScreenProps<RootStackParamList, 'Category'>;
export type ToolScreenProps = NativeStackScreenProps<RootStackParamList, 'Tool'>;
export type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;
export type FavoritesScreenProps = NativeStackScreenProps<RootStackParamList, 'Favorites'>;

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
