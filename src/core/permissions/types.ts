export type PermissionType =
  | 'camera'
  | 'media_library'
  | 'clipboard'
  | 'notifications'
  | 'location';

export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'not-determined';

export interface PermissionDescriptor {
  type: PermissionType;
  name: string;
  description: string;
  required?: boolean;
}

export interface PermissionServiceAdapter {
  checkPermission(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
  requestPermission(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
  openSettings(): Promise<void>;
}
