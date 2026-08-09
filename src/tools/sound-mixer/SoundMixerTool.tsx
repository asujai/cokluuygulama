import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme';
import { SoundMixPreset, SoundTrackId } from './types';
import {
  SOUND_TRACKS,
  soundSynthesizer,
} from './soundSynthesizer';
import {
  DEFAULT_PRESETS,
  deleteCustomMix,
  getCustomMixes,
  saveCustomMix,
} from './mixerStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60, 90];

export const SoundMixerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Track volumes state (0.0 to 1.0)
  const [trackVolumes, setTrackVolumes] = useState<Record<SoundTrackId, number>>({
    rain: 0.5,
    fireplace: 0,
    waves: 0.35,
    forest: 0,
    wind: 0,
    thunder: 0,
    cafe: 0,
    white_noise: 0,
    pink_noise: 0.45,
    brown_noise: 0,
    crickets: 0,
    stream: 0,
  });

  const [masterVolume, setMasterVolume] = useState<number>(0.85);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Sleep Timer State
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [remainingTimerSec, setRemainingTimerSec] = useState<number | null>(null);
  const [timerModalVisible, setTimerModalVisible] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  // Presets & Save Modal State
  const [customPresets, setCustomPresets] = useState<SoundMixPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>('deep_sleep');
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');

  const timerIntervalRef = useRef<any>(null);

  // Load custom presets from storage on mount
  useEffect(() => {
    soundSynthesizer.initBackgroundAudio();
    loadCustomPresets();

    return () => {
      soundSynthesizer.stopEngine();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const loadCustomPresets = async () => {
    const custom = await getCustomMixes();
    setCustomPresets(custom);
  };

  // Toggle Master Play / Pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      soundSynthesizer.stopEngine();
      setIsPlaying(false);
    } else {
      soundSynthesizer.startEngine(trackVolumes, masterVolume);
      setIsPlaying(true);
    }
  };

  // Adjust individual sound track volume
  const handleTrackVolumeChange = (trackId: SoundTrackId, delta: number) => {
    setTrackVolumes((prev) => {
      const current = prev[trackId] || 0;
      const next = Math.max(0, Math.min(1, Math.round((current + delta) * 10) / 10));
      const updated = { ...prev, [trackId]: next };

      if (isPlaying) {
        soundSynthesizer.setTrackVolume(trackId, next);
      }
      return updated;
    });
    setActivePresetId(null);
  };

  // Direct volume set (e.g., 0, 0.5, 1.0 or quick mute)
  const handleSetTrackDirectVolume = (trackId: SoundTrackId, val: number) => {
    setTrackVolumes((prev) => {
      const updated = { ...prev, [trackId]: val };
      if (isPlaying) {
        soundSynthesizer.setTrackVolume(trackId, val);
      }
      return updated;
    });
    setActivePresetId(null);
  };

  // Master Volume adjustments
  const handleMasterVolumeChange = (delta: number) => {
    const next = Math.max(0.1, Math.min(1.0, Math.round((masterVolume + delta) * 10) / 10));
    setMasterVolume(next);
    if (isPlaying) {
      soundSynthesizer.setMasterVolume(next);
    }
  };

  // Apply a Preset mix
  const handleApplyPreset = (preset: SoundMixPreset) => {
    const newVols: Record<SoundTrackId, number> = {
      rain: 0,
      fireplace: 0,
      waves: 0,
      forest: 0,
      wind: 0,
      thunder: 0,
      cafe: 0,
      white_noise: 0,
      pink_noise: 0,
      brown_noise: 0,
      crickets: 0,
      stream: 0,
      ...preset.volumes,
    };

    setTrackVolumes(newVols);
    setActivePresetId(preset.id);

    if (isPlaying) {
      // update all playing gains
      SOUND_TRACKS.forEach((t) => {
        soundSynthesizer.setTrackVolume(t.id, newVols[t.id] || 0);
      });
    } else {
      soundSynthesizer.startEngine(newVols, masterVolume);
      setIsPlaying(true);
    }
  };

  // Reset all track volumes to 0
  const handleResetAll = () => {
    const zeroVols: Record<SoundTrackId, number> = {
      rain: 0,
      fireplace: 0,
      waves: 0,
      forest: 0,
      wind: 0,
      thunder: 0,
      cafe: 0,
      white_noise: 0,
      pink_noise: 0,
      brown_noise: 0,
      crickets: 0,
      stream: 0,
    };
    setTrackVolumes(zeroVols);
    setActivePresetId(null);
    if (isPlaying) {
      SOUND_TRACKS.forEach((t) => soundSynthesizer.setTrackVolume(t.id, 0));
    }
  };

  // Random Relaxing Mix Generator
  const handleRandomMix = () => {
    const newVols: Record<SoundTrackId, number> = {
      rain: 0,
      fireplace: 0,
      waves: 0,
      forest: 0,
      wind: 0,
      thunder: 0,
      cafe: 0,
      white_noise: 0,
      pink_noise: 0,
      brown_noise: 0,
      crickets: 0,
      stream: 0,
    };

    // Pick 3-4 random tracks with pleasant levels
    const shuffled = [...SOUND_TRACKS].sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * 2) + 3; // 3 or 4 tracks
    for (let i = 0; i < count; i++) {
      newVols[shuffled[i].id] = Math.round((Math.random() * 0.4 + 0.3) * 10) / 10;
    }

    setTrackVolumes(newVols);
    setActivePresetId(null);

    if (isPlaying) {
      SOUND_TRACKS.forEach((t) => soundSynthesizer.setTrackVolume(t.id, newVols[t.id]));
    } else {
      soundSynthesizer.startEngine(newVols, masterVolume);
      setIsPlaying(true);
    }
  };

  // Start Sleep Timer
  const handleSetSleepTimer = (minutes: number | null) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (minutes === null) {
      setSleepTimerMinutes(null);
      setRemainingTimerSec(null);
      setIsFadingOut(false);
      setTimerModalVisible(false);
      return;
    }

    setSleepTimerMinutes(minutes);
    const totalSec = minutes * 60;
    setRemainingTimerSec(totalSec);
    setIsFadingOut(false);
    setTimerModalVisible(false);

    if (!isPlaying) {
      soundSynthesizer.startEngine(trackVolumes, masterVolume);
      setIsPlaying(true);
    }

    timerIntervalRef.current = setInterval(() => {
      setRemainingTimerSec((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerIntervalRef.current);
          setIsFadingOut(true);
          soundSynthesizer.fadeOutAndStop(8, () => {
            setIsPlaying(false);
            setSleepTimerMinutes(null);
            setRemainingTimerSec(null);
            setIsFadingOut(false);
          });
          return 0;
        }

        // Start smooth fade-out 30s before end
        if (prev === 30) {
          setIsFadingOut(true);
        }

        return prev - 1;
      });
    }, 1000);
  };

  // Save Current Mix Modal Action
  const handleSaveCurrentMix = async () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) {
      Alert.alert('Eksik Bilgi', 'Lütfen miksinize bir isim verin.');
      return;
    }

    const activeVols: Partial<Record<SoundTrackId, number>> = {};
    Object.entries(trackVolumes).forEach(([k, v]) => {
      if (v > 0) activeVols[k as SoundTrackId] = v;
    });

    if (Object.keys(activeVols).length === 0) {
      Alert.alert('Uyarı', 'Kaydetmek için en az bir sesin seviyesini açmalısınız.');
      return;
    }

    const newPreset: SoundMixPreset = {
      id: `custom_${Date.now()}`,
      name: trimmed,
      description: 'Kişisel özel ortam miksi',
      icon: 'heart-outline',
      volumes: activeVols,
      isCustom: true,
      createdAt: Date.now(),
    };

    const updated = await saveCustomMix(newPreset);
    setCustomPresets(updated);
    setActivePresetId(newPreset.id);
    setSaveModalVisible(false);
    setNewPresetName('');
    Alert.alert('Kaydedildi! ⭐', `"${trimmed}" miksi başarıyla kaydedildi.`);
  };

  const handleDeleteCustomPreset = async (id: string, name: string) => {
    Alert.alert('Miksi Sil', `"${name}" miksini silmek istediğinize emin misiniz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteCustomMix(id);
          setCustomPresets(updated);
          if (activePresetId === id) setActivePresetId(null);
        },
      },
    ]);
  };

  // Format Timer MM:SS or HH:MM
  const formatSleepTimerDisplay = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const activePlayingTracksCount = useMemo(() => {
    return Object.values(trackVolumes).filter((v) => v > 0).length;
  }, [trackVolumes]);

  const allPresets = useMemo(() => {
    return [...DEFAULT_PRESETS, ...customPresets];
  }, [customPresets]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Master Control Header Card */}
      <View
        style={[
          styles.masterHeaderCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderBottomWidth: 1,
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.masterTopRow}>
          {/* Play / Pause Big Button */}
          <TouchableOpacity
            onPress={handleTogglePlay}
            style={[
              styles.masterPlayBtn,
              {
                backgroundColor: isPlaying ? theme.error : theme.primary,
                borderRadius: borderRadius.full,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Tüm sesleri durdur' : 'Miksi çal'}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color={theme.onPrimary}
              style={{ marginLeft: isPlaying ? 0 : 3 }}
            />
          </TouchableOpacity>

          <View style={styles.masterInfoTexts}>
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              {isPlaying ? 'Doğa & Uyku Miksi Çalıyor' : 'Mikser Duraklatıldı'}
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
              {activePlayingTracksCount > 0
                ? `${activePlayingTracksCount} aktif ses katmanı devrede`
                : 'Ses seviyelerini artırarak miksinizi oluşturun'}
            </Text>
          </View>

          {/* Sleep Timer Button */}
          <TouchableOpacity
            onPress={() => setTimerModalVisible(true)}
            style={[
              styles.timerChipBtn,
              {
                backgroundColor: remainingTimerSec !== null ? theme.accent : theme.surfaceVariant,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs + 2,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Uyku zamanlayıcısı"
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={remainingTimerSec !== null ? '#FFFFFF' : theme.textPrimary}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: remainingTimerSec !== null ? '#FFFFFF' : theme.textPrimary,
                  marginLeft: 4,
                  fontWeight: '700',
                },
              ]}
            >
              {remainingTimerSec !== null
                ? formatSleepTimerDisplay(remainingTimerSec)
                : 'Zamanlayıcı'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Master Volume Slider Row */}
        <View style={[styles.masterVolumeRow, { marginTop: spacing.md }]}>
          <TouchableOpacity onPress={() => handleMasterVolumeChange(-0.1)}>
            <Ionicons name="volume-low-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.masterSliderTrack}>
            <View
              style={[
                styles.masterSliderFill,
                {
                  backgroundColor: theme.primary,
                  width: `${Math.round(masterVolume * 100)}%`,
                  borderRadius: borderRadius.full,
                },
              ]}
            />
          </View>

          <TouchableOpacity onPress={() => handleMasterVolumeChange(0.1)}>
            <Ionicons name="volume-high-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <Text
            style={[
              typography.labelSmall,
              { color: theme.textPrimary, width: 38, textAlign: 'right', fontWeight: '700' },
            ]}
          >
            %{Math.round(masterVolume * 100)}
          </Text>
        </View>

        {/* Quick Toolbar: Reset, Random, Save */}
        <View style={[styles.quickActionsRow, { marginTop: spacing.md }]}>
          <TouchableOpacity
            onPress={handleResetAll}
            style={[
              styles.quickToolBtn,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.sm,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
            <Text
              style={[
                typography.labelSmall,
                { color: theme.textSecondary, marginLeft: 4 },
              ]}
            >
              Sıfırla
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRandomMix}
            style={[
              styles.quickToolBtn,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.sm,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            <Ionicons name="shuffle-outline" size={14} color={theme.accent} />
            <Text
              style={[
                typography.labelSmall,
                { color: theme.accent, marginLeft: 4, fontWeight: '700' },
              ]}
            >
              Rastgele Miks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSaveModalVisible(true)}
            style={[
              styles.quickToolBtn,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.sm,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            <Ionicons name="bookmark-outline" size={14} color={theme.onPrimaryContainer} />
            <Text
              style={[
                typography.labelSmall,
                { color: theme.onPrimaryContainer, marginLeft: 4, fontWeight: '700' },
              ]}
            >
              Miksi Kaydet
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preset Carousel Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.presetScroll}
        contentContainerStyle={[styles.presetContainer, { paddingHorizontal: spacing.md }]}
      >
        {allPresets.map((preset) => {
          const isSelected = activePresetId === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              onPress={() => handleApplyPreset(preset)}
              onLongPress={() => {
                if (preset.isCustom) {
                  handleDeleteCustomPreset(preset.id, preset.name);
                }
              }}
              style={[
                styles.presetChip,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.cardBorder,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                },
              ]}
            >
              <Ionicons
                name={preset.icon as any}
                size={16}
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
                {preset.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 12 Sound Tracks Grid */}
      <ScrollView
        style={styles.tracksScroll}
        contentContainerStyle={[styles.tracksList, { padding: spacing.md, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tracksGrid}>
          {SOUND_TRACKS.map((track) => {
            const vol = trackVolumes[track.id] || 0;
            const isActive = vol > 0;

            return (
              <View
                key={track.id}
                style={[
                  styles.trackCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isActive ? track.color : theme.cardBorder,
                    borderWidth: isActive ? 2 : 1,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                  },
                ]}
              >
                {/* Track Card Header */}
                <View style={styles.trackCardTop}>
                  <View
                    style={[
                      styles.trackIconBox,
                      {
                        backgroundColor: isActive
                          ? track.color
                          : theme.surfaceVariant,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <Ionicons
                      name={track.icon as any}
                      size={20}
                      color={isActive ? '#FFFFFF' : theme.textSecondary}
                    />
                  </View>

                  <View style={styles.trackNameInfo}>
                    <Text
                      style={[
                        typography.titleSmall,
                        { color: theme.textPrimary, fontSize: 14 },
                      ]}
                      numberOfLines={1}
                    >
                      {track.name}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: theme.textMuted, fontSize: 10 },
                      ]}
                      numberOfLines={1}
                    >
                      {track.subtitle}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleSetTrackDirectVolume(track.id, isActive ? 0 : 0.6)}
                    style={[
                      styles.trackPowerBtn,
                      {
                        backgroundColor: isActive ? theme.surfaceVariant : 'transparent',
                        borderRadius: borderRadius.full,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isActive ? 'volume-mute-outline' : 'volume-medium-outline'}
                      size={18}
                      color={isActive ? theme.textPrimary : theme.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Volume Level Stepper & Percentage Display */}
                <View style={[styles.trackVolumeRow, { marginTop: spacing.sm }]}>
                  <TouchableOpacity
                    onPress={() => handleTrackVolumeChange(track.id, -0.1)}
                    disabled={vol <= 0}
                    style={[
                      styles.volStepBtn,
                      {
                        backgroundColor: theme.surfaceVariant,
                        borderRadius: borderRadius.xs,
                        opacity: vol <= 0 ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="remove" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>

                  {/* Visual Stepper Bars */}
                  <View style={styles.volBarsContainer}>
                    {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((stepVal, idx) => {
                      const isFilled = vol >= stepVal;
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => handleSetTrackDirectVolume(track.id, stepVal)}
                          style={[
                            styles.volBarSegment,
                            {
                              backgroundColor: isFilled
                                ? track.color
                                : theme.surfaceVariant,
                              borderRadius: borderRadius.xs,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleTrackVolumeChange(track.id, 0.1)}
                    disabled={vol >= 1}
                    style={[
                      styles.volStepBtn,
                      {
                        backgroundColor: theme.surfaceVariant,
                        borderRadius: borderRadius.xs,
                        opacity: vol >= 1 ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="add" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>

                  <Text
                    style={[
                      typography.labelSmall,
                      {
                        color: isActive ? track.color : theme.textMuted,
                        width: 34,
                        textAlign: 'right',
                        fontWeight: '700',
                      },
                    ]}
                  >
                    %{Math.round(vol * 100)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sleep Timer Selector Modal */}
      <Modal
        visible={timerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimerModalVisible(false)}
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
                  backgroundColor: theme.accent,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <Ionicons name="moon" size={28} color="#FFFFFF" />
            </View>

            <Text
              style={[
                typography.titleMedium,
                { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              Uyku Zamanlayıcısı
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
              Süre dolduğunda ses seviyesi kademeli olarak kısılarak otomatik durur.
            </Text>

            {/* Timer Options Grid */}
            <View style={[styles.timerOptionsGrid, { marginTop: spacing.lg }]}>
              {SLEEP_TIMER_OPTIONS.map((mins) => {
                const isSelected = sleepTimerMinutes === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => handleSetSleepTimer(mins)}
                    style={[
                      styles.timerOptionBtn,
                      {
                        backgroundColor: isSelected
                          ? theme.primary
                          : theme.surfaceVariant,
                        borderRadius: borderRadius.md,
                        paddingVertical: spacing.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.titleSmall,
                        {
                          color: isSelected ? theme.onPrimary : theme.textPrimary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {mins} Dakika
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Turn off timer button */}
            {sleepTimerMinutes !== null && (
              <TouchableOpacity
                onPress={() => handleSetSleepTimer(null)}
                style={[
                  styles.cancelTimerBtn,
                  {
                    backgroundColor: theme.errorContainer,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                    paddingVertical: spacing.sm,
                  },
                ]}
              >
                <Text style={[typography.labelMedium, { color: theme.onErrorContainer }]}>
                  Zamanlayıcıyı Kapat
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setTimerModalVisible(false)}
              style={[
                styles.modalCloseBtn,
                { marginTop: spacing.md },
              ]}
            >
              <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
                Vazgeç
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save Custom Mix Modal */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
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
            <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
              Özel Miksi Kaydet
            </Text>

            <Text
              style={[
                typography.bodyMedium,
                { color: theme.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
              ]}
            >
              Mevcut ses ayarlarınızı kaydedip daha sonra tek tıkla tekrar açabilirsiniz.
            </Text>

            <TextInput
              value={newPresetName}
              onChangeText={setNewPresetName}
              placeholder="Örn: Gece Kitap Okuma"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.savePresetInput,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.inputBorder,
                  color: theme.textPrimary,
                  borderRadius: borderRadius.md,
                  marginTop: spacing.lg,
                  padding: spacing.md,
                },
              ]}
              autoFocus
            />

            <View style={[styles.modalActionsRow, { marginTop: spacing.xl }]}>
              <TouchableOpacity
                onPress={() => {
                  setSaveModalVisible(false);
                  setNewPresetName('');
                }}
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.labelLarge, { color: theme.textPrimary }]}>
                  Vazgeç
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveCurrentMix}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.labelLarge, { color: theme.onPrimary, fontWeight: '700' }]}>
                  Kaydet
                </Text>
              </TouchableOpacity>
            </View>
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
  masterHeaderCard: {
    elevation: 2,
  },
  masterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterPlayBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterInfoTexts: {
    flex: 1,
    marginLeft: 12,
  },
  timerChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  masterVolumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masterSliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  masterSliderFill: {
    height: '100%',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetScroll: {
    maxHeight: 46,
    marginVertical: 4,
  },
  presetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  tracksScroll: {
    flex: 1,
  },
  tracksList: {},
  tracksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trackCard: {
    width: (SCREEN_WIDTH - 42) / 2 > 155 ? (SCREEN_WIDTH - 42) / 2 : 155,
    flexGrow: 1,
  },
  trackCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackIconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackNameInfo: {
    flex: 1,
    marginLeft: 8,
  },
  trackPowerBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackVolumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  volStepBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volBarsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: 16,
    alignItems: 'center',
  },
  volBarSegment: {
    flex: 1,
    height: '100%',
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
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerOptionsGrid: {
    width: '100%',
    gap: 8,
  },
  timerOptionBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTimerBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    padding: 8,
  },
  savePresetInput: {
    width: '100%',
    borderWidth: 1,
    fontSize: 16,
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
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
