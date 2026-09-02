import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../core/theme';
import type { IconName } from '../registry/types';

export interface ResultCardProps {
  fileName: string;
  fileUri?: string;
  fileSize?: number;
  fileType?: string;
  title?: string;
  subtitle?: string;
  onSave?: () => void | Promise<void>;
  onShare?: () => void | Promise<void>;
  onContinue?: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  fileName,
  fileUri,
  fileSize,
  fileType = 'file',
  title = 'Sonuç Hazır',
  subtitle,
  onSave,
  onShare,
  onContinue,
  onDelete,
  style,
}) => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getIconForType = (type: string): IconName => {
    switch (type.toLowerCase()) {
      case 'image':
      case 'jpg':
      case 'png':
        return 'image-outline';
      case 'pdf':
        return 'document-text-outline';
      case 'video':
      case 'mp4':
      case 'gif':
        return 'film-outline';
      case 'audio':
      case 'mp3':
        return 'musical-notes-outline';
      case 'zip':
        return 'archive-outline';
      default:
        return 'document-outline';
    }
  };

  const handleSave = async () => {
    if (onSave) {
      try {
        setIsSaving(true);
        await onSave();
        setSaveSuccess(true);
      } catch (err: any) {
        Alert.alert('Kaydetme Hatası', err?.message || 'Dosya kaydedilemedi.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!fileUri) return;

    try {
      setIsSaving(true);
      if (fileType === 'image' || fileType === 'video') {
        if (Platform.OS === 'web') {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
          } else {
            Alert.alert('Bilgi', `Dosya konumu: ${fileUri}`);
          }
          return;
        }
        // expo-media-library is native-only; defer loading to avoid breaking web startup.
        const MediaLibrary = await import('expo-media-library');
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.createAssetAsync(fileUri);
          setSaveSuccess(true);
          Alert.alert('Başarılı', 'Dosya galerinize kaydedildi.');
        } else {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
          }
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Bilgi', `Dosya konumu: ${fileUri}`);
        }
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Kaydetme işlemi tamamlanamadı.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (onShare) {
      try {
        setIsSharing(true);
        await onShare();
      } catch (err: any) {
        Alert.alert('Paylaşım Hatası', err?.message || 'Paylaşılamadı.');
      } finally {
        setIsSharing(false);
      }
      return;
    }

    if (!fileUri) return;

    try {
      setIsSharing(true);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Uyarı', 'Cihazınızda paylaşım seçeneği desteklenmiyor.');
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Paylaşım sırasında hata oluştu.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
        },
        style,
      ]}
    >
      {/* Top Title & Success Indicator */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>{title}</Text>
          {subtitle && (
            <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {saveSuccess && (
          <View
            style={[
              styles.savedBadge,
              { backgroundColor: theme.successContainer, borderRadius: borderRadius.full },
            ]}
          >
            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            <Text style={[typography.labelSmall, { color: theme.success, marginLeft: 4 }]}>
              Kaydedildi
            </Text>
          </View>
        )}
      </View>

      {/* File Info Box */}
      <View
        style={[
          styles.fileBox,
          {
            backgroundColor: theme.surfaceVariant,
            borderRadius: borderRadius.md,
            marginVertical: spacing.sm,
            padding: spacing.sm,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm },
          ]}
        >
          <Ionicons name={getIconForType(fileType)} size={24} color={theme.onPrimaryContainer} />
        </View>

        <View style={styles.fileDetails}>
          <Text style={[typography.bodyMedium, { color: theme.textPrimary }]} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={[typography.labelSmall, { color: theme.textMuted, marginTop: 2 }]}>
            {formatSize(fileSize)} {fileType ? `• ${fileType.toUpperCase()}` : ''}
          </Text>
        </View>

        {onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={theme.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[
            styles.actionBtn,
            { backgroundColor: theme.primary, borderRadius: borderRadius.md },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 6 }]}>
                Kaydet
              </Text>
            </>
          )}
        </TouchableOpacity>

        {fileUri && (
          <TouchableOpacity
            onPress={handleShare}
            disabled={isSharing}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
            ]}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={16} color={theme.textPrimary} />
                <Text
                  style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: 6 }]}
                >
                  Paylaş
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {onContinue && (
          <TouchableOpacity
            onPress={onContinue}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.accent, borderRadius: borderRadius.md },
            ]}
          >
            <Ionicons name="arrow-forward-outline" size={16} color="#FFFFFF" />
            <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 6 }]}>
              Devam Et
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleCol: {
    flex: 1,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fileBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
    marginLeft: 10,
  },
  deleteBtn: {
    padding: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
