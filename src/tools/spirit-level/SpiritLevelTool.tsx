import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';
import { useTheme } from '../../core/theme';
import { SpiritLevelData, LevelCalibration, AngleUnit, SensorStatus } from './types';
import {
  processAccelerometerData,
  formatAngle,
  playLevelBeep,
  triggerLevelHaptic,
  triggerSoftHaptic,
} from './sensorService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BULLSEYE_SIZE = Math.min(SCREEN_WIDTH - 64, 260);
const BUBBLE_SIZE = 44;
const MAX_RADIUS = (BULLSEYE_SIZE - BUBBLE_SIZE) / 2;

export const SpiritLevelTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography, isDark } = useTheme();

  // State
  const [data, setData] = useState<SpiritLevelData>({
    pitch: 0,
    roll: 0,
    incline: 0,
    isLevel: true,
    rawX: 0,
    rawY: 0,
    rawZ: 1,
  });

  const [calibration, setCalibration] = useState<LevelCalibration>({
    pitchOffset: 0,
    rollOffset: 0,
    isCalibrated: false,
  });

  const [unit, setUnit] = useState<AngleUnit>('deg');
  const [isLocked, setIsLocked] = useState(false);
  const [lockedData, setLockedData] = useState<SpiritLevelData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>('active');
  const [simulatedPitch, setSimulatedPitch] = useState(0);
  const [simulatedRoll, setSimulatedRoll] = useState(0);
  const [activeLevelView, setActiveLevelView] = useState<'both' | 'bullseye' | 'tubes'>('both');

  // Low-pass filter refs
  const smoothedX = useRef(0);
  const smoothedY = useRef(0);
  const smoothedZ = useRef(1);
  const prevLevelState = useRef(false);
  const subscriptionRef = useRef<any>(null);

  // Sensor subscription
  useEffect(() => {
    let isMounted = true;

    async function initSensors() {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!available) {
          setSensorStatus('simulated');
          return;
        }

        Accelerometer.setUpdateInterval(30); // ~33 fps
        const sub = Accelerometer.addListener((accelData) => {
          if (!isMounted) return;

          // Low-pass filter (Exponential Moving Average)
          const alpha = 0.2;
          smoothedX.current = alpha * accelData.x + (1 - alpha) * smoothedX.current;
          smoothedY.current = alpha * accelData.y + (1 - alpha) * smoothedY.current;
          smoothedZ.current = alpha * accelData.z + (1 - alpha) * smoothedZ.current;

          const processed = processAccelerometerData(
            smoothedX.current,
            smoothedY.current,
            smoothedZ.current,
            calibration
          );

          setData(processed);
          setSensorStatus('active');
        });

        subscriptionRef.current = sub;
      } catch (err) {
        setSensorStatus('simulated');
      }
    }

    initSensors();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [calibration]);

  // Handle Level Transition Beep & Haptic
  useEffect(() => {
    const currentLevel = isLocked ? lockedData?.isLevel ?? false : data.isLevel;
    if (currentLevel && !prevLevelState.current) {
      if (soundEnabled) {
        playLevelBeep();
      }
      triggerLevelHaptic();
    }
    prevLevelState.current = currentLevel;
  }, [data.isLevel, isLocked, lockedData, soundEnabled]);

  // Active display data (either live or frozen/locked)
  const displayData = useMemo(() => {
    if (isLocked && lockedData) return lockedData;
    if (sensorStatus === 'simulated') {
      const clampedPitch = simulatedPitch - calibration.pitchOffset;
      const clampedRoll = simulatedRoll - calibration.rollOffset;
      const incline = Math.sqrt(clampedPitch * clampedPitch + clampedRoll * clampedRoll);
      return {
        pitch: clampedPitch,
        roll: clampedRoll,
        incline,
        isLevel: incline <= 0.4,
        rawX: 0,
        rawY: 0,
        rawZ: 1,
      };
    }
    return data;
  }, [isLocked, lockedData, sensorStatus, simulatedPitch, simulatedRoll, calibration, data]);

  // Bullseye bubble position (in pixels relative to center)
  const bubblePosition = useMemo(() => {
    // Map roll (X tilt) and pitch (Y tilt) to radius
    // Max visual deflection at ~15 degrees
    const maxAngle = 15;
    const factorX = Math.max(-1, Math.min(1, displayData.roll / maxAngle));
    const factorY = Math.max(-1, Math.min(1, displayData.pitch / maxAngle));

    const posX = factorX * MAX_RADIUS;
    const posY = -factorY * MAX_RADIUS; // Negative because tilting forward moves bubble forward

    // Constrain inside circle
    const dist = Math.sqrt(posX * posX + posY * posY);
    if (dist > MAX_RADIUS) {
      return {
        x: (posX / dist) * MAX_RADIUS,
        y: (posY / dist) * MAX_RADIUS,
      };
    }

    return { x: posX, y: posY };
  }, [displayData.roll, displayData.pitch]);

  // Horizontal tube bubble offset (-1 to +1)
  const horizBubbleOffset = useMemo(() => {
    const maxAngle = 20;
    return Math.max(-1, Math.min(1, displayData.roll / maxAngle));
  }, [displayData.roll]);

  // Vertical tube bubble offset (-1 to +1)
  const vertBubbleOffset = useMemo(() => {
    const maxAngle = 20;
    return Math.max(-1, Math.min(1, -displayData.pitch / maxAngle));
  }, [displayData.pitch]);

  // Calibration Tare
  const handleCalibrateZero = () => {
    triggerSoftHaptic();
    setCalibration({
      pitchOffset: displayData.pitch + calibration.pitchOffset,
      rollOffset: displayData.roll + calibration.rollOffset,
      isCalibrated: true,
    });
  };

  const handleResetCalibration = () => {
    triggerSoftHaptic();
    setCalibration({
      pitchOffset: 0,
      rollOffset: 0,
      isCalibrated: false,
    });
  };

  const handleToggleLock = () => {
    triggerSoftHaptic();
    if (!isLocked) {
      setLockedData(displayData);
      setIsLocked(true);
    } else {
      setIsLocked(false);
      setLockedData(null);
    }
  };

  const levelColor = displayData.isLevel
    ? '#10B981' // Green
    : displayData.incline <= 2.0
    ? '#F59E0B' // Amber
    : theme.primary; // Accent

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header & Status */}
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <Text style={[typography.titleLarge, { color: theme.textPrimary }]}>
            Su Terazisi & Açı Ölçer
          </Text>
          {calibration.isCalibrated && (
            <View style={[styles.badge, { backgroundColor: theme.warningContainer }]}>
              <Text style={[typography.labelSmall, { color: theme.warning }]}>
                Sıfırlandı (Tare)
              </Text>
            </View>
          )}
        </View>
        <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
          2D Dairesel ve 1D Tüp hassas yüzey dengeleme
        </Text>
      </View>

      {/* Main Level Status Glow Banner */}
      <View
        style={[
          styles.statusBanner,
          {
            backgroundColor: displayData.isLevel
              ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7'
              : displayData.incline <= 2.0
              ? isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7'
              : theme.surface,
            borderColor: displayData.isLevel ? '#10B981' : theme.cardBorder,
          },
        ]}
      >
        <View style={styles.statusIndicatorRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: displayData.isLevel ? '#10B981' : displayData.incline <= 2.0 ? '#F59E0B' : theme.textMuted },
            ]}
          />
          <Text
            style={[
              typography.titleMedium,
              {
                color: displayData.isLevel
                  ? '#10B981'
                  : displayData.incline <= 2.0
                  ? '#D97706'
                  : theme.textPrimary,
                fontWeight: '700',
              },
            ]}
          >
            {displayData.isLevel
              ? 'DÜZ VE DENGEDE (0.0°)'
              : displayData.incline <= 2.0
              ? `HİZAYA YAKIN (${displayData.incline.toFixed(1)}°)`
              : `EĞİK YÜZEY (${displayData.incline.toFixed(1)}°)`}
          </Text>
        </View>
        <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
          Toplam Sapma: {formatAngle(displayData.incline, unit)}
        </Text>
      </View>

      {/* View Switcher: Both | Bullseye | Tubes */}
      <View style={[styles.viewSwitchRow, { backgroundColor: theme.surfaceVariant }]}>
        <TouchableOpacity
          style={[
            styles.viewSwitchBtn,
            activeLevelView === 'both' && { backgroundColor: theme.surface, elevation: 2 },
          ]}
          onPress={() => setActiveLevelView('both')}
        >
          <Text
            style={[
              typography.labelMedium,
              { color: activeLevelView === 'both' ? theme.primary : theme.textSecondary },
            ]}
          >
            Tümü
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewSwitchBtn,
            activeLevelView === 'bullseye' && { backgroundColor: theme.surface, elevation: 2 },
          ]}
          onPress={() => setActiveLevelView('bullseye')}
        >
          <Text
            style={[
              typography.labelMedium,
              { color: activeLevelView === 'bullseye' ? theme.primary : theme.textSecondary },
            ]}
          >
            2D Dairesel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewSwitchBtn,
            activeLevelView === 'tubes' && { backgroundColor: theme.surface, elevation: 2 },
          ]}
          onPress={() => setActiveLevelView('tubes')}
        >
          <Text
            style={[
              typography.labelMedium,
              { color: activeLevelView === 'tubes' ? theme.primary : theme.textSecondary },
            ]}
          >
            1D Tüpler
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2D BULLSEYE CIRCULAR LEVEL */}
      {(activeLevelView === 'both' || activeLevelView === 'bullseye') && (
        <View style={[styles.bullseyeContainer, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
            2D YÜZEY BOĞA GÖZÜ (BULLSEYE)
          </Text>

          <View
            style={[
              styles.bullseyeOuterRing,
              {
                width: BULLSEYE_SIZE,
                height: BULLSEYE_SIZE,
                borderRadius: BULLSEYE_SIZE / 2,
                backgroundColor: isDark ? '#0B132B' : '#E2E8F0',
                borderColor: displayData.isLevel ? '#10B981' : theme.cardBorder,
              },
            ]}
          >
            {/* Concentric rings for degree markers */}
            <View style={[styles.bullseyeRing, { width: BULLSEYE_SIZE * 0.75, height: BULLSEYE_SIZE * 0.75, borderRadius: (BULLSEYE_SIZE * 0.75) / 2 }]} />
            <View style={[styles.bullseyeRing, { width: BULLSEYE_SIZE * 0.5, height: BULLSEYE_SIZE * 0.5, borderRadius: (BULLSEYE_SIZE * 0.5) / 2 }]} />
            <View
              style={[
                styles.bullseyeCenterRing,
                {
                  width: BUBBLE_SIZE + 8,
                  height: BUBBLE_SIZE + 8,
                  borderRadius: (BUBBLE_SIZE + 8) / 2,
                  borderColor: displayData.isLevel ? '#10B981' : 'rgba(100, 116, 139, 0.4)',
                  backgroundColor: displayData.isLevel ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                },
              ]}
            />

            {/* Crosshairs */}
            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />

            {/* Floating Bubble */}
            <View
              style={[
                styles.bullseyeBubble,
                {
                  transform: [
                    { translateX: bubblePosition.x },
                    { translateY: bubblePosition.y },
                  ],
                  backgroundColor: levelColor,
                  shadowColor: levelColor,
                },
              ]}
            >
              {/* Inner bubble shine */}
              <View style={styles.bubbleShine} />
            </View>

            {/* Center target cross */}
            <View style={[styles.centerPoint, { backgroundColor: displayData.isLevel ? '#10B981' : '#64748B' }]} />
          </View>

          {/* Angle readout below bullseye */}
          <View style={styles.bullseyeReadoutRow}>
            <View style={styles.axisValueCol}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Y-EKSENİ (PITCH)</Text>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                {formatAngle(displayData.pitch, unit)}
              </Text>
            </View>
            <View style={styles.axisDivider} />
            <View style={styles.axisValueCol}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>X-EKSENİ (ROLL)</Text>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                {formatAngle(displayData.roll, unit)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 1D TUBE LEVELS (Horizontal & Vertical) */}
      {(activeLevelView === 'both' || activeLevelView === 'tubes') && (
        <View style={[styles.tubesContainer, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 12 }]}>
            1D TÜP SEVİYELERİ
          </Text>

          {/* Horizontal Tube (X-Axis) */}
          <View style={styles.tubeBlock}>
            <View style={styles.tubeLabelRow}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>YATAY TÜP (X / ROLL)</Text>
              <Text style={[typography.labelMedium, { color: Math.abs(displayData.roll) <= 0.4 ? '#10B981' : theme.textPrimary }]}>
                {formatAngle(displayData.roll, unit)}
              </Text>
            </View>
            <View style={[styles.tubeHOuter, { backgroundColor: isDark ? '#0F172A' : '#E2E8F0', borderColor: theme.cardBorder }]}>
              {/* Center Target lines */}
              <View style={styles.tubeHCenterLines} />
              {/* Tick marks */}
              <View style={[styles.tubeTick, { left: '25%' }]} />
              <View style={[styles.tubeTick, { left: '75%' }]} />
              {/* Tube Bubble */}
              <View
                style={[
                  styles.tubeHBubble,
                  {
                    transform: [{ translateX: horizBubbleOffset * 90 }],
                    backgroundColor: Math.abs(displayData.roll) <= 0.4 ? '#10B981' : theme.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* Vertical Tube (Y-Axis) */}
          <View style={[styles.tubeBlock, { marginTop: 16 }]}>
            <View style={styles.tubeLabelRow}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>DÜŞEY TÜP (Y / PITCH)</Text>
              <Text style={[typography.labelMedium, { color: Math.abs(displayData.pitch) <= 0.4 ? '#10B981' : theme.textPrimary }]}>
                {formatAngle(displayData.pitch, unit)}
              </Text>
            </View>
            <View style={[styles.tubeHOuter, { backgroundColor: isDark ? '#0F172A' : '#E2E8F0', borderColor: theme.cardBorder }]}>
              {/* Center Target lines */}
              <View style={styles.tubeHCenterLines} />
              {/* Tick marks */}
              <View style={[styles.tubeTick, { left: '25%' }]} />
              <View style={[styles.tubeTick, { left: '75%' }]} />
              {/* Tube Bubble */}
              <View
                style={[
                  styles.tubeHBubble,
                  {
                    transform: [{ translateX: vertBubbleOffset * 90 }],
                    backgroundColor: Math.abs(displayData.pitch) <= 0.4 ? '#10B981' : theme.primary,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* UNIT SELECTOR CHIPS */}
      <View style={styles.sectionBlock}>
        <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
          ÖLÇÜM BİRİMİ
        </Text>
        <View style={styles.unitRow}>
          {(
            [
              { key: 'deg', label: 'Derece (°)' },
              { key: 'percent', label: 'Eğim (%)' },
              { key: 'roofPitch', label: 'Çatı (X:12)' },
              { key: 'mmPerMeter', label: 'mm/m' },
            ] as const
          ).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.unitChip,
                {
                  backgroundColor: unit === item.key ? theme.primary : theme.surface,
                  borderColor: unit === item.key ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                triggerSoftHaptic();
                setUnit(item.key);
              }}
            >
              <Text
                style={[
                  typography.labelMedium,
                  { color: unit === item.key ? theme.onPrimary : theme.textPrimary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ACTION BUTTONS: Lock/Hold, Tare/Calibrate, Sound Toggle */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[
            styles.actionCard,
            {
              backgroundColor: isLocked ? theme.errorContainer : theme.surface,
              borderColor: isLocked ? theme.error : theme.cardBorder,
            },
          ]}
          onPress={handleToggleLock}
        >
          <Ionicons
            name={isLocked ? 'lock-closed' : 'lock-open-outline'}
            size={24}
            color={isLocked ? theme.error : theme.textPrimary}
          />
          <Text
            style={[
              typography.labelMedium,
              { color: isLocked ? theme.error : theme.textPrimary, marginTop: 4 },
            ]}
          >
            {isLocked ? 'Donduruldu' : 'Değeri Kilitle'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
          onPress={handleCalibrateZero}
        >
          <Ionicons name="refresh-circle-outline" size={24} color={theme.accent} />
          <Text style={[typography.labelMedium, { color: theme.textPrimary, marginTop: 4 }]}>
            Sıfırla (Tare)
          </Text>
        </TouchableOpacity>

        {calibration.isCalibrated && (
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
            onPress={handleResetCalibration}
          >
            <Ionicons name="close-circle-outline" size={24} color={theme.warning} />
            <Text style={[typography.labelMedium, { color: theme.textPrimary, marginTop: 4 }]}>
              Sıfırı Kaldır
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
          onPress={() => {
            triggerSoftHaptic();
            setSoundEnabled(!soundEnabled);
          }}
        >
          <Ionicons
            name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
            size={24}
            color={soundEnabled ? theme.success : theme.textMuted}
          />
          <Text style={[typography.labelMedium, { color: theme.textPrimary, marginTop: 4 }]}>
            {soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Web / Simulated Tilt Controller fallback if running in browser/emulator */}
      {(sensorStatus === 'simulated' || Platform.OS === 'web') && (
        <View style={[styles.simulatedCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.simulatedHeader}>
            <Ionicons name="game-controller-outline" size={20} color={theme.primary} />
            <Text style={[typography.labelMedium, { color: theme.primary, marginLeft: 6 }]}>
              Web / Simülasyon Kontrolleri
            </Text>
          </View>
          <Text style={[typography.bodySmall, { color: theme.textSecondary, marginBottom: 8 }]}>
            Sensör verisi olmadığında veya web üzerinde açıları manuel simüle edin:
          </Text>

          {/* Quick Level Preset Buttons */}
          <View style={styles.quickPresetRow}>
            <TouchableOpacity
              style={[styles.presetBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => {
                setSimulatedPitch(0);
                setSimulatedRoll(0);
              }}
            >
              <Text style={[typography.labelSmall, { color: '#10B981' }]}>0.0° Tam Düz</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => {
                setSimulatedPitch(4.5);
                setSimulatedRoll(2.0);
              }}
            >
              <Text style={[typography.labelSmall, { color: theme.textPrimary }]}>4.5° Hafif Eğim</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => {
                setSimulatedPitch(12.0);
                setSimulatedRoll(-8.0);
              }}
            >
              <Text style={[typography.labelSmall, { color: theme.textPrimary }]}>12.0° Dik Eğim</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBanner: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  viewSwitchRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    marginBottom: 16,
  },
  viewSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  bullseyeContainer: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  bullseyeOuterRing: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  bullseyeRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
  },
  bullseyeCenterRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  crosshairH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
  },
  crosshairV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
  },
  bullseyeBubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  bubbleShine: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    position: 'absolute',
    top: 6,
    left: 8,
  },
  centerPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
  },
  bullseyeReadoutRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 18,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  axisValueCol: {
    alignItems: 'center',
  },
  axisDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  tubesContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  tubeBlock: {
    width: '100%',
  },
  tubeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tubeHOuter: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  tubeHCenterLines: {
    position: 'absolute',
    width: 44,
    height: '100%',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  tubeTick: {
    position: 'absolute',
    height: '60%',
    width: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
  },
  tubeHBubble: {
    width: 32,
    height: 28,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulatedCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  simulatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
});
