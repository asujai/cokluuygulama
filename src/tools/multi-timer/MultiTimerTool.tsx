import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { StopwatchLap, StopwatchStatus, MultiTimerItem, TimerPreset } from './types';
import {
  DEFAULT_PRESETS,
  formatStopwatchMs,
  formatDurationSeconds,
  playTimerFinishAlarm,
  playLapTickSound,
  triggerHapticNotification,
  triggerHapticImpact,
  loadSavedTimers,
  saveActiveTimers,
  loadSavedPresets,
} from './timerEngine';

const COLOR_PALETTE = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#EC4899', '#8B5CF6'];

export const MultiTimerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography, isDark } = useTheme();

  // Active Tab: 'stopwatch' | 'timers'
  const [activeTab, setActiveTab] = useState<'timers' | 'stopwatch'>('timers');

  // ==============================
  // STOPWATCH STATE
  // ==============================
  const [stopwatchStatus, setStopwatchStatus] = useState<StopwatchStatus>('idle');
  const [stopwatchElapsedMs, setStopwatchElapsedMs] = useState(0);
  const [laps, setLaps] = useState<StopwatchLap[]>([]);
  const stopwatchStartTimeRef = useRef<number>(0);
  const stopwatchSavedElapsedRef = useRef<number>(0);
  const stopwatchIntervalRef = useRef<any>(null);

  // Stopwatch ticking loop
  useEffect(() => {
    if (stopwatchStatus === 'running') {
      stopwatchStartTimeRef.current = Date.now() - stopwatchSavedElapsedRef.current;
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchElapsedMs(Date.now() - stopwatchStartTimeRef.current);
      }, 30);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [stopwatchStatus]);

  const handleStartStopwatch = () => {
    triggerHapticImpact();
    setStopwatchStatus('running');
  };

  const handlePauseStopwatch = () => {
    triggerHapticImpact();
    stopwatchSavedElapsedRef.current = stopwatchElapsedMs;
    setStopwatchStatus('paused');
  };

  const handleResetStopwatch = () => {
    triggerHapticImpact();
    setStopwatchStatus('idle');
    setStopwatchElapsedMs(0);
    stopwatchSavedElapsedRef.current = 0;
    setLaps([]);
  };

  const handleAddLap = () => {
    if (stopwatchStatus !== 'running') return;
    playLapTickSound();
    triggerHapticImpact();

    const currentTotalMs = stopwatchElapsedMs;
    const prevTotalMs = laps.length > 0 ? laps[0].totalTimeMs : 0;
    const lapTimeMs = currentTotalMs - prevTotalMs;
    const prevLapTime = laps.length > 0 ? laps[0].lapTimeMs : lapTimeMs;
    const diffVsPrevMs = lapTimeMs - prevLapTime;

    const newLap: StopwatchLap = {
      id: Date.now().toString(),
      lapNumber: laps.length + 1,
      lapTimeMs,
      totalTimeMs: currentTotalMs,
      diffVsPrevMs,
    };

    setLaps([newLap, ...laps]);
  };

  // Find fastest & slowest laps
  const { fastestLapId, slowestLapId } = useMemo(() => {
    if (laps.length < 2) return { fastestLapId: null, slowestLapId: null };

    let fastest = laps[0];
    let slowest = laps[0];

    laps.forEach((l) => {
      if (l.lapTimeMs < fastest.lapTimeMs) fastest = l;
      if (l.lapTimeMs > slowest.lapTimeMs) slowest = l;
    });

    return {
      fastestLapId: fastest.id,
      slowestLapId: slowest.id,
    };
  }, [laps]);

  const handleCopyLaps = async () => {
    if (laps.length === 0) return;
    triggerHapticImpact();
    const text = laps
      .map(
        (l) =>
          `Tur ${l.lapNumber}: ${formatStopwatchMs(l.lapTimeMs).main}${formatStopwatchMs(l.lapTimeMs).msPart} (Toplam: ${formatStopwatchMs(l.totalTimeMs).main}${formatStopwatchMs(l.totalTimeMs).msPart})`
      )
      .join('\n');
    await Clipboard.setStringAsync(text);
  };

  // ==============================
  // MULTI-TIMERS STATE
  // ==============================
  const [timers, setTimers] = useState<MultiTimerItem[]>([]);
  const [presets, setPresets] = useState<TimerPreset[]>(DEFAULT_PRESETS);
  const [modalVisible, setModalVisible] = useState(false);

  // New timer form state
  const [newTitle, setNewTitle] = useState('');
  const [newHours, setNewHours] = useState('0');
  const [newMinutes, setNewMinutes] = useState('5');
  const [newSeconds, setNewSeconds] = useState('0');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);

  // Load saved timers & presets
  useEffect(() => {
    loadSavedTimers().then((saved) => {
      if (saved && saved.length > 0) {
        // pause running timers upon app restart
        setTimers(saved.map((t) => ({ ...t, status: t.status === 'running' ? 'paused' : t.status })));
      } else {
        // initial sample timer
        setTimers([
          {
            id: 'sample-1',
            title: 'Çay Demleme',
            totalSeconds: 240,
            remainingSeconds: 240,
            status: 'idle',
            color: '#D97706',
            createdAt: Date.now(),
          },
          {
            id: 'sample-2',
            title: 'Yumurta (Rafadan)',
            totalSeconds: 360,
            remainingSeconds: 360,
            status: 'idle',
            color: '#F59E0B',
            createdAt: Date.now(),
          },
        ]);
      }
    });

    loadSavedPresets().then((savedPresets) => {
      setPresets(savedPresets);
    });
  }, []);

  // Save timers on change
  useEffect(() => {
    saveActiveTimers(timers);
  }, [timers]);

  // Global Multi-Timer Tick Loop (1 second tick)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        let hasChanges = false;
        const updated = prevTimers.map((timer) => {
          if (timer.status === 'running') {
            hasChanges = true;
            if (timer.remainingSeconds <= 1) {
              // Timer finished!
              playTimerFinishAlarm();
              triggerHapticNotification();
              return {
                ...timer,
                remainingSeconds: 0,
                status: 'finished' as const,
              };
            }
            return {
              ...timer,
              remainingSeconds: timer.remainingSeconds - 1,
            };
          }
          return timer;
        });
        return hasChanges ? updated : prevTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Timer controls
  const handleToggleTimer = (id: string) => {
    triggerHapticImpact();
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          if (t.status === 'running') {
            return { ...t, status: 'paused' };
          } else {
            return { ...t, status: 'running' };
          }
        }
        return t;
      })
    );
  };

  const handleResetTimer = (id: string) => {
    triggerHapticImpact();
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            remainingSeconds: t.totalSeconds,
            status: 'idle',
          };
        }
        return t;
      })
    );
  };

  const handleAddMinute = (id: string) => {
    triggerHapticImpact();
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            totalSeconds: t.totalSeconds + 60,
            remainingSeconds: t.remainingSeconds + 60,
            status: t.status === 'finished' ? 'idle' : t.status,
          };
        }
        return t;
      })
    );
  };

  const handleDeleteTimer = (id: string) => {
    triggerHapticImpact();
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddPresetTimer = (preset: TimerPreset) => {
    triggerHapticImpact();
    const newTimer: MultiTimerItem = {
      id: Date.now().toString(),
      title: preset.title,
      totalSeconds: preset.seconds,
      remainingSeconds: preset.seconds,
      status: 'running',
      color: preset.color,
      createdAt: Date.now(),
    };
    setTimers([newTimer, ...timers]);
  };

  const handleCreateCustomTimer = () => {
    const h = parseInt(newHours, 10) || 0;
    const m = parseInt(newMinutes, 10) || 0;
    const s = parseInt(newSeconds, 10) || 0;
    const totalSec = h * 3600 + m * 60 + s;

    if (totalSec <= 0) return;

    triggerHapticImpact();
    const newTimer: MultiTimerItem = {
      id: Date.now().toString(),
      title: newTitle.trim() || `Sayaç (${formatDurationSeconds(totalSec)})`,
      totalSeconds: totalSec,
      remainingSeconds: totalSec,
      status: 'running',
      color: selectedColor,
      createdAt: Date.now(),
    };

    setTimers([newTimer, ...timers]);
    setModalVisible(false);
    setNewTitle('');
  };

  const stopwatchFormatted = formatStopwatchMs(stopwatchElapsedMs);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={[typography.titleLarge, { color: theme.textPrimary }]}>
          Kronometre & Çoklu Sayaç
        </Text>
        <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
          Hassas tur kayıtlı kronometre ve eşzamanlı bağımsız sayaçlar
        </Text>
      </View>

      {/* Mode Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.surfaceVariant }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'timers' && { backgroundColor: theme.surface, elevation: 2 },
          ]}
          onPress={() => {
            triggerHapticImpact();
            setActiveTab('timers');
          }}
        >
          <Ionicons
            name="hourglass-outline"
            size={18}
            color={activeTab === 'timers' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelLarge,
              {
                color: activeTab === 'timers' ? theme.primary : theme.textSecondary,
                marginLeft: 6,
              },
            ]}
          >
            Çoklu Sayaçlar ({timers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'stopwatch' && { backgroundColor: theme.surface, elevation: 2 },
          ]}
          onPress={() => {
            triggerHapticImpact();
            setActiveTab('stopwatch');
          }}
        >
          <Ionicons
            name="timer-outline"
            size={18}
            color={activeTab === 'stopwatch' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelLarge,
              {
                color: activeTab === 'stopwatch' ? theme.primary : theme.textSecondary,
                marginLeft: 6,
              },
            ]}
          >
            Kronometre
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================= */}
      {/* TAB 1: MULTI-TIMERS VIEW                  */}
      {/* ========================================= */}
      {activeTab === 'timers' && (
        <View>
          {/* Quick Presets Row */}
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
            HIZLI ŞABLONLAR
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {presets.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetCard,
                  { backgroundColor: theme.surface, borderColor: theme.cardBorder },
                ]}
                onPress={() => handleAddPresetTimer(preset)}
              >
                <Ionicons name={preset.icon as any} size={20} color={preset.color} />
                <Text style={[typography.labelMedium, { color: theme.textPrimary, marginTop: 4 }]}>
                  {preset.title}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  {formatDurationSeconds(preset.seconds)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Add New Custom Timer Button */}
          <TouchableOpacity
            style={[styles.addTimerBtn, { backgroundColor: theme.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
            <Text style={[typography.labelLarge, { color: '#FFFFFF', marginLeft: 8 }]}>
              Yeni Sayaç Ekle
            </Text>
          </TouchableOpacity>

          {/* Active Timers List */}
          <View style={styles.timersList}>
            {timers.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                <Ionicons name="alarm-outline" size={36} color={theme.textMuted} />
                <Text style={[typography.titleSmall, { color: theme.textSecondary, marginTop: 8 }]}>
                  Aktif Sayaç Bulunmuyor
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textMuted, textAlign: 'center', marginTop: 4 }]}>
                  Yukarıdaki şablonlardan birine tıklayın veya özel bir sayaç oluşturun.
                </Text>
              </View>
            ) : (
              timers.map((item) => {
                const progressPct =
                  item.totalSeconds > 0
                    ? Math.max(0, Math.min(100, (item.remainingSeconds / item.totalSeconds) * 100))
                    : 0;

                const isFinished = item.status === 'finished';

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.timerCard,
                      {
                        backgroundColor: isFinished
                          ? isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2'
                          : theme.surface,
                        borderColor: isFinished ? '#EF4444' : theme.cardBorder,
                      },
                    ]}
                  >
                    {/* Header */}
                    <View style={styles.timerCardHeader}>
                      <View style={styles.timerTitleRow}>
                        <View style={[styles.timerColorDot, { backgroundColor: item.color }]} />
                        <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                          {item.title}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteTimer(item.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Remaining Time & Finished Banner */}
                    <View style={styles.timerBody}>
                      <Text
                        style={[
                          styles.timerCountdown,
                          {
                            color: isFinished
                              ? '#EF4444'
                              : item.status === 'running'
                              ? theme.primary
                              : theme.textPrimary,
                          },
                        ]}
                      >
                        {formatDurationSeconds(item.remainingSeconds)}
                      </Text>

                      {isFinished && (
                        <View style={styles.finishedBadge}>
                          <Text style={[typography.labelMedium, { color: '#EF4444', fontWeight: '700' }]}>
                            SÜRE DOLDU! 🔔
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.progressBarTrack, { backgroundColor: theme.surfaceVariant }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${progressPct}%`,
                            backgroundColor: isFinished ? '#EF4444' : item.color,
                          },
                        ]}
                      />
                    </View>

                    {/* Action Controls */}
                    <View style={styles.timerActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.timerActionBtn,
                          {
                            backgroundColor:
                              item.status === 'running' ? theme.warning : theme.primary,
                          },
                        ]}
                        onPress={() => handleToggleTimer(item.id)}
                      >
                        <Ionicons
                          name={item.status === 'running' ? 'pause' : 'play'}
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 4 }]}>
                          {item.status === 'running' ? 'Durdur' : 'Başlat'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.timerSecBtn, { backgroundColor: theme.surfaceVariant }]}
                        onPress={() => handleResetTimer(item.id)}
                      >
                        <Ionicons name="refresh" size={16} color={theme.textPrimary} />
                        <Text style={[typography.labelSmall, { color: theme.textPrimary, marginLeft: 4 }]}>
                          Sıfırla
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.timerSecBtn, { backgroundColor: theme.surfaceVariant }]}
                        onPress={() => handleAddMinute(item.id)}
                      >
                        <Ionicons name="add" size={16} color={theme.textPrimary} />
                        <Text style={[typography.labelSmall, { color: theme.textPrimary, marginLeft: 2 }]}>
                          +1 dk
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* ========================================= */}
      {/* TAB 2: STOPWATCH VIEW                     */}
      {/* ========================================= */}
      {activeTab === 'stopwatch' && (
        <View>
          {/* Main Stopwatch Digital Display */}
          <View style={[styles.stopwatchCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.stopwatchDigitsRow}>
              <Text style={[styles.stopwatchMainDigits, { color: theme.textPrimary }]}>
                {stopwatchFormatted.main}
              </Text>
              <Text style={[styles.stopwatchMsDigits, { color: theme.primary }]}>
                {stopwatchFormatted.msPart}
              </Text>
            </View>

            {/* Stopwatch Buttons */}
            <View style={styles.stopwatchButtonsRow}>
              {stopwatchStatus === 'running' ? (
                <>
                  <TouchableOpacity
                    style={[styles.stopwatchCircleBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={handleAddLap}
                  >
                    <Text style={[typography.labelLarge, { color: theme.textPrimary }]}>Tur (Lap)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.stopwatchCircleBtn, { backgroundColor: '#EF4444' }]}
                    onPress={handlePauseStopwatch}
                  >
                    <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Durdur</Text>
                  </TouchableOpacity>
                </>
              ) : stopwatchStatus === 'paused' ? (
                <>
                  <TouchableOpacity
                    style={[styles.stopwatchCircleBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={handleResetStopwatch}
                  >
                    <Text style={[typography.labelLarge, { color: theme.textPrimary }]}>Sıfırla</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.stopwatchCircleBtn, { backgroundColor: '#10B981' }]}
                    onPress={handleStartStopwatch}
                  >
                    <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Devam Et</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.stopwatchBigStartBtn, { backgroundColor: '#10B981' }]}
                  onPress={handleStartStopwatch}
                >
                  <Ionicons name="play" size={24} color="#FFFFFF" />
                  <Text style={[typography.titleMedium, { color: '#FFFFFF', marginLeft: 8 }]}>
                    Başlat
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Lap History List */}
          {laps.length > 0 && (
            <View style={[styles.lapsCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <View style={styles.lapsHeader}>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                  Tur Kayıtları ({laps.length})
                </Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLaps}>
                  <Ionicons name="copy-outline" size={16} color={theme.primary} />
                  <Text style={[typography.labelSmall, { color: theme.primary, marginLeft: 4 }]}>
                    Kopyala
                  </Text>
                </TouchableOpacity>
              </View>

              {laps.map((lap) => {
                const isFastest = lap.id === fastestLapId;
                const isSlowest = lap.id === slowestLapId;
                const lapFormatted = formatStopwatchMs(lap.lapTimeMs);
                const totalFormatted = formatStopwatchMs(lap.totalTimeMs);

                return (
                  <View
                    key={lap.id}
                    style={[
                      styles.lapRow,
                      {
                        borderBottomColor: theme.cardBorder,
                        backgroundColor: isFastest
                          ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7'
                          : isSlowest
                          ? isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2'
                          : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.lapNumberCol}>
                      <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
                        Tur {lap.lapNumber}
                      </Text>
                      {isFastest && (
                        <Text style={[styles.lapBadge, { color: '#10B981' }]}>En Hızlı</Text>
                      )}
                      {isSlowest && (
                        <Text style={[styles.lapBadge, { color: '#EF4444' }]}>En Yavaş</Text>
                      )}
                    </View>

                    <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
                      {totalFormatted.main}{totalFormatted.msPart}
                    </Text>

                    <Text
                      style={[
                        typography.titleSmall,
                        {
                          color: isFastest ? '#10B981' : isSlowest ? '#EF4444' : theme.textPrimary,
                        },
                      ]}
                    >
                      +{lapFormatted.main}{lapFormatted.msPart}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================= */}
      {/* MODAL: ADD CUSTOM TIMER                   */}
      {/* ========================================= */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                Yeni Sayaç Oluştur
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Title Input */}
            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: 12 }]}>
              Sayaç Başlığı (Örn: Çay, Egzersiz)
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.inputBorder,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="Sayaç adı girin..."
              placeholderTextColor={theme.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            {/* Time Inputs: Hours, Minutes, Seconds */}
            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: 14 }]}>
              Süre Ayarı
            </Text>
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Saat</Text>
                <TextInput
                  style={[
                    styles.timeBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={newHours}
                  onChangeText={setNewHours}
                  maxLength={2}
                />
              </View>

              <Text style={[styles.timeColon, { color: theme.textPrimary }]}>:</Text>

              <View style={styles.timeInputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Dakika</Text>
                <TextInput
                  style={[
                    styles.timeBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={newMinutes}
                  onChangeText={setNewMinutes}
                  maxLength={2}
                />
              </View>

              <Text style={[styles.timeColon, { color: theme.textPrimary }]}>:</Text>

              <View style={styles.timeInputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Saniye</Text>
                <TextInput
                  style={[
                    styles.timeBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={newSeconds}
                  onChangeText={setNewSeconds}
                  maxLength={2}
                />
              </View>
            </View>

            {/* Color Palette */}
            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: 14 }]}>
              Renk Etiketi
            </Text>
            <View style={styles.colorPaletteRow}>
              {COLOR_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    selectedColor === c && styles.selectedColorCircle,
                  ]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>

            {/* Action Submit */}
            <TouchableOpacity
              style={[styles.createSubmitBtn, { backgroundColor: theme.primary }]}
              onPress={handleCreateCustomTimer}
            >
              <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Sayacı Başlat</Text>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBar: {
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  presetCard: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 105,
  },
  addTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  timersList: {
    gap: 12,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  timerCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  timerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  timerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  timerCountdown: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  finishedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timerActionBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  timerSecBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  stopwatchCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  stopwatchDigitsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 12,
  },
  stopwatchMainDigits: {
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: -1,
  },
  stopwatchMsDigits: {
    fontSize: 28,
    fontWeight: '700',
  },
  stopwatchButtonsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    width: '100%',
    justifyContent: 'center',
  },
  stopwatchCircleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopwatchBigStartBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lapsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  lapsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 8,
  },
  lapNumberCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lapBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  timeInputCol: {
    alignItems: 'center',
    flex: 1,
  },
  timeBox: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  timeColon: {
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 8,
    marginTop: 18,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  selectedColorCircle: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  createSubmitBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
});
