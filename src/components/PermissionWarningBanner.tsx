import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../core/theme';
import { PermissionDescriptor, PermissionStatus } from '../core/permissions/types';
import { permissionService } from '../core/permissions/permissionService';

export interface PermissionWarningBannerProps {
  permissions: PermissionDescriptor[];
  onPermissionsGranted?: () => void;
}

export const PermissionWarningBanner: React.FC<PermissionWarningBannerProps> = ({
  permissions,
  onPermissionsGranted,
}) => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const [missingPermissions, setMissingPermissions] = useState<PermissionDescriptor[]>([]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAll = async () => {
      if (!permissions || permissions.length === 0) {
        if (isMounted) {
          setMissingPermissions([]);
          setChecking(false);
        }
        return;
      }

      const missing: PermissionDescriptor[] = [];
      for (const perm of permissions) {
        const status: PermissionStatus = await permissionService.check(perm);
        if (status === 'denied' || status === 'blocked' || status === 'unavailable') {
          missing.push(perm);
        }
      }

      if (isMounted) {
        setMissingPermissions(missing);
        setChecking(false);
      }
    };

    checkAll();

    return () => {
      isMounted = false;
    };
  }, [permissions]);

  if (checking || missingPermissions.length === 0) {
    return null;
  }

  const primaryMissing = missingPermissions[0];
  const isUnavailable = primaryMissing.description.toLowerCase().includes('desteklenmiyor');

  const handleRequest = async () => {
    const status = await permissionService.request(primaryMissing);
    if (status === 'granted') {
      setMissingPermissions((prev) => prev.filter((p) => p.type !== primaryMissing.type));
      if (onPermissionsGranted) {
        onPermissionsGranted();
      }
    } else if (status === 'blocked') {
      await permissionService.openSettings();
    }
  };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.surfaceVariant,
          borderColor: theme.warning,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <Ionicons
          name={isUnavailable ? 'build-outline' : 'alert-circle-outline'}
          size={22}
          color={theme.warning}
        />
        <View style={styles.textCol}>
          <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
            {isUnavailable
              ? `Cihaz Özelliği Kullanılamıyor (${primaryMissing.name})`
              : `Gerekli İzin: ${primaryMissing.name}`}
          </Text>
          <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
            {primaryMissing.description}
          </Text>
        </View>
        {!isUnavailable && (
          <TouchableOpacity
            onPress={handleRequest}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.primary, borderRadius: borderRadius.sm },
            ]}
          >
            <Text style={[typography.labelSmall, { color: '#FFFFFF' }]}>İzin Ver</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
