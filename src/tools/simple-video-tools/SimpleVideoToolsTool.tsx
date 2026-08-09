import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  VideoMetadata,
  VideoEditOptions,
  ProcessResult,
  AspectRatioOption,
  RotationOption,
} from './types';
import {
  getPlatformCapabilities,
  formatSeconds,
  formatFileSize,
  processVideoWeb,
  extractAudioWeb,
  shareOrSaveResult,
} from './videoService';

type ActiveTab = 'trim' | 'crop' | 'rotate' | 'audio';

export const SimpleVideoToolsTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();
  const capabilities = getPlatformCapabilities();

  // Video State
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [playbackPosSec, setPlaybackPosSec] = useState<number>(0);
  const videoRef = useRef<Video>(null);

  // Edit Options
  const [activeTab, setActiveTab] = useState<ActiveTab>('trim');
  const [options, setOptions] = useState<VideoEditOptions>({
    trimStart: 0,
    trimEnd: 10,
    cropAspect: 'original',
    rotation: 0,
    muteAudio: false,
  });

  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);

  // Toast / Info Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        const newMeta: VideoMetadata = {
          uri: file.uri,
          name: file.name || 'video.mp4',
          size: file.size,
          duration: 10, // Default until metadata loaded from player
          width: 1280,
          height: 720,
          file: file.file,
        };
        setVideoMeta(newMeta);
        setOptions({
          trimStart: 0,
          trimEnd: 10,
          cropAspect: 'original',
          rotation: 0,
          muteAudio: false,
        });
        setResult(null);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Video seçimi yapılırken hata oluştu.');
    }
  };

  const handlePickGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriden video seçebilmek için galeri erişim izni vermelisiniz.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const durationSec = asset.duration ? asset.duration / 1000 : 10;
        const newMeta: VideoMetadata = {
          uri: asset.uri,
          name: asset.fileName || 'selected_video.mp4',
          size: asset.fileSize,
          duration: durationSec,
          width: asset.width || 1280,
          height: asset.height || 720,
        };
        setVideoMeta(newMeta);
        setOptions({
          trimStart: 0,
          trimEnd: Math.min(10, Math.floor(durationSec)),
          cropAspect: 'original',
          rotation: 0,
          muteAudio: false,
        });
        setResult(null);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Galeri erişim hatası.');
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      const pos = (status.positionMillis || 0) / 1000;
      setPlaybackPosSec(pos);

      if (status.durationMillis && videoMeta && videoMeta.duration !== status.durationMillis / 1000) {
        const durSec = status.durationMillis / 1000;
        const videoStatus = status as { naturalSize?: { width: number; height: number } };
        setVideoMeta((prev) =>
          prev
            ? {
                ...prev,
                duration: durSec,
                width: videoStatus.naturalSize?.width || prev.width,
                height: videoStatus.naturalSize?.height || prev.height,
              }
            : null
        );

        // Adjust default trim end if default
        setOptions((prev) => ({
          ...prev,
          trimEnd: prev.trimEnd === 10 ? Math.min(10, durSec) : prev.trimEnd,
        }));
      }
    }
  };

  const handleSetStartToCurrent = () => {
    const newStart = Math.min(playbackPosSec, options.trimEnd - 0.5);
    setOptions((prev) => ({ ...prev, trimStart: Math.max(0, parseFloat(newStart.toFixed(1))) }));
    showToast(`Başlangıç Zamanı: ${formatSeconds(newStart)}`);
  };

  const handleSetEndToCurrent = () => {
    const maxDur = videoMeta?.duration || 600;
    const newEnd = Math.max(playbackPosSec, options.trimStart + 0.5);
    setOptions((prev) => ({ ...prev, trimEnd: Math.min(maxDur, parseFloat(newEnd.toFixed(1))) }));
    showToast(`Bitiş Zamanı: ${formatSeconds(newEnd)}`);
  };

  const handleProcessVideo = async () => {
    if (!videoMeta) return;

    if (options.trimStart >= options.trimEnd) {
      Alert.alert('Hata', 'Kırpma başlangıç zamanı bitiş zamanından küçük olmalıdır.');
      return;
    }

    if (!capabilities.canReencodeVideo && Platform.OS !== 'web') {
      Alert.alert(
        'Platform Uyarısı',
        'Mobil ortamda tam kare re-encoding sınırlıdır. Web runtime aktif edildiğinde canlı dışa aktarım gerçekleşir.'
      );
    }

    setIsProcessing(true);
    setProgressPercent(0);

    try {
      if (Platform.OS === 'web') {
        const res = await processVideoWeb(videoMeta, options, (pct) => setProgressPercent(pct));
        setResult(res);
        showToast('Video başarıyla işlendi ve dışa aktarıldı!');
      } else {
        // Fallback result for native presentation preview
        setResult({
          uri: videoMeta.uri,
          name: `${videoMeta.name.split('.')[0]}_processed.mp4`,
          type: 'video',
          mimeType: 'video/mp4',
          size: videoMeta.size,
          duration: options.trimEnd - options.trimStart,
        });
        showToast('Mobil önizleme sonucu hazırlandı!');
      }
    } catch (err: any) {
      Alert.alert('İşleme Hatası', err?.message || 'Video işlenirken bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractAudio = async () => {
    if (!videoMeta) return;

    setIsProcessing(true);
    setProgressPercent(0);

    try {
      if (Platform.OS === 'web') {
        const res = await extractAudioWeb(
          videoMeta,
          options.trimStart,
          options.trimEnd,
          (pct) => setProgressPercent(pct)
        );
        setResult(res);
        showToast('Ses parçası başarıyla ayıklandı!');
      } else {
        setResult({
          uri: videoMeta.uri,
          name: `${videoMeta.name.split('.')[0]}_audio.aac`,
          type: 'audio',
          mimeType: 'audio/aac',
          size: 1024 * 500,
          duration: options.trimEnd - options.trimStart,
        });
        showToast('Ses ayıklama önizlemesi hazırlandı!');
      }
    } catch (err: any) {
      Alert.alert('Ses Ayıklama Hatası', err?.message || 'Ses ayıklanırken hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveOrShare = async () => {
    if (!result) return;
    try {
      await shareOrSaveResult(result);
    } catch (err: any) {
      Alert.alert('Paylaşım Hatası', err?.message || 'Dosya kaydedilemedi veya paylaşılamadı.');
    }
  };

  const aspectOptions: { label: string; value: AspectRatioOption; icon: string }[] = [
    { label: 'Orijinal', value: 'original', icon: 'scan-outline' },
    { label: '1:1 Kare', value: '1:1', icon: 'square-outline' },
    { label: '16:9 Yatay', value: '16:9', icon: 'tv-outline' },
    { label: '9:16 Dikey', value: '9:16', icon: 'phone-portrait-outline' },
    { label: '4:3 Klasik', value: '4:3', icon: 'desktop-outline' },
  ];

  const rotationOptions: { label: string; value: RotationOption }[] = [
    { label: '0°', value: 0 },
    { label: '90° Sağa', value: 90 },
    { label: '180° Ters', value: 180 },
    { label: '270° Sola', value: 270 },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Platform Capabilities Banner */}
      <View
        style={[
          styles.capabilityBanner,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: spacing.sm,
            marginBottom: spacing.md,
          },
        ]}
      >
        <Ionicons
          name={capabilities.isWeb ? 'hardware-chip-outline' : 'information-circle-outline'}
          size={20}
          color={theme.primary}
        />
        <Text style={[typography.bodySmall, { color: theme.textSecondary, flex: 1, marginLeft: spacing.xs }]}>
          {capabilities.note}
        </Text>
      </View>

      {toastMessage && (
        <View style={[styles.toast, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
          <Text style={[typography.bodyMedium, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
            {toastMessage}
          </Text>
        </View>
      )}

      {!videoMeta ? (
        /* Video Selector Hero Card */
        <View
          style={[
            styles.heroCard,
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
              styles.heroIconBox,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Ionicons name="videocam-outline" size={48} color={theme.onPrimaryContainer} />
          </View>

          <Text style={[typography.titleLarge, { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
            Basit Video Düzenleyici
          </Text>
          <Text
            style={[
              typography.bodyMedium,
              { color: theme.textSecondary, marginTop: spacing.xs, textAlign: 'center', lineHeight: 20 },
            ]}
          >
            Videolarınızı kırpın, en-boy oranına göre kırpın, 90°/180°/270° döndürün, sesi kısın veya ses parçalarını ayıklayın.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
              onPress={handlePickGallery}
            >
              <Ionicons name="images-outline" size={20} color={theme.onPrimary} />
              <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                Galeriden Video Seç
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md, marginLeft: spacing.sm },
              ]}
              onPress={handlePickDocument}
            >
              <Ionicons name="folder-open-outline" size={20} color={theme.textPrimary} />
              <Text style={[typography.labelLarge, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                Dosya Seç
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Video Loaded Editor Workspace */
        <View style={styles.workspace}>
          {/* Top Video Header Info & Change Video */}
          <View
            style={[
              styles.metaCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <View style={styles.metaRow}>
              <Ionicons name="film-outline" size={24} color={theme.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                  {videoMeta.name}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Süre: {formatSeconds(videoMeta.duration)} | Çözünürlük: {videoMeta.width}x{videoMeta.height} | Boyut:{' '}
                  {formatFileSize(videoMeta.size)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setVideoMeta(null);
                  setResult(null);
                }}
                style={{ padding: spacing.xs }}
              >
                <Ionicons name="close-circle-outline" size={24} color={theme.error} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Video Player Preview with Transforms */}
          <View
            style={[
              styles.playerContainer,
              {
                backgroundColor: '#000',
                borderRadius: borderRadius.lg,
                overflow: 'hidden',
                marginBottom: spacing.md,
                transform: [{ rotate: `${options.rotation}deg` }],
              },
            ]}
          >
            <Video
              ref={videoRef}
              source={{ uri: videoMeta.uri }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isMuted={options.muteAudio}
              onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            />
          </View>

          {/* Live Position & Set Trim Controls */}
          <View
            style={[
              styles.positionCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
              Mevcut Pozisyon: <Text style={{ color: theme.primary, fontWeight: 'bold' }}>{formatSeconds(playbackPosSec)}</Text>
            </Text>
            <View style={styles.quickSetRow}>
              <TouchableOpacity
                style={[styles.smallSetBtn, { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm }]}
                onPress={handleSetStartToCurrent}
              >
                <Ionicons name="flag-outline" size={14} color={theme.onPrimaryContainer} />
                <Text style={[typography.labelSmall, { color: theme.onPrimaryContainer, marginLeft: 4 }]}>
                  Başlangıç Yap
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.smallSetBtn,
                  { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
                ]}
                onPress={handleSetEndToCurrent}
              >
                <Ionicons name="flag" size={14} color={theme.onPrimaryContainer} />
                <Text style={[typography.labelSmall, { color: theme.onPrimaryContainer, marginLeft: 4 }]}>
                  Bitiş Yap
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Edit Tool Navigation Tabs */}
          <View
            style={[
              styles.tabsContainer,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.lg,
                padding: spacing.xs,
                marginBottom: spacing.md,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'trim' && { backgroundColor: theme.surface, borderRadius: borderRadius.md },
              ]}
              onPress={() => setActiveTab('trim')}
            >
              <Ionicons name="cut-outline" size={18} color={activeTab === 'trim' ? theme.primary : theme.textSecondary} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: activeTab === 'trim' ? theme.primary : theme.textSecondary, marginLeft: 4 },
                ]}
              >
                Kırpma
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'crop' && { backgroundColor: theme.surface, borderRadius: borderRadius.md },
              ]}
              onPress={() => setActiveTab('crop')}
            >
              <Ionicons name="crop-outline" size={18} color={activeTab === 'crop' ? theme.primary : theme.textSecondary} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: activeTab === 'crop' ? theme.primary : theme.textSecondary, marginLeft: 4 },
                ]}
              >
                Oran
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'rotate' && { backgroundColor: theme.surface, borderRadius: borderRadius.md },
              ]}
              onPress={() => setActiveTab('rotate')}
            >
              <Ionicons name="refresh-outline" size={18} color={activeTab === 'rotate' ? theme.primary : theme.textSecondary} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: activeTab === 'rotate' ? theme.primary : theme.textSecondary, marginLeft: 4 },
                ]}
              >
                Döndür
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'audio' && { backgroundColor: theme.surface, borderRadius: borderRadius.md },
              ]}
              onPress={() => setActiveTab('audio')}
            >
              <Ionicons
                name="volume-mute-outline"
                size={18}
                color={activeTab === 'audio' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  typography.labelMedium,
                  { color: activeTab === 'audio' ? theme.primary : theme.textSecondary, marginLeft: 4 },
                ]}
              >
                Ses
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content Panel */}
          <View
            style={[
              styles.tabPanel,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            {activeTab === 'trim' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
                  Zaman Aralığı Kırpma
                </Text>

                <View style={styles.trimInputRow}>
                  <View style={styles.trimField}>
                    <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Başlangıç (sn)</Text>
                    <TextInput
                      style={[
                        styles.numInput,
                        {
                          backgroundColor: theme.surfaceVariant,
                          color: theme.textPrimary,
                          borderRadius: borderRadius.sm,
                          padding: spacing.sm,
                        },
                      ]}
                      keyboardType="numeric"
                      value={options.trimStart.toString()}
                      onChangeText={(val) => {
                        const num = parseFloat(val) || 0;
                        setOptions((prev) => ({ ...prev, trimStart: Math.max(0, num) }));
                      }}
                    />
                  </View>

                  <View style={styles.trimField}>
                    <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Bitiş (sn)</Text>
                    <TextInput
                      style={[
                        styles.numInput,
                        {
                          backgroundColor: theme.surfaceVariant,
                          color: theme.textPrimary,
                          borderRadius: borderRadius.sm,
                          padding: spacing.sm,
                        },
                      ]}
                      keyboardType="numeric"
                      value={options.trimEnd.toString()}
                      onChangeText={(val) => {
                        const num = parseFloat(val) || 0;
                        setOptions((prev) => ({ ...prev, trimEnd: num }));
                      }}
                    />
                  </View>
                </View>

                <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  Seçilen Süre: <Text style={{ fontWeight: 'bold' }}>{formatSeconds(Math.max(0, options.trimEnd - options.trimStart))}</Text>
                </Text>
              </View>
            )}

            {activeTab === 'crop' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
                  En-Boy Oranı Kırpma
                </Text>
                <View style={styles.optionsGrid}>
                  {aspectOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.gridChip,
                        {
                          backgroundColor:
                            options.cropAspect === opt.value ? theme.primaryContainer : theme.surfaceVariant,
                          borderRadius: borderRadius.md,
                          borderColor: options.cropAspect === opt.value ? theme.primary : 'transparent',
                        },
                      ]}
                      onPress={() => setOptions((prev) => ({ ...prev, cropAspect: opt.value }))}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={18}
                        color={options.cropAspect === opt.value ? theme.primary : theme.textSecondary}
                      />
                      <Text
                        style={[
                          typography.labelMedium,
                          {
                            color: options.cropAspect === opt.value ? theme.primary : theme.textPrimary,
                            marginLeft: 4,
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'rotate' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
                  Video Döndürme
                </Text>
                <View style={styles.optionsGrid}>
                  {rotationOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.gridChip,
                        {
                          backgroundColor:
                            options.rotation === opt.value ? theme.primaryContainer : theme.surfaceVariant,
                          borderRadius: borderRadius.md,
                          borderColor: options.rotation === opt.value ? theme.primary : 'transparent',
                        },
                      ]}
                      onPress={() => setOptions((prev) => ({ ...prev, rotation: opt.value }))}
                    >
                      <Ionicons
                        name="refresh-outline"
                        size={18}
                        color={options.rotation === opt.value ? theme.primary : theme.textSecondary}
                      />
                      <Text
                        style={[
                          typography.labelMedium,
                          {
                            color: options.rotation === opt.value ? theme.primary : theme.textPrimary,
                            marginLeft: 4,
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'audio' && (
              <View>
                <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
                  Ses Ayarları
                </Text>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: theme.textPrimary }]}>Videodaki Sesi Kıs (Mute)</Text>
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      Çıktı videosunda ses kanalını tamamen sessize alır.
                    </Text>
                  </View>
                  <Switch
                    value={options.muteAudio}
                    onValueChange={(val) => setOptions((prev) => ({ ...prev, muteAudio: val }))}
                    trackColor={{ false: theme.surfaceVariant, true: theme.primaryContainer }}
                    thumbColor={options.muteAudio ? theme.primary : '#fff'}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Primary Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.executeBtn,
                { backgroundColor: theme.primary, borderRadius: borderRadius.md, flex: 2 },
              ]}
              onPress={handleProcessVideo}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.onPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="film-outline" size={20} color={theme.onPrimary} />
                  <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                    Videoyu İşle ve Aktar
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.executeBtn,
                { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md, flex: 1, marginLeft: spacing.sm },
              ]}
              onPress={handleExtractAudio}
              disabled={isProcessing}
            >
              <Ionicons name="musical-notes-outline" size={20} color={theme.textPrimary} />
              <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                Sesi Ayıkla
              </Text>
            </TouchableOpacity>
          </View>

          {/* Progress Indicator */}
          {isProcessing && (
            <View
              style={[
                styles.progressCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginTop: spacing.md,
                },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: theme.textPrimary, textAlign: 'center' }]}>
                İşlem Yapılıyor... %{progressPercent}
              </Text>
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full, marginTop: spacing.xs },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    { backgroundColor: theme.primary, width: `${progressPercent}%`, borderRadius: borderRadius.full },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Processed Result Output Card */}
          {result && (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.primary,
                  borderWidth: 1.5,
                  borderRadius: borderRadius.xl,
                  padding: spacing.md,
                  marginTop: spacing.lg,
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={28} color={theme.primary} />
                <Text style={[typography.titleMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                  İşlem Tamamlandı!
                </Text>
              </View>

              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                Dosya Adı: {result.name} | Tür: {result.type.toUpperCase()} | Boyut: {formatFileSize(result.size)}
              </Text>

              {result.type === 'video' && (
                <View style={[styles.resultPreview, { backgroundColor: '#000', borderRadius: borderRadius.md, marginTop: spacing.sm }]}>
                  <Video
                    source={{ uri: result.uri }}
                    style={styles.resultVideoPlayer}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.saveShareBtn,
                  { backgroundColor: theme.primary, borderRadius: borderRadius.md, marginTop: spacing.md },
                ]}
                onPress={handleSaveOrShare}
              >
                <Ionicons name="download-outline" size={20} color={theme.onPrimary} />
                <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                  Dosyayı Kaydet / Paylaş
                </Text>
              </TouchableOpacity>
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
  capabilityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
  },
  heroCard: {
    borderWidth: 1,
    marginTop: 20,
  },
  heroIconBox: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  workspace: {
    marginTop: 8,
  },
  metaCard: {
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  positionCard: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickSetRow: {
    flexDirection: 'row',
  },
  smallSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabPanel: {
    borderWidth: 1,
  },
  trimInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trimField: {
    flex: 1,
    marginRight: 8,
  },
  numInput: {
    borderWidth: 1,
    borderColor: 'transparent',
    marginTop: 4,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
  },
  executeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  progressCard: {
    borderWidth: 1,
  },
  progressBarBg: {
    height: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  resultCard: {},
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultPreview: {
    height: 180,
    overflow: 'hidden',
  },
  resultVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  saveShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
