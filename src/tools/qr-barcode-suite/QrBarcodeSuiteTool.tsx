import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  ColorPreset,
  QrContentType,
  QrCorrectionLevel,
  QrGeneratorState,
  ScannedResult,
} from './types';
import {
  downloadOrShareQrCode,
  encodeQrCode,
  formatQrPayload,
  generateQrPngDataUrl,
  generateQrSvgDataUri,
  generateQrSvgString,
} from './qrGenerator';
import {
  clearAllHistory,
  deleteHistoryItem,
  getScannedHistory,
  parseScannedContent,
  saveScannedToHistory,
  scanBarcodeFromImageUri,
} from './barcodeScanner';

const COLOR_PRESETS: ColorPreset[] = [
  { id: 'classic', name: 'Klasik Siyah', fg: '#000000', bg: '#FFFFFF' },
  { id: 'navy', name: 'Gece Mavisi', fg: '#1E40AF', bg: '#EFF6FF' },
  { id: 'emerald', name: 'Zümrüt Yeşili', fg: '#065F46', bg: '#ECFDF5' },
  { id: 'purple', name: 'Kraliyet Moru', fg: '#5B21B6', bg: '#F5F3FF' },
  { id: 'crimson', name: 'Koyu Kırmızı', fg: '#991B1B', bg: '#FEF2F2' },
  { id: 'dark', name: 'Koyu Tema', fg: '#F8FAFC', bg: '#0F172A' },
];

