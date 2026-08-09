import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  AudioMetadata,
  ExportAudioFormat,
  ProcessedAudioResult,
  RingtonePresetType,
  TrimConfig,
} from './types';
import {
  RegionAudioPlayer,
  SAMPLE_AUDIO_PRESETS,
  decodeAudioFromUri,
  encodeAudioBufferToWav,
  generateProceduralSampleAudio,
  processTrimmedAudio,
  shareProcessedAudio,
} from './audioEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AudioTrimmerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Loaded Audio State
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);

  // Trimmer Configuration State
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(10);
  const [fadeInSec, setFadeInSec] = useState<number>(0.5);
  const [fadeOutSec, setFadeOutSec] = useState<number>(1.0);
  const [gain, setGain] = useState<number>(1.0);
  const [exportFormat, setExportFormat] = useState<ExportAudioFormat>('wav');
  const [presetType, setPresetType] = useState<RingtonePresetType>('ringtone');

  // Playback & Scrubber State
  const [isPlayingRegion, setIsPlayingRegion] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [currentPlayheadTime, setCurrentPlayheadTime] = useState<number>(0);

  // Export Modal State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<ProcessedAudioResult | null>(null);
  const [sampleModalVisible, setSampleModalVisible] = useState<boolean>(false);

  const playerRef = useRef<RegionAudioPlayer>(new RegionAudioPlayer());

  // Load default demo sample melody on mount for zero-setup demonstration
  useEffect(() => {
    handleLoadSample('sample_melody');
    return () => {
      playerRef.current.stop();
    };
  }, []);

  // Load one of the procedural sample melodies
  const handleLoadSample = (sampleId: string) => {
    playerRef.current.stop();
    setIsPlayingRegion(false);

    const { audioBuffer: buf, metadata, peaks } = generateProceduralSampleAudio(sampleId);
    setAudioBuffer(buf);
    setAudioMetadata(metadata);
    setWaveformPeaks(peaks);

    setStartTime(0);
    setEndTime(Math.min(10, Math.round(metadata.duration * 10) / 10));
    setCurrentPlayheadTime(0);
    setExportResult(null);
    setSampleModalVisible(false);
  };

  // Pick audio file from device storage
  const handlePickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        loadAudioUri(asset.uri, asset.name || 'ses_dosyasi.mp3');
      }
    } catch (err) {
      console.warn('Doc picker error:', err);
      Alert.alert('Hata', 'Ses dosyası seçilirken bir sorun oluştu.');
    }
  };

  // Pick video file to extract audio on-device
  const handlePickVideoFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        loadAudioUri(asset.uri, asset.fileName || 'video_ses_cikarimi.mp4');
      }
    } catch (err) {
      console.warn('Video picker error:', err);
      Alert.alert('Hata', 'Video dosyası seçilirken bir sorun oluştu.');
    }
  };

  const loadAudioUri = async (uri: string, name: string) => {
    setIsLoadingAudio(true);
    playerRef.current.stop();
    setIsPlayingRegion(false);

    try {
      const { audioBuffer: buf, metadata, peaks } = await decodeAudioFromUri(uri, name);
      setAudioBuffer(buf);
      setAudioMetadata(metadata);
      setWaveformPeaks(peaks);

      setStartTime(0);
      setEndTime(Math.min(15, Math.round(metadata.duration * 10) / 10));
      setCurrentPlayheadTime(0);
      setExportResult(null);
    } catch (error: any) {
      console.error('Audio decode error:', error);
      Alert.alert(
        'Ses Çözme Hatası',
        'Seçilen medya dosyasının ses verisi çözümlenemedi. Lütfen geçerli bir MP3, WAV, AAC veya MP4 dosyası seçin.'
      );
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Play / Stop Region
  const handleTogglePlayRegion = () => {
    if (!audioBuffer) return;

    if (isPlayingRegion) {
      playerRef.current.stop();
      setIsPlayingRegion(false);
    } else {
      playerRef.current.play(
        audioBuffer,
        startTime,
        endTime,
        isLooping,
        (curTime) => setCurrentPlayheadTime(curTime),
        () => setIsPlayingRegion(false)
      );
      setIsPlayingRegion(true);
    }
  };

  // Adjust Start & End times with precision steps
  const handleAdjustStart = (delta: number) => {
    if (!audioMetadata) return;
    const maxStart = Math.max(0, endTime - 0.5);
    const next = Math.max(0, Math.min(maxStart, Math.round((startTime + delta) * 10) / 10));
    setStartTime(next);
    if (isPlayingRegion) {
      playerRef.current.stop();
      setIsPlayingRegion(false);
    }
  };

  const handleAdjustEnd = (delta: number) => {
    if (!audioMetadata) return;
    const minEnd = startTime + 0.5;
    const next = Math.max(
      minEnd,
      Math.min(audioMetadata.duration, Math.round((endTime + delta) * 10) / 10)
    );
    setEndTime(next);
    if (isPlayingRegion) {
      playerRef.current.stop();
      setIsPlayingRegion(false);
    }
  };

  // Click on Waveform to seek or set region
  const handleWaveformClick = (ratio: number) => {
    if (!audioMetadata) return;
    const clickedTime = Math.round(ratio * audioMetadata.duration * 10) / 10;
    const distToStart = Math.abs(clickedTime - startTime);
    const distToEnd = Math.abs(clickedTime - endTime);

    if (distToStart < distToEnd) {
      setStartTime(Math.min(clickedTime, Math.max(0, endTime - 0.5)));
    } else {
      setEndTime(Math.max(clickedTime, startTime + 0.5));
    }

    if (isPlayingRegion) {
      playerRef.current.stop();
      setIsPlayingRegion(false);
    }
  };

  // Export & Trim Audio
  const handleExportAudio = async () => {
    if (!audioBuffer || !audioMetadata) return;

    setIsExporting(true);
    playerRef.current.stop();
    setIsPlayingRegion(false);

    try {
      const config: TrimConfig = {
        startTime,
        endTime,
        fadeInSec,
        fadeOutSec,
        gain,
        format: exportFormat,
        preset: presetType,
      };

      const trimmedBuffer = processTrimmedAudio(audioBuffer, config);
      const { uri, size } = encodeAudioBufferToWav(trimmedBuffer);

      const presetPrefix =
        presetType === 'ringtone'
          ? 'Zil_Sesi'
          : presetType === 'alarm'
          ? 'Alarm'
          : presetType === 'notification'
          ? 'Bildirim'
          : 'Ses_Kesiti';

      const outputFileName = `${presetPrefix}_${Date.now()}.${exportFormat}`;

      const result: ProcessedAudioResult = {
        uri,
        fileName: outputFileName,
        fileSizeBytes: size,
        durationSec: Math.round((endTime - startTime) * 10) / 10,
        format: exportFormat,
        presetType,
      };

      setExportResult(result);
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Dışa Aktarma Hatası', 'Ses dosyası işlenirken bir sorun oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareResult = async () => {
    if (!exportResult) return;
    try {
      await shareProcessedAudio(exportResult);
    } catch (error: any) {
      Alert.alert('Hata', error?.message || 'Paylaşım gerçekleştirilemedi.');
    }
  };

  const durationSelectedSec = Math.max(0, Math.round((endTime - startTime) * 10) / 10);

  const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const rem = (sec % 60).toFixed(1);
    return `${mins > 0 ? `${mins}:` : ''}${rem.padStart(4, '0')} sn`;
  };

  const presetChips: { id: RingtonePresetType; label: string; icon: string }[] = [
    { id: 'ringtone', label: 'Zil Sesi', icon: 'call-outline' },
    { id: 'alarm', label: 'Alarm Tınısı', icon: 'alarm-outline' },
    { id: 'notification', label: 'Bildirim', icon: 'notifications-outline' },
    { id: 'custom', label: 'Özel Kesit', icon: 'cut-outline' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top File Selection & Header Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View
            style={[
              styles.headerIconBox,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Ionicons name="cut" size={26} color={theme.onPrimaryContainer} />
          </View>

          <View style={styles.headerTexts}>
            <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
              Ses Kesici & Zil Sesi Oluşturucu
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
              Milisaniye hassasiyetinde kesin, Fade-in/out ve ses yükseltme uygulayın.
            </Text>
          </View>
        </View>

        {/* Source Pick Buttons */}
        <View style={[styles.sourceButtonsRow, { marginTop: spacing.md }]}>
          <TouchableOpacity
            onPress={handlePickAudioFile}
            style={[
              styles.sourceBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.sm + 2,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ses Dosyası Seç"
          >
            <Ionicons name="musical-notes" size={18} color={theme.onPrimary} />
            <Text
              style={[
                typography.labelMedium,
                { color: theme.onPrimary, marginLeft: spacing.xs, fontWeight: '700' },
              ]}
            >
              Ses Dosyası Seç
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickVideoFile}
            style={[
              styles.sourceBtn,
              {
                backgroundColor: theme.accent,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.sm + 2,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Videodan Ses Çıkar"
          >
            <Ionicons name="videocam" size={18} color="#FFFFFF" />
            <Text
              style={[
                typography.labelMedium,
                { color: '#FFFFFF', marginLeft: spacing.xs, fontWeight: '700' },
              ]}
            >
              Videodan Çıkar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSampleModalVisible(true)}
            style={[
              styles.samplePickBtn,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Örnek Ses Seç"
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading Audio Indicator */}
      {isLoadingAudio && (
        <View style={[styles.loadingBox, { padding: spacing.xl }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text
            style={[
              typography.bodyMedium,
              { color: theme.textPrimary, marginTop: spacing.md },
            ]}
          >
            Ses dalgaları çözümleniyor ve analiz ediliyor...
          </Text>
        </View>
      )}

      {/* Main Waveform & Trimmer Controls */}
      {audioMetadata && !isLoadingAudio && (
        <View>
          {/* Waveform Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                marginTop: spacing.md,
                padding: spacing.lg,
              },
            ]}
          >
            {/* File Info Title */}
            <View style={styles.fileInfoRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {audioMetadata.name}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Toplam Süre: {formatSeconds(audioMetadata.duration)} • {audioMetadata.sampleRate} Hz
                </Text>
              </View>

              {/* Selected Length Badge */}
              <View
                style={[
                  styles.durationBadge,
                  {
                    backgroundColor: theme.primaryContainer,
                    borderRadius: borderRadius.sm,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.onPrimaryContainer, fontWeight: '700' },
                  ]}
                >
                  Kesit: {formatSeconds(durationSelectedSec)}
                </Text>
              </View>
            </View>

            {/* Interactive Waveform Visualizer */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={(e) => {
                const layoutX = e.nativeEvent.locationX;
                const totalW = SCREEN_WIDTH - 64;
                const ratio = Math.max(0, Math.min(1, layoutX / totalW));
                handleWaveformClick(ratio);
              }}
              style={[
                styles.waveformContainer,
                {
                  backgroundColor: theme.inputBackground,
                  borderRadius: borderRadius.md,
                  marginTop: spacing.md,
                },
              ]}
            >
              {/* Waveform Bars */}
              <View style={styles.waveformBarsRow}>
                {waveformPeaks.map((peak, idx) => {
                  const barTime = (idx / waveformPeaks.length) * audioMetadata.duration;
                  const isInRegion = barTime >= startTime && barTime <= endTime;

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.waveformBar,
                        {
                          height: `${Math.round(peak * 100)}%`,
                          backgroundColor: isInRegion ? theme.primary : theme.textMuted,
                          opacity: isInRegion ? 1.0 : 0.35,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              {/* Start Marker Line & Handle */}
              <View
                style={[
                  styles.regionMarker,
                  {
                    left: `${(startTime / audioMetadata.duration) * 100}%`,
                    borderColor: theme.accent,
                  },
                ]}
              >
                <View
                  style={[
                    styles.markerHandle,
                    { backgroundColor: theme.accent, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
                  ]}
                >
                  <Text style={styles.markerHandleText}>S</Text>
                </View>
              </View>

              {/* End Marker Line & Handle */}
              <View
                style={[
                  styles.regionMarker,
                  {
                    left: `${(endTime / audioMetadata.duration) * 100}%`,
                    borderColor: theme.error,
                  },
                ]}
              >
                <View
                  style={[
                    styles.markerHandle,
                    { backgroundColor: theme.error, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
                  ]}
                >
                  <Text style={styles.markerHandleText}>E</Text>
                </View>
              </View>

              {/* Live Playhead Marker */}
              {isPlayingRegion && (
                <View
                  style={[
                    styles.playheadLine,
                    {
                      left: `${(currentPlayheadTime / audioMetadata.duration) * 100}%`,
                    },
                  ]}
                />
              )}
            </TouchableOpacity>

            {/* Playback Controls Row */}
            <View style={[styles.playbackControlsRow, { marginTop: spacing.md }]}>
              {/* Play / Pause Region */}
              <TouchableOpacity
                onPress={handleTogglePlayRegion}
                style={[
                  styles.playRegionBtn,
                  {
                    backgroundColor: isPlayingRegion ? theme.error : theme.primary,
                    borderRadius: borderRadius.full,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isPlayingRegion ? 'Durdur' : 'Seçili Kesiti Çal'}
              >
                <Ionicons
                  name={isPlayingRegion ? 'pause' : 'play'}
                  size={24}
                  color={theme.onPrimary}
                  style={{ marginLeft: isPlayingRegion ? 0 : 2 }}
                />
              </TouchableOpacity>

              {/* Loop Toggle */}
              <TouchableOpacity
                onPress={() => setIsLooping(!isLooping)}
                style={[
                  styles.loopChipBtn,
                  {
                    backgroundColor: isLooping ? theme.accent : theme.surfaceVariant,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs + 2,
                  },
                ]}
              >
                <Ionicons
                  name="repeat"
                  size={18}
                  color={isLooping ? '#FFFFFF' : theme.textSecondary}
                />
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: isLooping ? '#FFFFFF' : theme.textSecondary,
                      marginLeft: 4,
                      fontWeight: isLooping ? '700' : '500',
                    },
                  ]}
                >
                  Döngü (Loop)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Millisecond Precision Trimming Cards */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                marginTop: spacing.md,
                padding: spacing.lg,
              },
            ]}
          >
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Hassas Zaman Ayarları (Milisaniye)
            </Text>

            {/* Start & End Steppers Row */}
            <View style={[styles.timeSteppersRow, { marginTop: spacing.md }]}>
              {/* Start Stepper Box */}
              <View
                style={[
                  styles.stepperBox,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.labelSmall, { color: theme.accent, fontWeight: '700' }]}>
                  BAŞLANGIÇ NOKTASI
                </Text>
                <Text
                  style={[
                    typography.titleMedium,
                    { color: theme.textPrimary, marginVertical: 4, fontWeight: '700' },
                  ]}
                >
                  {formatSeconds(startTime)}
                </Text>

                <View style={styles.stepButtonsRow}>
                  <TouchableOpacity
                    onPress={() => handleAdjustStart(-1.0)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>-1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAdjustStart(-0.1)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>-0.1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAdjustStart(0.1)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>+0.1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAdjustStart(1.0)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>+1s</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* End Stepper Box */}
              <View
                style={[
                  styles.stepperBox,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.labelSmall, { color: theme.error, fontWeight: '700' }]}>
                  BİTİŞ NOKTASI
                </Text>
                <Text
                  style={[
                    typography.titleMedium,
                    { color: theme.textPrimary, marginVertical: 4, fontWeight: '700' },
                  ]}
                >
                  {formatSeconds(endTime)}
                </Text>

                <View style={styles.stepButtonsRow}>
                  <TouchableOpacity
                    onPress={() => handleAdjustEnd(-1.0)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>-1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAdjustEnd(-0.1)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>-0.1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAdjustEnd(0.1)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>+0.1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAdjustEnd(1.0)}
                    style={[styles.smallStepBtn, { backgroundColor: theme.card }]}
                  >
                    <Text style={styles.stepBtnText}>+1s</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Audio Effects: Fade-In, Fade-Out & Volume Gain */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                marginTop: spacing.md,
                padding: spacing.lg,
              },
            ]}
          >
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Ses Efektleri & Yükseltme
            </Text>

            {/* Fade In & Out Row */}
            <View style={[styles.effectsGrid, { marginTop: spacing.md }]}>
              {/* Fade In */}
              <View style={styles.effectItem}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  GİRİŞ YUMUŞATMA (Fade-In)
                </Text>
                <View style={styles.effectChipsRow}>
                  {[0, 0.5, 1.0, 2.0, 3.0].map((val) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setFadeInSec(val)}
                      style={[
                        styles.effectChip,
                        {
                          backgroundColor:
                            fadeInSec === val ? theme.primary : theme.surfaceVariant,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: fadeInSec === val ? theme.onPrimary : theme.textPrimary },
                        ]}
                      >
                        {val === 0 ? 'Yok' : `${val}s`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Fade Out */}
              <View style={[styles.effectItem, { marginTop: spacing.md }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  ÇIKIŞ YUMUŞATMA (Fade-Out)
                </Text>
                <View style={styles.effectChipsRow}>
                  {[0, 0.5, 1.0, 2.0, 3.0].map((val) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setFadeOutSec(val)}
                      style={[
                        styles.effectChip,
                        {
                          backgroundColor:
                            fadeOutSec === val ? theme.primary : theme.surfaceVariant,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: fadeOutSec === val ? theme.onPrimary : theme.textPrimary },
                        ]}
                      >
                        {val === 0 ? 'Yok' : `${val}s`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Volume Gain Booster */}
              <View style={[styles.effectItem, { marginTop: spacing.md }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  SES YÜKSELTME (Gain: %{Math.round(gain * 100)})
                </Text>
                <View style={styles.effectChipsRow}>
                  {[0.5, 0.8, 1.0, 1.3, 1.6, 2.0].map((gVal) => (
                    <TouchableOpacity
                      key={gVal}
                      onPress={() => setGain(gVal)}
                      style={[
                        styles.effectChip,
                        {
                          backgroundColor:
                            gain === gVal ? theme.accent : theme.surfaceVariant,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          {
                            color: gain === gVal ? '#FFFFFF' : theme.textPrimary,
                            fontWeight: gain === gVal ? '700' : '500',
                          },
                        ]}
                      >
                        %{Math.round(gVal * 100)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Export Preset & Format Selector */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                marginTop: spacing.md,
                padding: spacing.lg,
              },
            ]}
          >
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              Kullanım Amacı & Format
            </Text>

            {/* Preset chips */}
            <View style={[styles.presetChipsGrid, { marginTop: spacing.sm }]}>
              {presetChips.map((chip) => {
                const isSelected = presetType === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => setPresetType(chip.id)}
                    style={[
                      styles.presetTypeBtn,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderRadius: borderRadius.md,
                        padding: spacing.sm + 2,
                      },
                    ]}
                  >
                    <Ionicons
                      name={chip.icon as any}
                      size={18}
                      color={isSelected ? theme.onPrimary : theme.textPrimary}
                    />
                    <Text
                      style={[
                        typography.labelSmall,
                        {
                          color: isSelected ? theme.onPrimary : theme.textPrimary,
                          marginLeft: 6,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Format row */}
            <View style={[styles.formatRow, { marginTop: spacing.md }]}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                DIŞA AKTARMA FORMATI:
              </Text>
              {(['wav', 'mp3', 'm4a'] as ExportAudioFormat[]).map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  onPress={() => setExportFormat(fmt)}
                  style={[
                    styles.fmtBtn,
                    {
                      backgroundColor:
                        exportFormat === fmt ? theme.primary : theme.surfaceVariant,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      {
                        color: exportFormat === fmt ? theme.onPrimary : theme.textPrimary,
                        textTransform: 'uppercase',
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {fmt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Export Action Button */}
          <TouchableOpacity
            onPress={handleExportAudio}
            disabled={isExporting}
            style={[
              styles.exportMainBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.lg,
                marginTop: spacing.xl,
                paddingVertical: spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Zil Sesi Olarak Dışa Aktar"
          >
            {isExporting ? (
              <View style={styles.exportLoadingRow}>
                <ActivityIndicator size="small" color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.sm },
                  ]}
                >
                  Ses işleniyor ve kaydediliyor...
                </Text>
              </View>
            ) : (
              <View style={styles.exportLoadingRow}>
                <Ionicons name="download-outline" size={22} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.onPrimary, marginLeft: spacing.sm, fontWeight: '700' },
                  ]}
                >
                  Zil Sesini / Kesiti Dışa Aktar ({formatSeconds(durationSelectedSec)})
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Export Result Success Card */}
          {exportResult && (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.success,
                  borderRadius: borderRadius.xl,
                  marginTop: spacing.lg,
                  padding: spacing.lg,
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.resultIconCircle,
                    {
                      backgroundColor: theme.successContainer,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={32} color={theme.success} />
                </View>

                <View style={styles.resultHeaderTexts}>
                  <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                    Zil Sesi Başarıyla Oluşturuldu!
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                    {exportResult.fileName} • {formatSeconds(exportResult.durationSec)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons: Share & Save */}
              <View style={[styles.resultButtonsRow, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  onPress={handleShareResult}
                  style={[
                    styles.shareResultBtn,
                    {
                      backgroundColor: theme.primary,
                      borderRadius: borderRadius.md,
                      paddingVertical: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="share-social-outline" size={20} color={theme.onPrimary} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.onPrimary, marginLeft: spacing.xs, fontWeight: '700' },
                    ]}
                  >
                    Paylaş / Cihaza Kaydet
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Sample Audio Selection Modal */}
      <Modal
        visible={sampleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSampleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.xl,
              },
            ]}
          >
            <View style={styles.sampleModalTop}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                Örnek Ses Kayıtları
              </Text>
              <TouchableOpacity onPress={() => setSampleModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%', marginTop: 12 }}>
              {SAMPLE_AUDIO_PRESETS.map((sample) => (
                <TouchableOpacity
                  key={sample.id}
                  onPress={() => handleLoadSample(sample.id)}
                  style={[
                    styles.sampleOptionCard,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderColor: theme.cardBorder,
                      borderRadius: borderRadius.lg,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                    {sample.name}
                  </Text>
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: theme.textSecondary, marginTop: 2 },
                    ]}
                  >
                    {sample.subtitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
  card: {
    borderWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: {
    flex: 1,
    marginLeft: 12,
  },
  sourceButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  samplePickBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  durationBadge: {},
  waveformContainer: {
    width: '100%',
    height: 110,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  waveformBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '80%',
    paddingHorizontal: 4,
  },
  waveformBar: {
    flex: 1,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  regionMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 2.5,
    zIndex: 5,
  },
  markerHandle: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerHandleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  playheadLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#38BDF8',
    zIndex: 10,
  },
  playbackControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playRegionBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeSteppersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperBox: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepButtonsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  smallStepBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  effectsGrid: {},
  effectItem: {},
  effectChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  effectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fmtBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exportMainBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultCard: {
    borderWidth: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIconCircle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultHeaderTexts: {
    flex: 1,
    marginLeft: 12,
  },
  resultButtonsRow: {
    width: '100%',
  },
  shareResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    borderWidth: 1,
  },
  sampleModalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  sampleOptionCard: {
    borderWidth: 1,
    width: '100%',
  },
});
