import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { PermissionDescriptor } from '../core/permissions/types';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface CategoryDefinition {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  order: number;
  enabled: boolean;
  accentColor?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  categoryId: string;
  route: string;
  keywords: string[];
  enabled: boolean;
  requiresPermission: PermissionDescriptor[];
  supportedInputTypes: string[];
  component: React.ComponentType;
}