export const QrBarcodeSuiteTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Active Tab: 'generator' | 'scanner' | 'history'
  const [activeTab, setActiveTab] = useState<'generator' | 'scanner' | 'history'>('generator');

  // ==========================================
  // Generator State
  // ==========================================
  const [genState, setGenState] = useState<QrGeneratorState>({
    type: 'url',
    text: 'Gündelik Araçlar ile hayatınızı kolaylaştırın!',
    url: 'https://github.com',
    phone: '+90 555 123 4567',
    email: {
      email: 'destek@ornek.com',
      subject: 'Bilgi Talebi',
      body: 'Merhaba, uygulamanız hakkında bilgi almak istiyorum.',
    },
    wifi: {
      ssid: 'Ev_Interneti_5G',
      password: 'guclusifre123',
      encryption: 'WPA',
      hidden: false,
    },
    fgColor: '#000000',
    bgColor: '#FFFFFF',
    correctionLevel: 'M',
    size: 512,
    includeMargin: true,
  });

  const [qrPreviewUri, setQrPreviewUri] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // ==========================================
  // Scanner State
  // ==========================================
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<ScannedResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedResult[]>([]);

  // Load history on mount
  useEffect(() => {
    getScannedHistory().then(setScanHistory);
  }, []);

  // Compute QR Payload
  const currentPayload = useMemo(() => {
    return formatQrPayload(genState);
  }, [genState]);

  // Update QR Preview whenever state changes
  useEffect(() => {
    let isCancelled = false;
    const generatePreview = async () => {
      try {
        if (!currentPayload) {
          setQrPreviewUri('');
          return;
        }
        const matrix = encodeQrCode(currentPayload, genState.correctionLevel);
        const dataUrl = await generateQrPngDataUrl(matrix, {
          fgColor: genState.fgColor,
          bgColor: genState.bgColor,
          size: 400,
          margin: genState.includeMargin ? 4 : 1,
        });
        if (!isCancelled) {
          setQrPreviewUri(dataUrl);
        }
      } catch (err) {
        console.warn('Preview generation failed:', err);
      }
    };

    generatePreview();
    return () => {
      isCancelled = true;
    };
  }, [currentPayload, genState.fgColor, genState.bgColor, genState.correctionLevel, genState.includeMargin]);

  // ==========================================
  // Generator Actions
  // ==========================================
  const handleDownloadPng = async () => {
    if (!currentPayload) return;
    setIsGenerating(true);
    try {
      const matrix = encodeQrCode(currentPayload, genState.correctionLevel);
      const dataUrl = await generateQrPngDataUrl(matrix, {
        fgColor: genState.fgColor,
        bgColor: genState.bgColor,
        size: genState.size,
        margin: genState.includeMargin ? 4 : 1,
      });
      const fileName = `qrcode_${genState.type}_${Date.now()}.png`;
      await downloadOrShareQrCode(dataUrl, fileName, false);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'QR kodu indirilemedi.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSvg = async () => {
    if (!currentPayload) return;
    setIsGenerating(true);
    try {
      const matrix = encodeQrCode(currentPayload, genState.correctionLevel);
      const svgString = generateQrSvgString(matrix, {
        fgColor: genState.fgColor,
        bgColor: genState.bgColor,
        size: genState.size,
        margin: genState.includeMargin ? 4 : 1,
      });
      const svgDataUri = generateQrSvgDataUri(svgString);
      const fileName = `qrcode_${genState.type}_${Date.now()}.svg`;
      await downloadOrShareQrCode(svgDataUri, fileName, true);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'SVG indirilemedi.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPayload = async () => {
    if (!currentPayload) return;
    await Clipboard.setStringAsync(currentPayload);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // ==========================================
  // Scanner Actions
  // ==========================================
  const handlePickScanImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni vermelisiniz.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setIsScanning(true);
        try {
          const scan = await scanBarcodeFromImageUri(uri);
          if (scan) {
            setScannedResult(scan);
            const updated = await saveScannedToHistory(scan);
            setScanHistory(updated);
          } else {
            Alert.alert('Bulunamadı', 'Görselde okunabilir bir QR kod veya barkod tespit edilemedi.');
          }
        } catch (scanErr: any) {
          Alert.alert('Hata', scanErr?.message || 'Tarama sırasında bir hata meydana geldi.');
        } finally {
          setIsScanning(false);
        }
      }
    } catch (err) {
      console.warn('Error picking scan image:', err);
    }
  };

  const handleCaptureScanPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Kamera ile tarama yapmak için izin vermelisiniz.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setIsScanning(true);
        try {
          const scan = await scanBarcodeFromImageUri(uri);
          if (scan) {
            setScannedResult(scan);
            const updated = await saveScannedToHistory(scan);
            setScanHistory(updated);
          } else {
            Alert.alert('Bulunamadı', 'Fotoğrafta okunabilir bir QR kod veya barkod tespit edilemedi.');
          }
        } catch (scanErr: any) {
          Alert.alert('Hata', scanErr?.message || 'Tarama hatası');
        } finally {
          setIsScanning(false);
        }
      }
    } catch (err) {
      console.warn('Camera scan error:', err);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      let target = url.trim();
      if (!/^https?:\/\//i.test(target) && !target.startsWith('tel:') && !target.startsWith('mailto:')) {
        target = 'https://' + target;
      }
      await Linking.openURL(target);
    } catch (err) {
      Alert.alert('Açılamadı', 'Bağlantı açılamadı: ' + url);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    const updated = await deleteHistoryItem(id);
    setScanHistory(updated);
  };

  const handleClearAllHistory = async () => {
    await clearAllHistory();
    setScanHistory([]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Segmented Navigation */}
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: 4,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setActiveTab('generator')}
          style={[
            styles.tabButton,
            {
              backgroundColor: activeTab === 'generator' ? theme.primary : 'transparent',
              borderRadius: borderRadius.md,
            },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'generator' }}
        >
          <Ionicons
            name="qr-code-outline"
            size={18}
            color={activeTab === 'generator' ? theme.onPrimary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              {
                color: activeTab === 'generator' ? theme.onPrimary : theme.textSecondary,
                marginLeft: spacing.xs,
              },
            ]}
          >
            QR Oluştur
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('scanner')}
          style={[
            styles.tabButton,
            {
              backgroundColor: activeTab === 'scanner' ? theme.primary : 'transparent',
              borderRadius: borderRadius.md,
            },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'scanner' }}
        >
          <Ionicons
            name="scan-outline"
            size={18}
            color={activeTab === 'scanner' ? theme.onPrimary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              {
                color: activeTab === 'scanner' ? theme.onPrimary : theme.textSecondary,
                marginLeft: spacing.xs,
              },
            ]}
          >
            Barkod & QR Tara
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          style={[
            styles.tabButton,
            {
              backgroundColor: activeTab === 'history' ? theme.primary : 'transparent',
              borderRadius: borderRadius.md,
            },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'history' }}
        >
          <Ionicons
            name="time-outline"
            size={18}
            color={activeTab === 'history' ? theme.onPrimary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              {
                color: activeTab === 'history' ? theme.onPrimary : theme.textSecondary,
                marginLeft: spacing.xs,
              },
            ]}
          >
            Geçmiş ({scanHistory.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: GENERATOR */}
      {/* ========================================================================= */}
      {activeTab === 'generator' && (
        <View style={{ marginTop: spacing.md }}>
          {/* Content Type Pill Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeSelectorRow}
          >
            {[
              { id: 'url', label: 'Web Sitesi', icon: 'globe-outline' },
              { id: 'text', label: 'Metin', icon: 'document-text-outline' },
              { id: 'wifi', label: 'Wi-Fi Ağı', icon: 'wifi-outline' },
              { id: 'phone', label: 'Telefon', icon: 'call-outline' },
              { id: 'email', label: 'E-Posta', icon: 'mail-outline' },
            ].map((typeItem) => {
              const isSelected = genState.type === typeItem.id;
              return (
                <TouchableOpacity
                  key={typeItem.id}
                  onPress={() => setGenState((prev) => ({ ...prev, type: typeItem.id as QrContentType }))}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.cardBorder,
                      borderRadius: borderRadius.full,
                      paddingVertical: spacing.xs + 2,
                      paddingHorizontal: spacing.md,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={typeItem.icon as any}
                    size={16}
                    color={isSelected ? theme.onPrimary : theme.textPrimary}
                  />
                  <Text
                    style={[
                      typography.labelSmall,
                      {
                        color: isSelected ? theme.onPrimary : theme.textPrimary,
                        marginLeft: spacing.xs,
                      },
                    ]}
                  >
                    {typeItem.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Form Input Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                marginTop: spacing.md,
                padding: spacing.md,
              },
            ]}
          >
            {/* 1. URL */}
            {genState.type === 'url' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  Web Sitesi / URL
                </Text>
                <TextInput
                  value={genState.url}
                  onChangeText={(val) => setGenState((prev) => ({ ...prev, url: val }))}
                  placeholder="https://ornek.com"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                />
              </View>
            )}

            {/* 2. Plain Text */}
            {genState.type === 'text' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  Metin İçeriği
                </Text>
                <TextInput
                  value={genState.text}
                  onChangeText={(val) => setGenState((prev) => ({ ...prev, text: val }))}
                  placeholder="Herhangi bir metin, not veya açıklama..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={4}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                />
              </View>
            )}

            {/* 3. Wi-Fi */}
            {genState.type === 'wifi' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  Wi-Fi Ağ Bilgileri
                </Text>

                <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: spacing.sm }]}>
                  Ağ Adı (SSID)
                </Text>
                <TextInput
                  value={genState.wifi.ssid}
                  onChangeText={(val) =>
                    setGenState((prev) => ({ ...prev, wifi: { ...prev.wifi, ssid: val } }))
                  }
                  placeholder="Wi-Fi Ağ Adı"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xxs,
                      padding: spacing.md,
                    },
                  ]}
                />

                <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: spacing.sm }]}>
                  Şifre
                </Text>
                <TextInput
                  value={genState.wifi.password}
                  onChangeText={(val) =>
                    setGenState((prev) => ({ ...prev, wifi: { ...prev.wifi, password: val } }))
                  }
                  placeholder="Ağ Şifresi"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={false}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xxs,
                      padding: spacing.md,
                    },
                  ]}
                />

                {/* Encryption buttons */}
                <View style={[styles.inlineChipsRow, { marginTop: spacing.sm }]}>
                  {(['WPA', 'WEP', 'nopass'] as const).map((enc) => {
                    const isSelected = genState.wifi.encryption === enc;
                    const encLabel = enc === 'nopass' ? 'Şifresiz' : enc;
                    return (
                      <TouchableOpacity
                        key={enc}
                        onPress={() =>
                          setGenState((prev) => ({ ...prev, wifi: { ...prev.wifi, encryption: enc } }))
                        }
                        style={[
                          styles.miniChip,
                          {
                            backgroundColor: isSelected ? theme.primaryContainer : theme.surfaceVariant,
                            borderColor: isSelected ? theme.primary : theme.cardBorder,
                            borderRadius: borderRadius.sm,
                            paddingVertical: 6,
                            paddingHorizontal: spacing.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.labelSmall,
                            { color: isSelected ? theme.onPrimaryContainer : theme.textPrimary },
                          ]}
                        >
                          {encLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 4. Phone */}
            {genState.type === 'phone' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  Telefon Numarası
                </Text>
                <TextInput
                  value={genState.phone}
                  onChangeText={(val) => setGenState((prev) => ({ ...prev, phone: val }))}
                  placeholder="+90 555 123 4567"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                />
              </View>
            )}

            {/* 5. Email */}
            {genState.type === 'email' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  E-Posta Şablonu
                </Text>

                <TextInput
                  value={genState.email.email}
                  onChangeText={(val) =>
                    setGenState((prev) => ({ ...prev, email: { ...prev.email, email: val } }))
                  }
                  placeholder="alici@ornek.com"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                />

                <TextInput
                  value={genState.email.subject}
                  onChangeText={(val) =>
                    setGenState((prev) => ({ ...prev, email: { ...prev.email, subject: val } }))
                  }
                  placeholder="Konu (İsteğe bağlı)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                />

                <TextInput
                  value={genState.email.body}
                  onChangeText={(val) =>
                    setGenState((prev) => ({ ...prev, email: { ...prev.email, body: val } }))
                  }
                  placeholder="Mesaj Gövdesi..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                />
              </View>
            )}
          </View>

          {/* Style & Color Customization Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                marginTop: spacing.sm,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Renk ve Görünüm
            </Text>

            {/* Presets */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.colorPresetsRow, { marginTop: spacing.sm }]}
            >
              {COLOR_PRESETS.map((preset) => {
                const isSelected = genState.fgColor === preset.fg && genState.bgColor === preset.bg;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() =>
                      setGenState((prev) => ({ ...prev, fgColor: preset.fg, bgColor: preset.bg }))
                    }
                    style={[
                      styles.presetItem,
                      {
                        backgroundColor: preset.bg,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderWidth: isSelected ? 2 : 1,
                        borderRadius: borderRadius.md,
                        padding: 8,
                      },
                    ]}
                  >
                    <View style={[styles.presetDot, { backgroundColor: preset.fg }]} />
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: preset.bg === '#0F172A' ? '#FFFFFF' : '#1E293B', marginTop: 4, fontSize: 10 },
                      ]}
                    >
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Error Correction Level */}
            <View style={[styles.ecRow, { marginTop: spacing.md }]}>
              <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
                Hata Düzeltme (EC Level):
              </Text>
              <View style={styles.ecChips}>
                {(['L', 'M', 'Q', 'H'] as QrCorrectionLevel[]).map((lvl) => {
                  const isSelected = genState.correctionLevel === lvl;
                  return (
                    <TouchableOpacity
                      key={lvl}
                      onPress={() => setGenState((prev) => ({ ...prev, correctionLevel: lvl }))}
                      style={[
                        styles.miniEcChip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                          borderRadius: borderRadius.xs,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: isSelected ? theme.onPrimary : theme.textPrimary },
                        ]}
                      >
                        {lvl}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Live QR Preview & Actions Card */}
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                marginTop: spacing.md,
                padding: spacing.lg,
                alignItems: 'center',
              },
            ]}
          >
            <View
              style={[
                styles.qrDisplayBox,
                {
                  backgroundColor: genState.bgColor,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.lg,
                  padding: spacing.md,
                },
              ]}
            >
              {qrPreviewUri ? (
                <Image
                  source={{ uri: qrPreviewUri }}
                  style={{ width: 220, height: 220 }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{ width: 220, height: 220, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                    QR Kodu Oluşturuluyor...
                  </Text>
                </View>
              )}
            </View>

            {/* Payload preview snippet */}
            <Text
              style={[
                typography.mono,
                typography.bodySmall,
                { color: theme.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
              ]}
              numberOfLines={2}
            >
              {currentPayload}
            </Text>

            {/* Action Buttons Row */}
            <View style={[styles.actionButtonsGrid, { marginTop: spacing.md }]}>
              <TouchableOpacity
                onPress={handleDownloadPng}
                disabled={isGenerating || !currentPayload}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="PNG İndir veya Paylaş"
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color={theme.onPrimary} />
                    <Text
                      style={[
                        typography.labelLarge,
                        { color: theme.onPrimary, marginLeft: spacing.xs },
                      ]}
                    >
                      PNG İndir / Paylaş
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDownloadSvg}
                disabled={isGenerating || !currentPayload}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="SVG Vektör İndir"
              >
                <Ionicons name="code-download-outline" size={18} color={theme.textPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  SVG Vektör
                </Text>
              </TouchableOpacity>
            </View>

            {/* Copy Payload Button */}
            <TouchableOpacity
              onPress={handleCopyPayload}
              style={[
                styles.copyBtn,
                { borderTopColor: theme.divider, marginTop: spacing.sm },
              ]}
            >
              <Ionicons
                name={copiedNotification ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={copiedNotification ? theme.success : theme.textSecondary}
              />
              <Text
                style={[
                  typography.labelMedium,
                  {
                    color: copiedNotification ? theme.success : theme.textSecondary,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                {copiedNotification ? 'İçerik Kopyalandı!' : 'Metni / Bağlantıyı Kopyala'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SCANNER */}
      {/* ========================================================================= */}
      {activeTab === 'scanner' && (
        <View style={{ marginTop: spacing.md }}>
          <View
            style={[
              styles.scannerHeroCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.xl,
                alignItems: 'center',
              },
            ]}
          >
            <View
              style={[
                styles.scanIconCircle,
                {
                  backgroundColor: theme.primaryContainer,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <Ionicons name="scan-circle-outline" size={54} color={theme.onPrimaryContainer} />
            </View>

            <Text
              style={[
                typography.titleMedium,
                { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              QR Kod & Barkod Okuyucu
            </Text>

            <Text
              style={[
                typography.bodyMedium,
                {
                  color: theme.textSecondary,
                  marginTop: spacing.xs,
                  textAlign: 'center',
                  lineHeight: 20,
                },
              ]}
            >
              Cihazınızdaki fotoğraf galerisinden veya kameranızdan anında QR kod, EAN-13, Code 128 barkodlarını çözümleyin.
            </Text>

            {/* Trigger Scan Buttons */}
            <View style={[styles.scanButtonsRow, { marginTop: spacing.lg }]}>
              <TouchableOpacity
                onPress={handleCaptureScanPhoto}
                disabled={isScanning}
                style={[
                  styles.scanActionBtn,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                  },
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="camera" size={22} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Kamera ile Tara
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePickScanImage}
                disabled={isScanning}
                style={[
                  styles.scanActionBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                  },
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="images-outline" size={22} color={theme.textPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Galeriden Seç
                </Text>
              </TouchableOpacity>
            </View>

            {isScanning && (
              <View style={[styles.loadingBox, { marginTop: spacing.md }]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text
                  style={[
                    typography.labelMedium,
                    { color: theme.primary, marginLeft: spacing.xs },
                  ]}
                >
                  Görsel taranıyor ve çözümleniyor...
                </Text>
              </View>
            )}
          </View>

          {/* Scanned Result Display */}
          {scannedResult && (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.success,
                  borderRadius: borderRadius.xl,
                  marginTop: spacing.md,
                  padding: spacing.lg,
                },
              ]}
            >
              {/* Type Badge & Format */}
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.typePill,
                    {
                      backgroundColor: theme.successContainer,
                      borderRadius: borderRadius.sm,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xxs,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: theme.success, marginLeft: 4, fontWeight: '700' },
                    ]}
                  >
                    {scannedResult.parsedDetails?.title || 'Okunan İçerik'} ({scannedResult.format})
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                  {new Date(scannedResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Wi-Fi Special Details */}
              {scannedResult.type === 'wifi' && scannedResult.parsedDetails && (
                <View
                  style={[
                    styles.wifiBox,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={styles.wifiRow}>
                    <Text style={[typography.labelSmall, { color: theme.textMuted }]}>Ağ Adı (SSID):</Text>
                    <Text style={[typography.titleSmall, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                      {scannedResult.parsedDetails.ssid}
                    </Text>
                  </View>
                  <View style={[styles.wifiRow, { marginTop: spacing.xs }]}>
                    <Text style={[typography.labelSmall, { color: theme.textMuted }]}>Şifre:</Text>
                    <Text
                      style={[
                        typography.mono,
                        typography.titleSmall,
                        { color: theme.textPrimary, marginLeft: spacing.xs },
                      ]}
                    >
                      {scannedResult.parsedDetails.password || '(Şifresiz)'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Raw Decoded Content */}
              <View
                style={[
                  styles.decodedContentBox,
                  {
                    backgroundColor: theme.inputBackground,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.sm,
                    padding: spacing.md,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.bodyMedium,
                    typography.mono,
                    { color: theme.textPrimary },
                  ]}
                  selectable
                >
                  {scannedResult.data}
                </Text>
              </View>

              {/* Action Buttons for Scanned Data */}
              <View style={[styles.resultActionsRow, { marginTop: spacing.md }]}>
                {scannedResult.type === 'url' && (
                  <TouchableOpacity
                    onPress={() => handleOpenLink(scannedResult.data)}
                    style={[
                      styles.resultBtn,
                      {
                        backgroundColor: theme.primary,
                        borderRadius: borderRadius.md,
                        paddingVertical: spacing.md,
                      },
                    ]}
                  >
                    <Ionicons name="open-outline" size={18} color={theme.onPrimary} />
                    <Text
                      style={[
                        typography.labelLarge,
                        { color: theme.onPrimary, marginLeft: spacing.xs },
                      ]}
                    >
                      Tarayıcıda Aç
                    </Text>
                  </TouchableOpacity>
                )}

                {scannedResult.type === 'phone' && (
                  <TouchableOpacity
                    onPress={() => handleOpenLink(scannedResult.data)}
                    style={[
                      styles.resultBtn,
                      {
                        backgroundColor: theme.success,
                        borderRadius: borderRadius.md,
                        paddingVertical: spacing.md,
                      },
                    ]}
                  >
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                    <Text
                      style={[
                        typography.labelLarge,
                        { color: '#FFFFFF', marginLeft: spacing.xs },
                      ]}
                    >
                      Numarayı Ara
                    </Text>
                  </TouchableOpacity>
                )}

                {scannedResult.type === 'email' && (
                  <TouchableOpacity
                    onPress={() => handleOpenLink(scannedResult.data)}
                    style={[
                      styles.resultBtn,
                      {
                        backgroundColor: theme.accent,
                        borderRadius: borderRadius.md,
                        paddingVertical: spacing.md,
                      },
                    ]}
                  >
                    <Ionicons name="mail" size={18} color="#FFFFFF" />
                    <Text
                      style={[
                        typography.labelLarge,
                        { color: '#FFFFFF', marginLeft: spacing.xs },
                      ]}
                    >
                      E-Posta Gönder
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={async () => {
                    await Clipboard.setStringAsync(scannedResult.data);
                    Alert.alert('Kopyalandı', 'İçerik panoya kopyalandı.');
                  }}
                  style={[
                    styles.resultBtn,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="copy-outline" size={18} color={theme.textPrimary} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.textPrimary, marginLeft: spacing.xs },
                    ]}
                  >
                    Panoya Kopyala
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.historyHeader}>
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Tarama Geçmişi ({scanHistory.length})
            </Text>
            {scanHistory.length > 0 && (
              <TouchableOpacity onPress={handleClearAllHistory}>
                <Text style={[typography.labelSmall, { color: theme.error }]}>
                  Tümünü Temizle
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {scanHistory.length === 0 ? (
            <View
              style={[
                styles.emptyHistoryBox,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.lg,
                  marginTop: spacing.sm,
                  padding: spacing.xl,
                  alignItems: 'center',
                },
              ]}
            >
              <Ionicons name="time-outline" size={40} color={theme.textMuted} />
              <Text style={[typography.bodyMedium, { color: theme.textMuted, marginTop: spacing.sm }]}>
                Henüz taranmış bir kod bulunmuyor.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              {scanHistory.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyItemCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.cardBorder,
                      borderRadius: borderRadius.md,
                      marginBottom: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={styles.historyItemHeader}>
                    <View style={styles.historyTypeRow}>
                      <Ionicons
                        name={
                          item.type === 'url'
                            ? 'globe-outline'
                            : item.type === 'wifi'
                            ? 'wifi-outline'
                            : item.type === 'phone'
                            ? 'call-outline'
                            : item.type === 'email'
                            ? 'mail-outline'
                            : 'document-text-outline'
                        }
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: theme.primary, marginLeft: 4, fontWeight: '700' },
                        ]}
                      >
                        {item.parsedDetails?.title || item.type.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[typography.bodySmall, { color: theme.textMuted, fontSize: 11 }]}>
                      {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <Text
                    style={[
                      typography.mono,
                      typography.bodySmall,
                      { color: theme.textPrimary, marginTop: spacing.xs },
                    ]}
                    numberOfLines={2}
                  >
                    {item.data}
                  </Text>

                  {/* Actions */}
                  <View style={[styles.historyActionsRow, { marginTop: spacing.sm }]}>
                    {item.type === 'url' && (
                      <TouchableOpacity
                        onPress={() => handleOpenLink(item.data)}
                        style={[
                          styles.miniActionBtn,
                          { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.xs },
                        ]}
                      >
                        <Ionicons name="open-outline" size={14} color={theme.onPrimaryContainer} />
                        <Text
                          style={[
                            typography.labelSmall,
                            { color: theme.onPrimaryContainer, marginLeft: 2 },
                          ]}
                        >
                          Aç
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={async () => {
                        await Clipboard.setStringAsync(item.data);
                        Alert.alert('Kopyalandı', 'Panoya kopyalandı.');
                      }}
                      style={[
                        styles.miniActionBtn,
                        { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.xs },
                      ]}
                    >
                      <Ionicons name="copy-outline" size={14} color={theme.textPrimary} />
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: theme.textPrimary, marginLeft: 2 },
                        ]}
                      >
                        Kopyala
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteHistory(item.id)}
                      style={[
                        styles.miniActionBtn,
                        { backgroundColor: theme.errorContainer, borderRadius: borderRadius.xs },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.onErrorContainer} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  card: {
    borderWidth: 1,
  },
  textInput: {
    borderWidth: 1,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inlineChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniChip: {
    borderWidth: 1,
  },
  colorPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  presetItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  presetDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  ecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ecChips: {
    flexDirection: 'row',
    gap: 6,
  },
  miniEcChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewCard: {
    borderWidth: 1,
  },
  qrDisplayBox: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    width: '100%',
    borderTopWidth: 1,
  },
  scannerHeroCard: {
    borderWidth: 1,
  },
  scanIconCircle: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  scanActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultCard: {
    borderWidth: 1.5,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wifiBox: {
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  wifiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  decodedContentBox: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyHistoryBox: {
    borderWidth: 1,
  },
  historyItemCard: {
    borderWidth: 1,
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
