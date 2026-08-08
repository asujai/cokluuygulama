import { Linking, Platform } from 'react-native';
import {
  PermissionDescriptor,
  PermissionServiceAdapter,
  PermissionStatus,
} from './types';

class DefaultPermissionAdapter implements PermissionServiceAdapter {
  async checkPermission(descriptor: PermissionDescriptor): Promise<PermissionStatus> {
    // Basic offline/core permission checking suitable for extensible modularity
    if (descriptor.type === 'clipboard') {
      return 'granted';
    }
    // Web fallback
    if (Platform.OS === 'web') {
      return 'granted';
    }
    return 'not-determined';
  }

  async requestPermission(descriptor: PermissionDescriptor): Promise<PermissionStatus> {
    if (descriptor.type === 'clipboard') {
      return 'granted';
    }
    if (Platform.OS === 'web') {
      return 'granted';
    }
    return 'granted';
  }

  async openSettings(): Promise<void> {
    if (Platform.OS !== 'web') {
      await Linking.openSettings();
    }
  }
}

class PermissionService {
  private adapter: PermissionServiceAdapter;

  constructor(adapter: PermissionServiceAdapter = new DefaultPermissionAdapter()) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: PermissionServiceAdapter): void {
    this.adapter = adapter;
  }

  public async check(descriptor: PermissionDescriptor): Promise<PermissionStatus> {
    try {
      return await this.adapter.checkPermission(descriptor);
    } catch (error) {
      console.warn(`Error checking permission for ${descriptor.name}:`, error);
      return 'unavailable';
    }
  }

  public async request(descriptor: PermissionDescriptor): Promise<PermissionStatus> {
    try {
      return await this.adapter.requestPermission(descriptor);
    } catch (error) {
      console.warn(`Error requesting permission for ${descriptor.name}:`, error);
      return 'denied';
    }
  }

  public async openSettings(): Promise<void> {
    try {
      await this.adapter.openSettings();
    } catch (error) {
      console.warn('Error opening app settings:', error);
    }
  }
}

export const permissionService = new PermissionService();
