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
import { Magnetometer, Accelerometer } from 'expo-sensors';
import { useTheme } from '../../core/theme';
import { CompassData, HeadingLock, CompassSensorStatus } from './types';
import {
  getCardinalDirection,
  calculateHeading,
  smoothAngle,
  calculateDeviation,
  estimateAccuracy,
  triggerCompassHaptic,
  triggerTargetAlignedHaptic,
} from './compassService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(SCREEN_WIDTH - 64, 280);

export const CompassTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography, isDark } = useTheme();

  // Heading & Sensor State
  const [heading, setHeading] = useState(0);
  const [simulatedHeading, setSimulatedHeading] = useState(0);
  const [sensorStatus, setSensorStatus] = useState<CompassSensorStatus>('active');
  const [magneticDeclination, setMagneticDeclination] = useState(6.0); // +6° typical in Turkey
  const [useTrueNorth, setUseTrueNorth] = useState(false);
  const [isFlat, setIsFlat] = useState(true);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [fieldStrength, setFieldStrength] = useState(48.5);

  // Target Heading Lock / Course Tracker
  const [targetLock, setTargetLock] = useState<HeadingLock>({
    locked: false,
    targetHeading: 0,
    deviation: 0,
  });

  const smoothedHeadingRef = useRef(0);
  const prevAlignedRef = useRef(false);
  const magSubRef = useRef<any>(null);
  const accelSubRef = useRef<any>(null);

  // Initialize sensors
  useEffect(() => {
    let isMounted = true;

    async function startSensors() {
      try {
        const magAvailable = await Magnetometer.isAvailableAsync();
        if (!magAvailable) {
          setSensorStatus('simulated');
          return;
        }

        Magnetometer.setUpdateInterval(40); // 25 fps
        const magSub = Magnetometer.addListener((data) => {
          if (!isMounted) return;

          const rawAngle = calculateHeading(data.x, data.y);
          const smoothed = smoothAngle(smoothedHeadingRef.current, rawAngle, 0.25);
          smoothedHeadingRef.current = smoothed;

          // Magnetic strength in microteslas
          const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);

          setHeading(smoothed);
          setFieldStrength(magnitude);
          setSensorStatus('active');
        });
        magSubRef.current = magSub;

        // Also listen to accelerometer to check if phone is held flat
        const accelAvailable = await Accelerometer.isAvailableAsync();
        if (accelAvailable) {
          Accelerometer.setUpdateInterval(100);
          const accelSub = Accelerometer.addListener((accel) => {
            if (!isMounted) return;
            setTiltX(accel.x);
            setTiltY(accel.y);
            const flat = Math.abs(accel.x) < 0.25 && Math.abs(accel.y) < 0.25;
            setIsFlat(flat);
          });
          accelSubRef.current = accelSub;
        }
      } catch {
        setSensorStatus('simulated');
      }
    }

    startSensors();

    return () => {
      isMounted = false;
      if (magSubRef.current) {
        magSubRef.current.remove();
        magSubRef.current = null;
      }
      if (accelSubRef.current) {
        accelSubRef.current.remove();
        accelSubRef.current = null;
      }
    };
  }, []);

  // Compute active displayed heading (with optional true north offset)
  const currentHeading = sensorStatus === 'simulated' ? simulatedHeading : heading;
  const activeHeading = useTrueNorth
    ? (currentHeading + magneticDeclination + 360) % 360
    : currentHeading;

  const cardinalInfo = useMemo(
    () => getCardinalDirection(activeHeading),
    [activeHeading]
  );

  const accuracy = useMemo(
    () => estimateAccuracy(fieldStrength),
    [fieldStrength]
  );

  // Update target lock deviation
  const deviation = useMemo(() => {
    if (!targetLock.locked) return 0;
    return calculateDeviation(activeHeading, targetLock.targetHeading);
  }, [targetLock.locked, targetLock.targetHeading, activeHeading]);

  const isAlignedWithTarget = targetLock.locked && Math.abs(deviation) <= 3;

  // Haptic feedback when crossing target course
  useEffect(() => {
    if (isAlignedWithTarget && !prevAlignedRef.current) {
      triggerTargetAlignedHaptic();
    }
    prevAlignedRef.current = isAlignedWithTarget;
  }, [isAlignedWithTarget]);

  // Lock current heading
  const handleToggleLock = () => {
    triggerCompassHaptic();
    if (!targetLock.locked) {
      setTargetLock({
        locked: true,
        targetHeading: Math.round(activeHeading),
        deviation: 0,
      });
    } else {
      setTargetLock({
        locked: false,
        targetHeading: 0,
        deviation: 0,
      });
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Info */}
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <Text style={[typography.titleLarge, { color: theme.textPrimary }]}>
            Pusula
          </Text>
          <View
            style={[
              styles.accuracyBadge,
              {
                backgroundColor:
                  accuracy === 'high'
                    ? isDark ? 'rgba(16,185,129,0.2)' : '#DCFCE7'
                    : isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7',
              },
            ]}
          >
            <Ionicons
              name="radio-outline"
              size={12}
              color={accuracy === 'high' ? '#10B981' : '#F59E0B'}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: accuracy === 'high' ? '#10B981' : '#D97706',
                  marginLeft: 4,
                },
              ]}
            >
              {sensorStatus === 'simulated' ? 'Simülasyon' : accuracy === 'high' ? 'Yüksek Hassasiyet' : 'Orta Hassasiyet'}
            </Text>
          </View>
        </View>
        <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
          Manyetik ve gerçek kuzey yön bulucu & rota takibi
        </Text>
      </View>

      {/* Main Digital Heading Card */}
      <View style={[styles.mainHeadingCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Text style={[styles.degreeLarge, { color: theme.textPrimary }]}>
          {Math.round(activeHeading)}°
        </Text>
        <View style={styles.cardinalRow}>
          <Text style={[styles.cardinalAbbr, { color: '#EF4444' }]}>
            {cardinalInfo.cardinal}
          </Text>
          <Text style={[typography.titleMedium, { color: theme.textSecondary, marginLeft: 8 }]}>
            {cardinalInfo.name}
          </Text>
        </View>

        {/* Level Warning if phone is tilted */}
        {!isFlat && sensorStatus === 'active' && (
          <View style={[styles.tiltWarning, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}>
            <Ionicons name="alert-circle-outline" size={14} color="#D97706" />
            <Text style={[typography.bodySmall, { color: '#D97706', marginLeft: 4 }]}>
              Daha doğru sonuç için cihazı yatay tutun
            </Text>
          </View>
        )}
      </View>

      {/* COMPASS ROSE GRAPHICAL DIAL */}
      <View style={[styles.compassWrapper, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        {/* Top Fixed Needle Pointer */}
        <View style={styles.topPointer}>
          <View style={styles.topPointerTriangle} />
        </View>

        {/* Rotating Compass Dial */}
        <View
          style={[
            styles.compassDial,
            {
              width: COMPASS_SIZE,
              height: COMPASS_SIZE,
              borderRadius: COMPASS_SIZE / 2,
              backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
              borderColor: isDark ? '#334155' : '#CBD5E1',
              transform: [{ rotate: `${-activeHeading}deg` }],
            },
          ]}
        >
          {/* Degree Ticks */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <View
              key={deg}
              style={[
                styles.tickContainer,
                {
                  transform: [{ rotate: `${deg}deg` }],
                },
              ]}
            >
              <View
                style={[
                  styles.majorTick,
                  { backgroundColor: deg === 0 ? '#EF4444' : isDark ? '#64748B' : '#94A3B8' },
                ]}
              />
              <Text
                style={[
                  styles.tickLabel,
                  {
                    color: deg === 0 ? '#EF4444' : isDark ? '#94A3B8' : '#64748B',
                    transform: [{ rotate: `${-deg}deg` }],
                  },
                ]}
              >
                {deg === 0 ? 'K' : deg === 90 ? 'D' : deg === 180 ? 'G' : deg === 270 ? 'B' : `${deg}°`}
              </Text>
            </View>
          ))}

          {/* Target locked marker indicator on dial */}
          {targetLock.locked && (
            <View
              style={[
                styles.targetDialMarker,
                {
                  transform: [{ rotate: `${targetLock.targetHeading}deg` }],
                },
              ]}
            >
              <View style={styles.targetFlag} />
            </View>
          )}

          {/* Compass Needle (North Red / South Silver) */}
          <View style={styles.needleContainer}>
            <View style={styles.needleNorth} />
            <View style={styles.needleSouth} />
          </View>

          {/* Center Bubble Level Crosshair */}
          <View
            style={[
              styles.centerLevelBubble,
              {
                backgroundColor: isFlat ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                borderColor: isFlat ? '#10B981' : '#EF4444',
              },
            ]}
          >
            <View
              style={[
                styles.centerLevelDot,
                {
                  transform: [
                    { translateX: Math.max(-10, Math.min(10, tiltX * 25)) },
                    { translateY: Math.max(-10, Math.min(10, tiltY * 25)) },
                  ],
                  backgroundColor: isFlat ? '#10B981' : '#EF4444',
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* TARGET LOCK & COURSE TRACKER CARD */}
      <View
        style={[
          styles.targetCard,
          {
            backgroundColor: targetLock.locked
              ? isAlignedWithTarget
                ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7'
                : isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7'
              : theme.surface,
            borderColor: targetLock.locked
              ? isAlignedWithTarget ? '#10B981' : '#F59E0B'
              : theme.cardBorder,
          },
        ]}
      >
        <View style={styles.targetHeaderRow}>
          <View style={styles.targetTitleBlock}>
            <Ionicons
              name={targetLock.locked ? 'flag' : 'flag-outline'}
              size={20}
              color={targetLock.locked ? (isAlignedWithTarget ? '#10B981' : '#D97706') : theme.primary}
            />
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginLeft: 8 }]}>
              Hedef Rota Takibi
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.lockButton,
              {
                backgroundColor: targetLock.locked ? theme.error : theme.primary,
              },
            ]}
            onPress={handleToggleLock}
          >
            <Text style={[typography.labelMedium, { color: '#FFFFFF' }]}>
              {targetLock.locked ? 'Rotayı Bırak' : 'Rotayı Kilitle'}
            </Text>
          </TouchableOpacity>
        </View>

        {targetLock.locked ? (
          <View style={styles.targetInfoBlock}>
            <View style={styles.targetStatRow}>
              <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
                Kilitlenen Hedef: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{targetLock.targetHeading}°</Text>
              </Text>
              <Text
                style={[
                  typography.titleMedium,
                  {
                    fontWeight: '700',
                    color: isAlignedWithTarget ? '#10B981' : '#D97706',
                  },
                ]}
              >
                {isAlignedWithTarget
                  ? 'Tam Rotadasınız! ✓'
                  : deviation > 0
                  ? `${Math.abs(Math.round(deviation))}° Sağa Sapma →`
                  : `← ${Math.abs(Math.round(deviation))}° Sola Sapma`}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 6 }]}>
            Yürüyüş veya seyahatte rotanızı korumak için bulunduğunuz yönü kilitleyin.
          </Text>
        )}
      </View>

      {/* OPTIONS & SETTINGS (True North / Declination) */}
      <View style={[styles.optionsCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 12 }]}>
          AYARLAR & MANYETİK ALAN
        </Text>

        {/* True North Switch */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            triggerCompassHaptic();
            setUseTrueNorth(!useTrueNorth);
          }}
        >
          <View style={styles.optionLeft}>
            <Ionicons name="earth-outline" size={20} color={theme.accent} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[typography.bodyMedium, { color: theme.textPrimary, fontWeight: '600' }]}>
                Gerçek Kuzey (True North)
              </Text>
              <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                {useTrueNorth ? `Manyetik sapma (+${magneticDeclination.toFixed(1)}°) uygulandı` : 'Manyetik Kuzey aktif'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.switchPill,
              { backgroundColor: useTrueNorth ? theme.primary : theme.surfaceVariant },
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                { transform: [{ translateX: useTrueNorth ? 16 : 0 }] },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* Magnetic Field Info */}
        <View style={styles.fieldStatRow}>
          <View style={styles.fieldItem}>
            <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>MANYETİK ALAN</Text>
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              {fieldStrength.toFixed(1)} µT
            </Text>
          </View>
          <View style={styles.fieldDivider} />
          <View style={styles.fieldItem}>
            <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>SAPMA (TR)</Text>
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              +{magneticDeclination.toFixed(1)}°
            </Text>
          </View>
          <View style={styles.fieldDivider} />
          <View style={styles.fieldItem}>
            <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>DÜZEY</Text>
            <Text style={[typography.titleSmall, { color: isFlat ? '#10B981' : '#F59E0B' }]}>
              {isFlat ? 'Yatay ✓' : 'Eğik ⚠'}
            </Text>
          </View>
        </View>
      </View>

      {/* Web Simulation Controls */}
      {(sensorStatus === 'simulated' || Platform.OS === 'web') && (
        <View style={[styles.simulatedCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.simulatedHeader}>
            <Ionicons name="compass-outline" size={20} color={theme.primary} />
            <Text style={[typography.labelMedium, { color: theme.primary, marginLeft: 6 }]}>
              Web Simülasyon Yönü
            </Text>
          </View>
          <View style={styles.quickPresetRow}>
            {[
              { label: '0° Kuzey', val: 0 },
              { label: '90° Doğu', val: 90 },
              { label: '180° Güney', val: 180 },
              { label: '270° Batı', val: 270 },
            ].map((p) => (
              <TouchableOpacity
                key={p.val}
                style={[styles.presetBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => setSimulatedHeading(p.val)}
              >
                <Text style={[typography.labelSmall, { color: theme.textPrimary }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
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
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mainHeadingCard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  degreeLarge: {
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cardinalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -4,
  },
  cardinalAbbr: {
    fontSize: 22,
    fontWeight: '800',
  },
  tiltWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 10,
  },
  compassWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    position: 'relative',
  },
  topPointer: {
    position: 'absolute',
    top: 6,
    zIndex: 10,
    alignItems: 'center',
  },
  topPointerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
    transform: [{ rotate: '180deg' }],
  },
  compassDial: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  tickContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  majorTick: {
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  tickLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  targetDialMarker: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  targetFlag: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginTop: 14,
  },
  needleContainer: {
    position: 'absolute',
    width: 12,
    height: COMPASS_SIZE * 0.65,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  needleNorth: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: (COMPASS_SIZE * 0.65) / 2 - 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
  },
  needleSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: (COMPASS_SIZE * 0.65) / 2 - 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#94A3B8',
  },
  centerLevelBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  centerLevelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  targetCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  targetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  targetInfoBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  targetStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchPill: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  fieldStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  fieldItem: {
    alignItems: 'center',
  },
  fieldDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  simulatedCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  simulatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
});
