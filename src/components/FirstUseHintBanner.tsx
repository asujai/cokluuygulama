import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../core/theme';
import { useLibrary } from '../core/storage';

export const FirstUseHintBanner: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const { firstUseSeen, dismissFirstUseHint } = useLibrary();

  if (firstUseSeen) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.primaryContainer,
          borderColor: theme.primary,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginTop: spacing.md,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <Ionicons name="sparkles-outline" size={22} color={theme.onPrimaryContainer} />
        <View style={styles.textCol}>
          <Text style={[typography.titleSmall, { color: theme.onPrimaryContainer }]}>
            Gündelik Araç Kutusu'na Hoş Geldiniz!
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: theme.onPrimaryContainer, marginTop: 2, opacity: 0.9 },
            ]}
          >
            Tüm araçlar %100 çevrimdışı çalışır. İster "Ne yapmak istiyorsun?" arama kutusundan
            istediğiniz işlemi yazın, ister dosya seçip uyumlu araçları görün.
          </Text>
        </View>
        <TouchableOpacity
          onPress={dismissFirstUseHint}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="İpucunu kapat"
        >
          <Ionicons name="close" size={20} color={theme.onPrimaryContainer} />
        </TouchableOpacity>
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
    alignItems: 'flex-start',
  },
  textCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  closeBtn: {
    padding: 2,
  },
});
