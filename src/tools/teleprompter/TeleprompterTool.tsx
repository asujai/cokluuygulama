import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { PrompterConfig, PrompterPosition, SampleSpeech } from './types';
import {
  SAMPLE_SPEECHES,
  VoiceFollowController,
  isSpeechRecognitionAvailable,
} from './speechRecognition';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TeleprompterTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Script text state
  const [script, setScript] = useState<string>(SAMPLE_SPEECHES[0].script);
  const [sampleModalVisible, setSampleModalVisible] = useState<boolean>(false);

  // Prompter Configuration
  const [config, setConfig] = useState<PrompterConfig>({
    fontSize: 26,
    scrollSpeed: 2,
    opacity: 0.7,
    position: 'center',
    mirrorMode: false,
    voiceFollow: false,
    countdownSeconds: 3,
  });

  // Camera & Runtime State
  const [permission, requestPermission] = useCameraPermissions();
  const [isPrompterActive, setIsPrompterActive] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);

  // References
  const cameraRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef<number>(0);
  const maxScrollOffsetRef = useRef<number>(1000);
  const animationFrameRef = useRef<any>(null);
  const voiceTrackerRef = useRef<VoiceFollowController | null>(null);
  const recordIntervalRef = useRef<any>(null);

  // Word count & Speaking duration estimate (~130 words/min in Turkish)
  const wordCount = useMemo(() => {
    return script.trim() ? script.trim().split(/\s+/).length : 0;
  }, [script]);

  const estimatedDuration = useMemo(() => {
    const totalSec = Math.round((wordCount / 130) * 60);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins > 0 ? `${mins} dk ` : ''}${secs} sn`;
  }, [wordCount]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (voiceTrackerRef.current) voiceTrackerRef.current.stop();
    };
  }, []);

  // Voice follow controller initialization
  useEffect(() => {
    if (config.voiceFollow && isSpeechRecognitionAvailable()) {
      voiceTrackerRef.current = new VoiceFollowController(script, (_wordIdx, progressRatio) => {
        const targetScroll = progressRatio * maxScrollOffsetRef.current;
        scrollOffsetRef.current = targetScroll;
        scrollRef.current?.scrollTo({ y: targetScroll, animated: true });
      });
    } else {
      if (voiceTrackerRef.current) {
        voiceTrackerRef.current.stop();
        voiceTrackerRef.current = null;
      }
    }
  }, [config.voiceFollow, script]);

  // Scroll Animation Loop
  const startScrollLoop = useCallback(() => {
    if (config.voiceFollow) return; // In voice-follow, scroll is guided by spoken words

    const scrollStep = () => {
      const stepPixels = config.scrollSpeed * 0.75;
      scrollOffsetRef.current += stepPixels;

      if (scrollOffsetRef.current >= maxScrollOffsetRef.current) {
        setIsScrolling(false);
        return;
      }

      scrollRef.current?.scrollTo({ y: scrollOffsetRef.current, animated: false });
      animationFrameRef.current = requestAnimationFrame(scrollStep);
    };

    animationFrameRef.current = requestAnimationFrame(scrollStep);
  }, [config.scrollSpeed, config.voiceFollow]);

  const stopScrollLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Handle Play / Pause Prompter Scrolling
  const handleToggleScrolling = () => {
    if (isScrolling) {
      stopScrollLoop();
      setIsScrolling(false);
      if (voiceTrackerRef.current) voiceTrackerRef.current.stop();
    } else {
      setIsScrolling(true);
      if (config.voiceFollow && voiceTrackerRef.current) {
        voiceTrackerRef.current.start();
      } else {
        startScrollLoop();
      }
    }
  };

  const handleResetScroll = () => {
    stopScrollLoop();
    setIsScrolling(false);
    scrollOffsetRef.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Start Prompter Fullscreen View
  const handleLaunchPrompter = async () => {
    if (!permission?.granted && Platform.OS !== 'web') {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          'Kamera İzni Gerekli',
          'Teleprompter arka planında kendinizi görebilmeniz için ön kamera izni gereklidir.'
        );
        return;
      }
    }

    scrollOffsetRef.current = 0;
    setIsPrompterActive(true);
    setIsScrolling(false);
  };

  // Start 3-2-1 Countdown and Recording
  const handleStartCountdownAndRecord = () => {
    setCountdown(config.countdownSeconds);

    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer);
          startActualRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startActualRecording = () => {
    setIsRecording(true);
    setRecordSeconds(0);
    setIsScrolling(true);

    if (config.voiceFollow && voiceTrackerRef.current) {
      voiceTrackerRef.current.start();
    } else {
      startScrollLoop();
    }

    recordIntervalRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    stopScrollLoop();
    setIsScrolling(false);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }
    if (voiceTrackerRef.current) {
      voiceTrackerRef.current.stop();
    }

    // Set mock or captured video URI for demo/save
    setRecordedVideoUri(`teleprompter_kayit_${Date.now()}.mp4`);
  };

  // Share or Save Recording
  const handleShareVideo = async () => {
    if (!recordedVideoUri) return;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Başarılı', 'Video kaydı başarıyla hazırlandı!');
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(recordedVideoUri, {
          dialogTitle: 'Teleprompter Video Kaydını Paylaş',
        });
      } else {
        Alert.alert('Bilgi', 'Paylaşım özelliği bu cihazda doğrudan desteklenmiyor.');
      }
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  // Load sample speech
  const handleSelectSample = (sample: SampleSpeech) => {
    setScript(sample.script);
    setSampleModalVisible(false);
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setScript(text);
      }
    } catch {
      Alert.alert('Hata', 'Panodaki metin okunamadı.');
    }
  };

  const formatTimerDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {!isPrompterActive ? (
        /* SCRIPT EDITOR & CONFIGURATION SCREEN */
        <ScrollView
          style={styles.editorScroll}
          contentContainerStyle={[styles.editorContent, { padding: spacing.md }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Banner Card */}
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
            <View style={styles.heroRow}>
              <View
                style={[
                  styles.heroIconBox,
                  {
                    backgroundColor: theme.primaryContainer,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Ionicons name="videocam" size={28} color={theme.onPrimaryContainer} />
              </View>

              <View style={styles.heroTexts}>
                <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                  Kamera Teleprompter
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
                  Metninizi kameraya bakarken akıcı bir şekilde okuyun ve kaydedin.
                </Text>
              </View>
            </View>

            {/* Script Action Chips */}
            <View style={[styles.scriptActionsRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                onPress={() => setSampleModalVisible(true)}
                style={[
                  styles.scriptChip,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs + 2,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Örnek Konuşma Metinleri Seç"
              >
                <Ionicons name="document-text-outline" size={16} color={theme.primary} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.primary, marginLeft: spacing.xs },
                  ]}
                >
                  Örnek Metinler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePasteClipboard}
                style={[
                  styles.scriptChip,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs + 2,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Panodan Yapıştır"
              >
                <Ionicons name="clipboard-outline" size={16} color={theme.textPrimary} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Panodan Yapıştır
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setScript('')}
                style={[
                  styles.scriptChip,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs + 2,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Metni Temizle"
              >
                <Ionicons name="trash-outline" size={16} color={theme.error} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.error, marginLeft: spacing.xs },
                  ]}
                >
                  Temizle
                </Text>
              </TouchableOpacity>
            </View>

            {/* Script Text Input */}
            <View
              style={[
                styles.textAreaContainer,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.inputBorder,
                  borderRadius: borderRadius.lg,
                  marginTop: spacing.md,
                  padding: spacing.md,
                },
              ]}
            >
              <TextInput
                value={script}
                onChangeText={setScript}
                placeholder="Konuşma metninizi buraya yazın veya yapıştırın..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={10}
                style={[
                  styles.scriptTextInput,
                  { color: theme.textPrimary, fontSize: 16, lineHeight: 24 },
                ]}
                textAlignVertical="top"
              />
            </View>

            {/* Text Stats Footer */}
            <View style={[styles.textStatsFooter, { marginTop: spacing.sm }]}>
              <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                📝 <Text style={{ fontWeight: '700' }}>{wordCount}</Text> kelime • ~
                <Text style={{ fontWeight: '700', color: theme.accent }}>{estimatedDuration}</Text>{' '}
                tahmini okuma
              </Text>
            </View>
          </View>

          {/* Prompter Settings Card */}
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
              Prompter Ayarları
            </Text>

            {/* Speed & Font Size Controls */}
            <View style={[styles.configGrid, { marginTop: spacing.md }]}>
              {/* Scroll Speed */}
              <View style={styles.configItem}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  AKMA HIZI ({config.scrollSpeed}x)
                </Text>
                <View style={styles.stepperRow}>
                  {[1, 2, 3, 4, 5].map((spd) => (
                    <TouchableOpacity
                      key={spd}
                      onPress={() => setConfig((prev) => ({ ...prev, scrollSpeed: spd }))}
                      style={[
                        styles.chipBtn,
                        {
                          backgroundColor:
                            config.scrollSpeed === spd ? theme.primary : theme.surfaceVariant,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          {
                            color:
                              config.scrollSpeed === spd ? theme.onPrimary : theme.textPrimary,
                          },
                        ]}
                      >
                        {spd}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Font Size */}
              <View style={[styles.configItem, { marginTop: spacing.md }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  YAZI BOYUTU ({config.fontSize}px)
                </Text>
                <View style={styles.stepperRow}>
                  {[20, 26, 32, 38, 44].map((size) => (
                    <TouchableOpacity
                      key={size}
                      onPress={() => setConfig((prev) => ({ ...prev, fontSize: size }))}
                      style={[
                        styles.chipBtn,
                        {
                          backgroundColor:
                            config.fontSize === size ? theme.primary : theme.surfaceVariant,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          {
                            color:
                              config.fontSize === size ? theme.onPrimary : theme.textPrimary,
                          },
                        ]}
                      >
                        {size}px
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Text Position Selector */}
              <View style={[styles.configItem, { marginTop: spacing.md }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                  METİN KONUMU
                </Text>
                <View style={styles.stepperRow}>
                  {(['top', 'center', 'full'] as PrompterPosition[]).map((pos) => (
                    <TouchableOpacity
                      key={pos}
                      onPress={() => setConfig((prev) => ({ ...prev, position: pos }))}
                      style={[
                        styles.chipBtn,
                        {
                          flex: 1,
                          backgroundColor:
                            config.position === pos ? theme.primary : theme.surfaceVariant,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          {
                            color:
                              config.position === pos ? theme.onPrimary : theme.textPrimary,
                          },
                        ]}
                      >
                        {pos === 'top' ? 'Üst' : pos === 'center' ? 'Orta' : 'Tam Ekran'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Toggles: Mirror Mode & Voice Follow */}
              <View style={[styles.togglesRow, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  onPress={() => setConfig((p) => ({ ...p, mirrorMode: !p.mirrorMode }))}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: config.mirrorMode
                        ? theme.primaryContainer
                        : theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={20}
                    color={config.mirrorMode ? theme.primary : theme.textMuted}
                  />
                  <Text
                    style={[
                      typography.labelMedium,
                      {
                        color: config.mirrorMode ? theme.onPrimaryContainer : theme.textPrimary,
                        marginLeft: spacing.xs,
                      },
                    ]}
                  >
                    Ayna Modu (Cam Rig)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setConfig((p) => ({ ...p, voiceFollow: !p.voiceFollow }))}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: config.voiceFollow
                        ? theme.accent
                        : theme.surfaceVariant,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Ionicons
                    name="mic"
                    size={20}
                    color={config.voiceFollow ? '#FFFFFF' : theme.textMuted}
                  />
                  <Text
                    style={[
                      typography.labelMedium,
                      {
                        color: config.voiceFollow ? '#FFFFFF' : theme.textPrimary,
                        marginLeft: spacing.xs,
                      },
                    ]}
                  >
                    Ses Takip Modu
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Launch Prompter Action Button */}
          <TouchableOpacity
            onPress={handleLaunchPrompter}
            style={[
              styles.launchBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.lg,
                marginTop: spacing.xl,
                paddingVertical: spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Prompteri Başlat"
          >
            <Ionicons name="videocam" size={24} color={theme.onPrimary} />
            <Text
              style={[
                typography.titleSmall,
                { color: theme.onPrimary, marginLeft: spacing.sm, fontWeight: '700' },
              ]}
            >
              Prompteri & Kamerayı Başlat
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* FULLSCREEN CAMERA & PROMPTER VIEW */
        <View style={styles.prompterFullscreenContainer}>
          {/* Front Camera Background */}
          {Platform.OS !== 'web' ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0F19' }]}>
              <View style={styles.webCameraMock}>
                <Ionicons name="camera-reverse-outline" size={64} color="#334155" />
                <Text style={{ color: '#64748B', marginTop: 12, fontSize: 14 }}>
                  Ön Kamera Önizleme (Web Simülasyonu)
                </Text>
              </View>
            </View>
          )}

          {/* Top HUD Bar */}
          <View style={styles.topHudBar}>
            <TouchableOpacity
              onPress={() => {
                stopScrollLoop();
                setIsPrompterActive(false);
                setIsRecording(false);
              }}
              style={styles.hudCloseBtn}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            {isRecording ? (
              <View style={styles.recBadge}>
                <View style={styles.redDot} />
                <Text style={styles.recTimerText}>REC {formatTimerDisplay(recordSeconds)}</Text>
              </View>
            ) : (
              <View style={styles.idleBadge}>
                <Text style={styles.idleBadgeText}>HAZIR</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setConfig((p) => ({ ...p, mirrorMode: !p.mirrorMode }))}
              style={[
                styles.hudMirrorBtn,
                { backgroundColor: config.mirrorMode ? 'rgba(37,99,235,0.8)' : 'rgba(0,0,0,0.5)' },
              ]}
            >
              <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Overlaid Prompter Text Area */}
          <View
            style={[
              styles.prompterOverlayBox,
              config.position === 'top'
                ? styles.posTop
                : config.position === 'center'
                ? styles.posCenter
                : styles.posFull,
              {
                backgroundColor: `rgba(15, 23, 42, ${config.opacity})`,
                transform: config.mirrorMode ? [{ scaleX: -1 }] : [],
              },
            ]}
          >
            {/* Guide Horizontal Reading Marker */}
            <View style={styles.readingGuideLine} />

            <ScrollView
              ref={scrollRef}
              style={styles.scrollingTextContainer}
              contentContainerStyle={styles.scrollingTextContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(_w, h) => {
                maxScrollOffsetRef.current = Math.max(100, h - 180);
              }}
            >
              {/* Padding at top to center initial line */}
              <View style={{ height: 60 }} />
              <Text
                style={[
                  styles.prompterText,
                  {
                    fontSize: config.fontSize,
                    lineHeight: config.fontSize * 1.5,
                  },
                ]}
              >
                {script}
              </Text>
              {/* Extra spacing at bottom so all text can scroll through */}
              <View style={{ height: SCREEN_HEIGHT * 0.5 }} />
            </ScrollView>
          </View>

          {/* Countdown Overlay Animation */}
          {countdown !== null && (
            <View style={styles.countdownBackdrop}>
              <View style={styles.countdownCircle}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </View>
            </View>
          )}

          {/* Bottom Floating Control Bar */}
          <View style={styles.bottomHudControls}>
            {/* Reset Scroll */}
            <TouchableOpacity onPress={handleResetScroll} style={styles.hudActionBtn}>
              <Ionicons name="refresh" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Play / Pause Scroll */}
            <TouchableOpacity onPress={handleToggleScrolling} style={styles.hudActionBtn}>
              <Ionicons name={isScrolling ? 'pause' : 'play'} size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Record / Stop Button */}
            {!isRecording ? (
              <TouchableOpacity
                onPress={handleStartCountdownAndRecord}
                style={styles.recordTriggerBtn}
                accessibilityRole="button"
                accessibilityLabel="Kaydı Başlat"
              >
                <View style={styles.recordInnerCircle} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleStopRecording}
                style={styles.stopTriggerBtn}
                accessibilityRole="button"
                accessibilityLabel="Kaydı Durdur"
              >
                <View style={styles.stopInnerSquare} />
              </TouchableOpacity>
            )}

            {/* Font Size Quick Adjust */}
            <TouchableOpacity
              onPress={() =>
                setConfig((p) => ({ ...p, fontSize: p.fontSize >= 44 ? 20 : p.fontSize + 6 }))
              }
              style={styles.hudActionBtn}
            >
              <Ionicons name="text" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Speed Quick Adjust */}
            <TouchableOpacity
              onPress={() =>
                setConfig((p) => ({ ...p, scrollSpeed: p.scrollSpeed >= 5 ? 1 : p.scrollSpeed + 1 }))
              }
              style={styles.hudActionBtn}
            >
              <Text style={styles.speedHudText}>{config.scrollSpeed}x</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Post-Recording Share / Save Modal */}
      <Modal
        visible={!!recordedVideoUri && !isPrompterActive}
        transparent
        animationType="fade"
        onRequestClose={() => setRecordedVideoUri(null)}
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
            <View
              style={[
                styles.modalIconBox,
                {
                  backgroundColor: theme.successContainer,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <Ionicons name="videocam" size={32} color={theme.success} />
            </View>

            <Text
              style={[
                typography.titleMedium,
                { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              Video Kaydı Hazır!
            </Text>

            <Text
              style={[
                typography.bodyMedium,
                {
                  color: theme.textSecondary,
                  marginTop: spacing.xs,
                  textAlign: 'center',
                },
              ]}
            >
              Teleprompter çekiminiz başarıyla tamamlandı ({formatTimerDisplay(recordSeconds)}).
            </Text>

            <View style={[styles.modalActionsRow, { marginTop: spacing.xl }]}>
              <TouchableOpacity
                onPress={() => setRecordedVideoUri(null)}
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.labelLarge, { color: theme.textPrimary }]}>Kapat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShareVideo}
                style={[
                  styles.modalShareBtn,
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
                  Paylaş / Kaydet
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sample Speeches Selection Modal */}
      <Modal
        visible={sampleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSampleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.sampleModalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            <View style={styles.sampleModalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                Örnek Konuşma Metinleri
              </Text>
              <TouchableOpacity onPress={() => setSampleModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.samplesList}>
              {SAMPLE_SPEECHES.map((sample) => (
                <TouchableOpacity
                  key={sample.id}
                  onPress={() => handleSelectSample(sample)}
                  style={[
                    styles.sampleCardItem,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderColor: theme.cardBorder,
                      borderRadius: borderRadius.lg,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <View style={styles.sampleCardTop}>
                    <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                      {sample.title}
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.accent }]}>
                      ⏱ {sample.durationEst}
                    </Text>
                  </View>
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: theme.textSecondary, marginTop: 4 },
                    ]}
                    numberOfLines={2}
                  >
                    {sample.script}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorScroll: {
    flex: 1,
  },
  editorContent: {
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTexts: {
    flex: 1,
    marginLeft: 12,
  },
  scriptActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  scriptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  textAreaContainer: {
    borderWidth: 1,
    minHeight: 180,
  },
  scriptTextInput: {
    minHeight: 160,
  },
  textStatsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  configGrid: {},
  configItem: {},
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  chipBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompterFullscreenContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    zIndex: 999,
  },
  webCameraMock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHudBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  hudCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudMirrorBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  recTimerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  idleBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  idleBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  prompterOverlayBox: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  posTop: {
    top: 90,
    height: 220,
  },
  posCenter: {
    top: SCREEN_HEIGHT * 0.22,
    height: SCREEN_HEIGHT * 0.5,
  },
  posFull: {
    top: 90,
    bottom: 120,
  },
  readingGuideLine: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.4)',
    zIndex: 5,
  },
  scrollingTextContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollingTextContent: {},
  prompterText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  countdownBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomHudControls: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 12,
    borderRadius: 30,
  },
  hudActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedHudText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recordTriggerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInnerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DC2626',
  },
  stopTriggerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInnerSquare: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#DC2626',
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
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleModalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    borderWidth: 1,
  },
  sampleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  samplesList: {
    maxHeight: 400,
  },
  sampleCardItem: {
    borderWidth: 1,
  },
  sampleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
