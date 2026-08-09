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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme';
import {
  PhaseThemeInfo,
  TimerPhase,
  TimerStatus,
  TimerStep,
  WorkoutPreset,
} from './types';
import {
  playCountdownTick,
  playPhaseStartAlert,
  playRestAlert,
  playWorkoutCompleteFanfare,
} from './audioBeep';
import {
  DEFAULT_WORKOUT_PRESETS,
  getWorkoutPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from './timerStorage';

const PHASE_THEMES: Record<TimerPhase, PhaseThemeInfo> = {
  idle: {
    title: 'HAZIR',
    badge: 'Bekliyor',
    backgroundColor: '#3B82F6',
    textColor: '#FFFFFF',
    icon: 'play-outline',
  },
  prep: {
    title: 'HAZIRLIK',
    badge: 'Hazır Olun',
    backgroundColor: '#D97706', // Amber
    textColor: '#FFFFFF',
    icon: 'hourglass-outline',
  },
  work: {
    title: 'ÇALIŞMA',
    badge: 'Tüm Gücünle!',
    backgroundColor: '#059669', // Emerald/Green
    textColor: '#FFFFFF',
    icon: 'flash',
  },
  rest: {
    title: 'DİNLENME',
    badge: 'Nefes Al',
    backgroundColor: '#0891B2', // Cyan/Blue
    textColor: '#FFFFFF',
    icon: 'water-outline',
  },
  roundRest: {
    title: 'TUR DİNLENMESİ',
    badge: 'Tur Bitti',
    backgroundColor: '#6366F1', // Indigo
    textColor: '#FFFFFF',
    icon: 'refresh-circle-outline',
  },
  completed: {
    title: 'TAMAMLANDI!',
    badge: 'Harika İş!',
    backgroundColor: '#8B5CF6', // Purple
    textColor: '#FFFFFF',
    icon: 'trophy',
  },
};

/**
 * Builds the array of steps from a workout config.
 */
function buildTimerSteps(config: WorkoutPreset): TimerStep[] {
  const steps: TimerStep[] = [];

  if (config.prepTime > 0) {
    steps.push({
      phase: 'prep',
      duration: config.prepTime,
      round: 1,
      set: 1,
      totalRounds: config.rounds,
      totalSets: config.sets,
    });
  }

  for (let r = 1; r <= config.rounds; r++) {
    for (let s = 1; s <= config.sets; s++) {
      steps.push({
        phase: 'work',
        duration: config.workTime,
        round: r,
        set: s,
        totalRounds: config.rounds,
        totalSets: config.sets,
      });

      const isLastSet = s === config.sets;
      if (!isLastSet && config.restTime > 0) {
        steps.push({
          phase: 'rest',
          duration: config.restTime,
          round: r,
          set: s,
          totalRounds: config.rounds,
          totalSets: config.sets,
        });
      }
    }

    if (r < config.rounds && config.restBetweenRounds > 0) {
      steps.push({
        phase: 'roundRest',
        duration: config.restBetweenRounds,
        round: r,
        set: config.sets,
        totalRounds: config.rounds,
        totalSets: config.sets,
      });
    }
  }

  steps.push({
    phase: 'completed',
    duration: 0,
    round: config.rounds,
    set: config.sets,
    totalRounds: config.rounds,
    totalSets: config.sets,
  });

  return steps;
}

/**
 * Formats seconds into MM:SS.
 */
function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const HiitTabataTimerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Presets
  const [presets, setPresets] = useState<WorkoutPreset[]>(DEFAULT_WORKOUT_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_WORKOUT_PRESETS[0].id);

  // Current Parameters
  const [prepTime, setPrepTime] = useState<number>(10);
  const [workTime, setWorkTime] = useState<number>(20);
  const [restTime, setRestTime] = useState<number>(10);
  const [sets, setSets] = useState<number>(8);
  const [rounds, setRounds] = useState<number>(1);
  const [restBetweenRounds, setRestBetweenRounds] = useState<number>(0);

  // Timer Engine State
  const [status, setStatus] = useState<TimerStatus>('stopped');
  const [steps, setSteps] = useState<TimerStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  // Save Preset Modal
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Refs for accurate delta-based time tracking
  const targetEndTimestampRef = useRef<number>(0);
  const animationFrameRef = useRef<any>(null);
  const lastAlertSecondRef = useRef<number>(-1);

  // Load Presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const list = await getWorkoutPresets();
    setPresets(list);
  };

  // Load chosen preset parameters
  const applyPreset = (preset: WorkoutPreset) => {
    setSelectedPresetId(preset.id);
    setPrepTime(preset.prepTime);
    setWorkTime(preset.workTime);
    setRestTime(preset.restTime);
    setSets(preset.sets);
    setRounds(preset.rounds);
    setRestBetweenRounds(preset.restBetweenRounds);
  };

  // Current Workout Config
  const currentConfig: WorkoutPreset = useMemo(
    () => ({
      id: selectedPresetId,
      name: 'Özel Ayar',
      prepTime,
      workTime,
      restTime,
      sets,
      rounds,
      restBetweenRounds,
    }),
    [selectedPresetId, prepTime, workTime, restTime, sets, rounds, restBetweenRounds]
  );

  // Total Workout Duration Calculation
  const totalWorkoutDuration = useMemo(() => {
    const singleRoundWork = sets * workTime;
    const singleRoundRest = (sets - 1) * restTime;
    const roundTotal = singleRoundWork + singleRoundRest;
    const allRounds = rounds * roundTotal;
    const roundBreaks = (rounds - 1) * restBetweenRounds;
    return prepTime + allRounds + roundBreaks;
  }, [prepTime, workTime, restTime, sets, rounds, restBetweenRounds]);

  const currentStep = steps[currentStepIndex] || null;
  const currentPhase: TimerPhase = currentStep ? currentStep.phase : 'idle';
  const currentPhaseTheme = PHASE_THEMES[currentPhase] || PHASE_THEMES.idle;

  // Next Step Preview
  const nextStep = steps[currentStepIndex + 1] || null;

  // Sound & alert dispatcher on phase change
  const playPhaseSound = useCallback((phase: TimerPhase) => {
    if (phase === 'work') {
      playPhaseStartAlert();
    } else if (phase === 'rest' || phase === 'roundRest') {
      playRestAlert();
    } else if (phase === 'completed') {
      playWorkoutCompleteFanfare();
    } else if (phase === 'prep') {
      playPhaseStartAlert();
    }
  }, []);

  // Transition to specific step
  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      const target = steps[index];
      setCurrentStepIndex(index);
      setSecondsRemaining(target.duration);
      targetEndTimestampRef.current = Date.now() + target.duration * 1000;
      lastAlertSecondRef.current = -1;
      playPhaseSound(target.phase);

      if (target.phase === 'completed') {
        setStatus('stopped');
      }
    },
    [steps, playPhaseSound]
  );

  // Main Timer Loop (High-precision delta tracking)
  useEffect(() => {
    if (status !== 'running') {
      if (animationFrameRef.current) {
        clearInterval(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingMs = targetEndTimestampRef.current - now;
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      setSecondsRemaining(remainingSec);

      // Countdown tick on 3, 2, 1 seconds
      if (remainingSec > 0 && remainingSec <= 3 && remainingSec !== lastAlertSecondRef.current) {
        lastAlertSecondRef.current = remainingSec;
        playCountdownTick();
      }

      // Step completed!
      if (remainingMs <= 0) {
        if (currentStepIndex + 1 < steps.length) {
          goToStep(currentStepIndex + 1);
        } else {
          setStatus('stopped');
          playWorkoutCompleteFanfare();
        }
      }
    }, 100);

    animationFrameRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [status, currentStepIndex, steps, goToStep]);

  // Start / Play Action
  const handleStartWorkout = () => {
    const generatedSteps = buildTimerSteps(currentConfig);
    setSteps(generatedSteps);
    setCurrentStepIndex(0);
    const firstStep = generatedSteps[0];
    setSecondsRemaining(firstStep.duration);
    targetEndTimestampRef.current = Date.now() + firstStep.duration * 1000;
    lastAlertSecondRef.current = -1;
    setStatus('running');
    playPhaseSound(firstStep.phase);
  };

  // Pause Action
  const handlePause = () => {
    setStatus('paused');
  };

  // Resume Action
  const handleResume = () => {
    targetEndTimestampRef.current = Date.now() + secondsRemaining * 1000;
    setStatus('running');
  };

  // Reset Action
  const handleReset = () => {
    setStatus('stopped');
    setCurrentStepIndex(0);
    setSecondsRemaining(0);
  };

  // Save Custom Preset
  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen şablon için bir isim girin.');
      return;
    }

    const presetToSave: WorkoutPreset = {
      ...currentConfig,
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      description: `${workTime}s Çalışma, ${restTime}s Dinlenme • ${sets} Set`,
      isCustom: true,
    };

    const updated = await saveCustomPreset(presetToSave);
    setPresets(updated);
    setSelectedPresetId(presetToSave.id);
    setSaveModalVisible(false);
    setNewPresetName('');
  };

  // Delete Custom Preset
  const handleDeletePreset = async (presetId: string) => {
    Alert.alert('Şablonu Sil', 'Bu şablonu silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteCustomPreset(presetId);
          setPresets(updated);
          if (selectedPresetId === presetId) {
            applyPreset(DEFAULT_WORKOUT_PRESETS[0]);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {status === 'stopped' && currentPhase !== 'completed' ? (
        /* Configuration & Setup View */
        <View>
          {/* Preset Selector Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.md,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                Antrenman Şablonları
              </Text>
              <TouchableOpacity
                onPress={() => setSaveModalVisible(true)}
                style={[
                  styles.savePresetBtn,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Şablon Olarak Kaydet"
              >
                <Ionicons name="bookmark-outline" size={16} color={theme.textPrimary} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.textPrimary, marginLeft: 4 },
                  ]}
                >
                  Kaydet
                </Text>
              </TouchableOpacity>
            </View>

            {/* Presets Horizontal Strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsStrip}
            >
              {presets.map((p) => {
                const isSelected = selectedPresetId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => applyPreset(p)}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderRadius: borderRadius.md,
                        padding: spacing.md,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={p.name}
                  >
                    <View style={styles.presetChipHeader}>
                      <Text
                        style={[
                          typography.labelLarge,
                          {
                            color: isSelected ? theme.onPrimary : theme.textPrimary,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {p.name}
                      </Text>
                      {p.isCustom && (
                        <TouchableOpacity
                          onPress={() => handleDeletePreset(p.id)}
                          style={{ marginLeft: 6 }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Şablonu sil"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color={isSelected ? theme.onPrimary : theme.error}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: isSelected ? theme.onPrimary : theme.textSecondary,
                          marginTop: 4,
                        },
                      ]}
                    >
                      {p.workTime}s Çal. / {p.restTime}s Din.
                    </Text>
                    <Text
                      style={[
                        typography.labelSmall,
                        {
                          color: isSelected ? theme.onPrimary : theme.textMuted,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {p.sets} Set {p.rounds > 1 ? `x ${p.rounds} Tur` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Stepper Parameters Editor Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                marginTop: spacing.md,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
              Zaman & Aralık Ayarları
            </Text>

            {/* Hazırlık (Prep) */}
            <View style={[styles.stepperRow, { borderBottomColor: theme.divider }]}>
              <View style={styles.stepperLabelCol}>
                <View style={styles.badgeLabelRow}>
                  <View style={[styles.dotBadge, { backgroundColor: '#D97706' }]} />
                  <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
                    Hazırlık (sn)
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                  Geri sayım süresi
                </Text>
              </View>

              <View style={styles.stepperControls}>
                <TouchableOpacity
                  onPress={() => setPrepTime((p) => Math.max(0, p - 5))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Hazırlık süresini azalt"
                >
                  <Ionicons name="remove" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[typography.titleMedium, { color: theme.textPrimary, minWidth: 40, textAlign: 'center' }]}>
                  {prepTime}
                </Text>
                <TouchableOpacity
                  onPress={() => setPrepTime((p) => Math.min(60, p + 5))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Hazırlık süresini artır"
                >
                  <Ionicons name="add" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Çalışma (Work) */}
            <View style={[styles.stepperRow, { borderBottomColor: theme.divider }]}>
              <View style={styles.stepperLabelCol}>
                <View style={styles.badgeLabelRow}>
                  <View style={[styles.dotBadge, { backgroundColor: '#059669' }]} />
                  <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
                    Çalışma (sn)
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                  Yüksek tempo egzersiz
                </Text>
              </View>

              <View style={styles.stepperControls}>
                <TouchableOpacity
                  onPress={() => setWorkTime((w) => Math.max(5, w - 5))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Çalışma süresini azalt"
                >
                  <Ionicons name="remove" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[typography.titleMedium, { color: theme.textPrimary, minWidth: 40, textAlign: 'center' }]}>
                  {workTime}
                </Text>
                <TouchableOpacity
                  onPress={() => setWorkTime((w) => Math.min(300, w + 5))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Çalışma süresini artır"
                >
                  <Ionicons name="add" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dinlenme (Rest) */}
            <View style={[styles.stepperRow, { borderBottomColor: theme.divider }]}>
              <View style={styles.stepperLabelCol}>
                <View style={styles.badgeLabelRow}>
                  <View style={[styles.dotBadge, { backgroundColor: '#0891B2' }]} />
                  <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
                    Dinlenme (sn)
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                  Set arası toparlanma
                </Text>
              </View>

              <View style={styles.stepperControls}>
                <TouchableOpacity
                  onPress={() => setRestTime((r) => Math.max(0, r - 5))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Dinlenme süresini azalt"
                >
                  <Ionicons name="remove" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[typography.titleMedium, { color: theme.textPrimary, minWidth: 40, textAlign: 'center' }]}>
                  {restTime}
                </Text>
                <TouchableOpacity
                  onPress={() => setRestTime((r) => Math.min(180, r + 5))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Dinlenme süresini artır"
                >
                  <Ionicons name="add" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Set Sayısı */}
            <View style={[styles.stepperRow, { borderBottomColor: theme.divider }]}>
              <View style={styles.stepperLabelCol}>
                <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
                  Set Sayısı
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                  Her turdaki tekrar
                </Text>
              </View>

              <View style={styles.stepperControls}>
                <TouchableOpacity
                  onPress={() => setSets((s) => Math.max(1, s - 1))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Set sayısını azalt"
                >
                  <Ionicons name="remove" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[typography.titleMedium, { color: theme.textPrimary, minWidth: 40, textAlign: 'center' }]}>
                  {sets}
                </Text>
                <TouchableOpacity
                  onPress={() => setSets((s) => Math.min(30, s + 1))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Set sayısını artır"
                >
                  <Ionicons name="add" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tur Sayısı (Rounds) */}
            <View style={[styles.stepperRow, { borderBottomColor: theme.divider }]}>
              <View style={styles.stepperLabelCol}>
                <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
                  Tur Sayısı (Rounds)
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                  Döngü tekrar sayısı
                </Text>
              </View>

              <View style={styles.stepperControls}>
                <TouchableOpacity
                  onPress={() => setRounds((r) => Math.max(1, r - 1))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Tur sayısını azalt"
                >
                  <Ionicons name="remove" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[typography.titleMedium, { color: theme.textPrimary, minWidth: 40, textAlign: 'center' }]}>
                  {rounds}
                </Text>
                <TouchableOpacity
                  onPress={() => setRounds((r) => Math.min(10, r + 1))}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                  accessibilityRole="button"
                  accessibilityLabel="Tur sayısını artır"
                >
                  <Ionicons name="add" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Turlar Arası Dinlenme */}
            {rounds > 1 && (
              <View style={[styles.stepperRow]}>
                <View style={styles.stepperLabelCol}>
                  <View style={styles.badgeLabelRow}>
                    <View style={[styles.dotBadge, { backgroundColor: '#6366F1' }]} />
                    <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '500' }]}>
                      Turlar Arası (sn)
                    </Text>
                  </View>
                  <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                    Büyük dinlenme
                  </Text>
                </View>

                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    onPress={() => setRestBetweenRounds((b) => Math.max(0, b - 15))}
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                    accessibilityRole="button"
                    accessibilityLabel="Turlar arası süreyi azalt"
                  >
                    <Ionicons name="remove" size={18} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[typography.titleMedium, { color: theme.textPrimary, minWidth: 40, textAlign: 'center' }]}>
                    {restBetweenRounds}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setRestBetweenRounds((b) => Math.min(300, b + 15))}
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
                    accessibilityRole="button"
                    accessibilityLabel="Turlar arası süreyi artır"
                  >
                    <Ionicons name="add" size={18} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Total Duration Banner */}
          <View
            style={[
              styles.totalDurationBanner,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.lg,
                marginTop: spacing.md,
                padding: spacing.md,
              },
            ]}
          >
            <Ionicons name="time-outline" size={24} color={theme.onPrimaryContainer} />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.titleSmall, { color: theme.onPrimaryContainer, fontWeight: '700' }]}>
                Toplam Antrenman Süresi: {formatTime(totalWorkoutDuration)}
              </Text>
              <Text style={[typography.bodySmall, { color: theme.onPrimaryContainer }]}>
                {sets * rounds} Çalışma Seti • {rounds} Tur
              </Text>
            </View>
          </View>

          {/* Big Start Button */}
          <TouchableOpacity
            onPress={handleStartWorkout}
            style={[
              styles.startMainBtn,
              {
                backgroundColor: theme.success,
                borderRadius: borderRadius.xl,
                marginTop: spacing.lg,
                paddingVertical: spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Antrenmanı Başlat"
          >
            <Ionicons name="play" size={28} color="#FFFFFF" />
            <Text
              style={[
                typography.titleLarge,
                { color: '#FFFFFF', fontWeight: '700', marginLeft: spacing.xs },
              ]}
            >
              Antrenmana Başla
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* High-Visibility Active Timer Screen */
        <View style={styles.activeTimerWrapper}>
          {/* Main Giant Phase Card */}
          <View
            style={[
              styles.giantPhaseCard,
              {
                backgroundColor: currentPhaseTheme.backgroundColor,
                borderRadius: borderRadius.xl,
                padding: spacing.xl,
              },
            ]}
          >
            {/* Top Indicator: Round & Set */}
            <View style={styles.roundSetBar}>
              <View style={styles.roundSetPill}>
                <Ionicons name="repeat" size={18} color="#FFFFFF" />
                <Text style={[typography.titleSmall, { color: '#FFFFFF', marginLeft: 4, fontWeight: '700' }]}>
                  Tur {currentStep?.round || 1} / {currentStep?.totalRounds || 1}
                </Text>
              </View>

              <View style={styles.roundSetPill}>
                <Ionicons name="flame" size={18} color="#FFFFFF" />
                <Text style={[typography.titleSmall, { color: '#FFFFFF', marginLeft: 4, fontWeight: '700' }]}>
                  Set {currentStep?.set || 1} / {currentStep?.totalSets || 1}
                </Text>
              </View>
            </View>

            {/* Phase Title & Icon */}
            <View style={styles.phaseTitleRow}>
              <Ionicons name={currentPhaseTheme.icon as any} size={36} color="#FFFFFF" />
              <Text
                style={[
                  typography.titleLarge,
                  { color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: 1.5, marginLeft: 8 },
                ]}
              >
                {currentPhaseTheme.title}
              </Text>
            </View>

            <Text style={[typography.titleSmall, { color: '#FFFFFF', opacity: 0.9, marginTop: 2 }]}>
              {currentPhaseTheme.badge}
            </Text>

            {/* Giant Countdown Clock */}
            <View style={styles.clockCenterBox}>
              <Text
                style={[
                  typography.mono,
                  styles.giantClockText,
                ]}
              >
                {currentPhase === 'completed' ? '00:00' : formatTime(secondsRemaining)}
              </Text>
            </View>

            {/* Next Phase Preview */}
            {nextStep && nextStep.phase !== 'completed' && (
              <View style={styles.nextPhasePill}>
                <Text style={[typography.labelMedium, { color: '#FFFFFF', opacity: 0.9 }]}>
                  Sonraki: {PHASE_THEMES[nextStep.phase].title} ({nextStep.duration} sn)
                </Text>
              </View>
            )}

            {currentPhase === 'completed' && (
              <View style={styles.completedBadgeBox}>
                <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }]}>
                  🎉 Tebrikler! Tüm turlar başarıyla tamamlandı.
                </Text>
              </View>
            )}
          </View>

          {/* Interactive Controls Bar */}
          <View style={[styles.timerControlsRow, { marginTop: spacing.xl }]}>
            {/* Prev Step Button */}
            <TouchableOpacity
              onPress={() => goToStep(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              style={[
                styles.subControlBtn,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderRadius: borderRadius.full,
                  opacity: currentStepIndex === 0 ? 0.4 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Önceki aşamaya dön"
            >
              <Ionicons name="play-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>

            {/* Main Play/Pause Button */}
            {status === 'running' ? (
              <TouchableOpacity
                onPress={handlePause}
                style={[
                  styles.mainPlayPauseBtn,
                  {
                    backgroundColor: theme.warning,
                    borderRadius: borderRadius.full,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Duraklat"
              >
                <Ionicons name="pause" size={36} color="#FFFFFF" />
              </TouchableOpacity>
            ) : currentPhase === 'completed' ? (
              <TouchableOpacity
                onPress={handleReset}
                style={[
                  styles.mainPlayPauseBtn,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.full,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Yeniden Başla"
              >
                <Ionicons name="refresh" size={36} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleResume}
                style={[
                  styles.mainPlayPauseBtn,
                  {
                    backgroundColor: theme.success,
                    borderRadius: borderRadius.full,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Devam Et"
              >
                <Ionicons name="play" size={36} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {/* Next Step Button */}
            <TouchableOpacity
              onPress={() => goToStep(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex >= steps.length - 1}
              style={[
                styles.subControlBtn,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderRadius: borderRadius.full,
                  opacity: currentStepIndex >= steps.length - 1 ? 0.4 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sonraki aşamaya atla"
            >
              <Ionicons name="play-forward" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Reset / Exit Button */}
          <TouchableOpacity
            onPress={handleReset}
            style={[
              styles.resetBtn,
              {
                backgroundColor: theme.surfaceVariant,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.md,
                marginTop: spacing.xl,
                paddingVertical: spacing.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Antrenmandan Çık ve Sıfırla"
          >
            <Ionicons name="stop-circle-outline" size={20} color={theme.error} />
            <Text
              style={[
                typography.labelLarge,
                { color: theme.error, marginLeft: spacing.xs },
              ]}
            >
              Bitir ve Ayarlara Dön
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Save Custom Preset Modal */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.saveModalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                Özel Şablon Olarak Kaydet
              </Text>
              <TouchableOpacity
                onPress={() => setSaveModalVisible(false)}
                style={[
                  styles.closeButtonCircle,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md }]}>
              Şablon Adı
            </Text>
            <TextInput
              value={newPresetName}
              onChangeText={setNewPresetName}
              placeholder="Örn: 20/10 Bacak Antrenmanı"
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

            <View
              style={[
                styles.presetSummaryBox,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderRadius: borderRadius.md,
                  marginTop: spacing.md,
                  padding: spacing.md,
                },
              ]}
            >
              <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                {prepTime}s Hazırlık • {workTime}s Çalışma • {restTime}s Dinlenme • {sets} Set • {rounds} Tur
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSavePreset}
              style={[
                styles.saveSubmitBtn,
                {
                  backgroundColor: theme.primary,
                  borderRadius: borderRadius.md,
                  marginTop: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Şablonu Kaydet"
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
              <Text
                style={[
                  typography.labelLarge,
                  { color: theme.onPrimary, marginLeft: spacing.xs },
                ]}
              >
                Şablonu Kaydet
              </Text>
            </TouchableOpacity>
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savePresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  presetsStrip: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  presetChip: {
    borderWidth: 1,
    minWidth: 130,
  },
  presetChipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepperLabelCol: {
    flex: 1,
  },
  badgeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalDurationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTimerWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  giantPhaseCard: {
    width: '100%',
    minHeight: 380,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  roundSetBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  roundSetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  phaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  clockCenterBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giantClockText: {
    color: '#FFFFFF',
    fontSize: 76,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  nextPhasePill: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  completedBadgeBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 12,
    width: '100%',
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
  },
  mainPlayPauseBtn: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  subControlBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    width: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  saveModalCard: {
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    borderWidth: 1,
  },
  presetSummaryBox: {},
  saveSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
