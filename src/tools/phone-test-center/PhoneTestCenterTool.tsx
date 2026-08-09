import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../../core/theme';
import { DiagnosticTestItem, SensorInfo, TestStatus } from './types';
import { checkAllSensors, triggerHapticTest } from './testCenterService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLOR_PATTERNS = [
  { name: 'Kırmızı', color: '#FF0000' },
  { name: 'Yeşil', color: '#00FF00' },
  { name: 'Mavi', color: '#0000FF' },
  { name: 'Beyaz', color: '#FFFFFF' },
  { name: 'Siyah', color: '#000000' },
  { name: 'Sarı', color: '#FFFF00' },
  { name: 'Camgöbeği', color: '#00FFFF' },
  { name: 'Eflatun', color: '#FF00FF' },
  { name: 'Izgara Deseni', color: '#111111', isGrid: true },
];

const INITIAL_TESTS: DiagnosticTestItem[] = [
  {
    id: 'colors',
    title: 'Ekran & Ölü Piksel',
    description: 'Tam ekran renk geçişleriyle ölü piksel ve renk sapması kontrolü',
    icon: 'color-palette-outline',
    status: 'untested',
  },
  {
    id: 'touch',
    title: 'Dokunmatik Matrisi',
    description: 'Ekranın tüm bölgelerinde dokunma hassasiyeti ve kapsama testi',
    icon: 'finger-print-outline',
    status: 'untested',
  },
  {
    id: 'vibration',
    title: 'Titreşim & Haptik',
    description: 'Farklı güçteki titreşim motoru geri bildirimlerinin testi',
    icon: 'phone-portrait-outline',
    status: 'untested',
  },
  {
    id: 'torch',
    title: 'Flaş & Meşale',
    description: 'Kamera flaşı ve arka meşale ışığı kontrolü',
    icon: 'flash-outline',
    status: 'untested',
  },
  {
    id: 'accelerometer',
    title: 'İvmeölçer & Denge',
    description: 'Cihaz eğim ve 3-eksen ivmeölçer verilerinin canlı testi',
    icon: 'compass-outline',
    status: 'untested',
  },
  {
    id: 'sensors',
    title: 'Sensör Taraması',
    description: 'Jiroskop, Manyetometre, Barometre ve diğer donanım kontrolü',
    icon: 'hardware-chip-outline',
    status: 'untested',
  },
];

export const PhoneTestCenterTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [tests, setTests] = useState<DiagnosticTestItem[]>(INITIAL_TESTS);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Color test state
  const [colorIndex, setColorIndex] = useState(0);

  // Touch test state
  const touchCols = 6;
  const touchRows = 10;
  const totalTouchTiles = touchCols * touchRows;
  const [touchedTiles, setTouchedTiles] = useState<Set<number>>(new Set());

  // Torch test state
  const [isTorchActive, setIsTorchActive] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Accelerometer state
  const [accelData, setAccelData] = useState({ x: 0, y: 0, z: 0 });
  const [isAccelAvailable, setIsAccelAvailable] = useState<boolean | null>(null);

  // Sensors scan state
  const [sensorList, setSensorList] = useState<SensorInfo[]>([]);
  const [isScanningSensors, setIsScanningSensors] = useState(false);

  // Accelerometer subscription
  useEffect(() => {
    let subscription: any = null;
    if (activeModal === 'accelerometer') {
      Accelerometer.isAvailableAsync().then((avail) => {
        setIsAccelAvailable(avail);
        if (avail) {
          Accelerometer.setUpdateInterval(100);
          subscription = Accelerometer.addListener((data) => {
            setAccelData(data);
          });
        }
      });
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, [activeModal]);

  // Initial sensors scan
  useEffect(() => {
    runSensorsScan();
  }, []);

  const runSensorsScan = async () => {
    setIsScanningSensors(true);
    const results = await checkAllSensors();
    setSensorList(results);
    setIsScanningSensors(false);

    // Update sensors test status automatically based on real checks
    const availableCount = results.filter((s) => s.available).length;
    updateTestStatus('sensors', availableCount > 0 ? 'passed' : 'unsupported');
  };

  const updateTestStatus = (id: string, status: TestStatus) => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );
  };

  // Color test actions
  const nextColor = () => {
    if (colorIndex < COLOR_PATTERNS.length - 1) {
      setColorIndex(colorIndex + 1);
    } else {
      setColorIndex(0);
    }
  };

  // Touch test actions
  const handleTouchTile = (index: number) => {
    setTouchedTiles((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const resetTouchTest = () => {
    setTouchedTiles(new Set());
  };

  // Summary counts
  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const failedCount = tests.filter((t) => t.status === 'failed').length;
  const unsupportedCount = tests.filter((t) => t.status === 'unsupported').length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header / Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="speedometer-outline" size={28} color={theme.primary} />
          <View style={styles.summaryTextContainer}>
            <Text style={[styles.summaryTitle, { color: theme.textPrimary }]}>
              Donanım Test Merkezi
            </Text>
            <Text style={[styles.summarySub, { color: theme.textSecondary }]}>
              Cihaz ekran, dokunmatik, titreşim ve sensör doğrulama paneli
            </Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: theme.successContainer }]}>
            <Ionicons name="checkmark-circle" size={14} color={theme.success} />
            <Text style={[styles.badgeLabel, { color: theme.success }]}>
              {passedCount} Başarılı
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: theme.errorContainer }]}>
            <Ionicons name="close-circle" size={14} color={theme.error} />
            <Text style={[styles.badgeLabel, { color: theme.error }]}>
              {failedCount} Başarısız
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: theme.surfaceVariant }]}>
            <Ionicons name="help-circle" size={14} color={theme.textMuted} />
            <Text style={[styles.badgeLabel, { color: theme.textSecondary }]}>
              {unsupportedCount} Desteklenmiyor
            </Text>
          </View>
        </View>
      </View>

      {/* Tests Grid */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Test Modülleri
        </Text>
      </View>

      <View style={styles.testList}>
        {tests.map((test) => {
          let statusBg = theme.surfaceVariant;
          let statusText = 'Test Edilmedi';
          let statusIcon: any = 'ellipsis-horizontal-circle-outline';
          let statusColor = theme.textMuted;

          if (test.status === 'passed') {
            statusBg = theme.successContainer;
            statusText = 'BAŞARILI';
            statusIcon = 'checkmark-circle';
            statusColor = theme.success;
          } else if (test.status === 'failed') {
            statusBg = theme.errorContainer;
            statusText = 'BAŞARISIZ';
            statusIcon = 'close-circle';
            statusColor = theme.error;
          } else if (test.status === 'unsupported') {
            statusBg = theme.warningContainer;
            statusText = 'DESTEKLENMİYOR';
            statusIcon = 'alert-circle';
            statusColor = theme.warning;
          }

          return (
            <TouchableOpacity
              key={test.id}
              style={[
                styles.testItemCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
              onPress={() => setActiveModal(test.id)}
            >
              <View style={[styles.testIconBox, { backgroundColor: theme.primaryContainer }]}>
                <Ionicons name={test.icon as any} size={24} color={theme.primary} />
              </View>

              <View style={styles.testInfo}>
                <Text style={[styles.testTitle, { color: theme.textPrimary }]}>
                  {test.title}
                </Text>
                <Text style={[styles.testDesc, { color: theme.textSecondary }]}>
                  {test.description}
                </Text>
              </View>

              <View style={[styles.pillBadge, { backgroundColor: statusBg }]}>
                <Ionicons name={statusIcon} size={12} color={statusColor} />
                <Text style={[styles.pillText, { color: statusColor }]}>{statusText}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ----------------- MODALS ----------------- */}

      {/* 1) Color & Dead Pixel Modal */}
      <Modal
        visible={activeModal === 'colors'}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.fullModalContainer,
            {
              backgroundColor: COLOR_PATTERNS[colorIndex].color,
            },
          ]}
          onPress={nextColor}
        >
          {COLOR_PATTERNS[colorIndex].isGrid && (
            <View style={styles.gridOverlay}>
              {Array.from({ length: 12 }).map((_, i) => (
                <View key={i} style={styles.gridRow}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <View key={j} style={styles.gridCell} />
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={styles.modalFloatingHeader}>
            <Text style={styles.colorPatternName}>
              {COLOR_PATTERNS[colorIndex].name} ({colorIndex + 1}/{COLOR_PATTERNS.length})
            </Text>
            <Text style={styles.colorTip}>Dokunarak sonraki renge geçin</Text>
          </View>

          <View style={styles.modalFloatingFooter}>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
              onPress={() => {
                updateTestStatus('colors', 'passed');
                setActiveModal(null);
              }}
            >
              <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modalActionText}>Sorun Yok (Pass)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: theme.error }]}
              onPress={() => {
                updateTestStatus('colors', 'failed');
                setActiveModal(null);
              }}
            >
              <Ionicons name="close-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modalActionText}>Ölü Piksel Var (Fail)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#334155' }]}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalActionText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2) Touch Grid Modal */}
      <Modal
        visible={activeModal === 'touch'}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.fullModalContainer, { backgroundColor: '#0F172A' }]}>
          <View style={styles.modalHeaderBar}>
            <Text style={styles.modalHeaderTitle}>
              Dokunmatik Kapsama ({touchedTiles.size}/{totalTouchTiles} -{' '}
              {Math.round((touchedTiles.size / totalTouchTiles) * 100)}%)
            </Text>
            <TouchableOpacity onPress={resetTouchTest}>
              <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.touchGridMatrix}>
            {Array.from({ length: totalTouchTiles }).map((_, idx) => {
              const isTouched = touchedTiles.has(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  style={[
                    styles.touchTile,
                    {
                      backgroundColor: isTouched ? '#22C55E' : '#1E293B',
                      borderColor: '#334155',
                    },
                  ]}
                  onPressIn={() => handleTouchTile(idx)}
                >
                  <Text style={styles.touchTileText}>{idx + 1}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalFloatingFooter}>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
              onPress={() => {
                updateTestStatus(
                  'touch',
                  touchedTiles.size === totalTouchTiles ? 'passed' : 'failed'
                );
                setActiveModal(null);
              }}
            >
              <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modalActionText}>Test Tamamlandı</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#334155' }]}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalActionText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3) Vibration Test Modal */}
      <Modal
        visible={activeModal === 'vibration'}
        animationType="fade"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.dialogBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>
              Titreşim Motoru Testi
            </Text>
            <Text style={[styles.dialogDesc, { color: theme.textSecondary }]}>
              Butonlara basarak cihazınızın titreşim geri bildirimlerini test edin.
            </Text>

            <View style={styles.vibeButtonsContainer}>
              <TouchableOpacity
                style={[styles.vibeBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => triggerHapticTest('light')}
              >
                <Ionicons name="pulse-outline" size={20} color={theme.primary} />
                <Text style={[styles.vibeBtnText, { color: theme.textPrimary }]}>Hafif Darbe</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.vibeBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => triggerHapticTest('medium')}
              >
                <Ionicons name="pulse-outline" size={20} color={theme.primary} />
                <Text style={[styles.vibeBtnText, { color: theme.textPrimary }]}>Orta Darbe</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.vibeBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => triggerHapticTest('heavy')}
              >
                <Ionicons name="pulse-outline" size={20} color={theme.primary} />
                <Text style={[styles.vibeBtnText, { color: theme.textPrimary }]}>Güçlü Titreşim</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.vibeBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => triggerHapticTest('notification')}
              >
                <Ionicons name="notifications-outline" size={20} color={theme.primary} />
                <Text style={[styles.vibeBtnText, { color: theme.textPrimary }]}>Bildirim Deseni</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dialogFooter}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
                onPress={() => {
                  updateTestStatus('vibration', 'passed');
                  setActiveModal(null);
                }}
              >
                <Text style={styles.modalActionText}>Titreşim Çalışıyor</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: theme.error }]}
                onPress={() => {
                  updateTestStatus('vibration', 'failed');
                  setActiveModal(null);
                }}
              >
                <Text style={styles.modalActionText}>Çalışmıyor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4) Torch Test Modal */}
      <Modal
        visible={activeModal === 'torch'}
        animationType="fade"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.dialogBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>
              Meşale & Flaş Testi
            </Text>
            <Text style={[styles.dialogDesc, { color: theme.textSecondary }]}>
              Arka kamera meşalesini açıp kapatarak parlaklığı kontrol edin.
            </Text>

            {Platform.OS !== 'web' && cameraPermission?.granted ? (
              <View style={styles.hiddenCameraBox}>
                <CameraView
                  style={styles.tinyCamera}
                  facing="back"
                  enableTorch={isTorchActive}
                />
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.torchToggleBtn,
                { backgroundColor: isTorchActive ? theme.star : theme.surfaceVariant },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web' && !cameraPermission?.granted) {
                  requestCameraPermission();
                }
                setIsTorchActive(!isTorchActive);
              }}
            >
              <Ionicons
                name={isTorchActive ? 'flash' : 'flash-outline'}
                size={36}
                color={isTorchActive ? '#000000' : theme.textPrimary}
              />
              <Text
                style={[
                  styles.torchToggleText,
                  { color: isTorchActive ? '#000000' : theme.textPrimary },
                ]}
              >
                {isTorchActive ? 'Flaş AÇIK' : 'Flaş KAPALI (Açmak için dokunun)'}
              </Text>
            </TouchableOpacity>

            <View style={styles.dialogFooter}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
                onPress={() => {
                  setIsTorchActive(false);
                  updateTestStatus('torch', 'passed');
                  setActiveModal(null);
                }}
              >
                <Text style={styles.modalActionText}>Flaş Çalışıyor</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: theme.error }]}
                onPress={() => {
                  setIsTorchActive(false);
                  updateTestStatus('torch', 'failed');
                  setActiveModal(null);
                }}
              >
                <Text style={styles.modalActionText}>Çalışmıyor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5) Accelerometer Test Modal */}
      <Modal
        visible={activeModal === 'accelerometer'}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.fullModalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeaderBar}>
            <Text style={[styles.modalHeaderTitle, { color: theme.textPrimary }]}>
              İvmeölçer & Eğim Testi
            </Text>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Ionicons name="close-outline" size={28} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {isAccelAvailable === false ? (
            <View style={styles.centerBox}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.warning} />
              <Text style={[styles.unsupportedTitle, { color: theme.textPrimary }]}>
                İvmeölçer Desteklenmiyor
              </Text>
              <Text style={[styles.unsupportedSub, { color: theme.textSecondary }]}>
                Bu cihazda veya platform ortamında ivmeölçer sensörüne erişilemiyor.
              </Text>
            </View>
          ) : (
            <View style={styles.accelContent}>
              {/* Level Visualizer */}
              <View style={styles.bubbleTargetCircle}>
                <View
                  style={[
                    styles.bubbleDot,
                    {
                      backgroundColor: theme.primary,
                      transform: [
                        { translateX: Math.max(-80, Math.min(80, accelData.x * 80)) },
                        { translateY: Math.max(-80, Math.min(80, -accelData.y * 80)) },
                      ],
                    },
                  ]}
                />
              </View>

              {/* Data Table */}
              <View style={[styles.accelTable, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <View style={styles.accelRow}>
                  <Text style={[styles.accelLabel, { color: theme.textSecondary }]}>X Eksen:</Text>
                  <Text style={[styles.accelVal, { color: theme.textPrimary }]}>{accelData.x.toFixed(3)} g</Text>
                </View>
                <View style={styles.accelRow}>
                  <Text style={[styles.accelLabel, { color: theme.textSecondary }]}>Y Eksen:</Text>
                  <Text style={[styles.accelVal, { color: theme.textPrimary }]}>{accelData.y.toFixed(3)} g</Text>
                </View>
                <View style={styles.accelRow}>
                  <Text style={[styles.accelLabel, { color: theme.textSecondary }]}>Z Eksen:</Text>
                  <Text style={[styles.accelVal, { color: theme.textPrimary }]}>{accelData.z.toFixed(3)} g</Text>
                </View>
              </View>

              <View style={styles.modalFloatingFooter}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
                  onPress={() => {
                    updateTestStatus('accelerometer', 'passed');
                    setActiveModal(null);
                  }}
                >
                  <Text style={styles.modalActionText}>Sensör Doğru Çalışıyor</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.error }]}
                  onPress={() => {
                    updateTestStatus('accelerometer', 'failed');
                    setActiveModal(null);
                  }}
                >
                  <Text style={styles.modalActionText}>Hata Var</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* 6) Sensors Scan Modal */}
      <Modal
        visible={activeModal === 'sensors'}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.fullModalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeaderBar}>
            <Text style={[styles.modalHeaderTitle, { color: theme.textPrimary }]}>
              Sensör Envanteri ve Durumu
            </Text>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Ionicons name="close-outline" size={28} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {isScanningSensors ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Sensörler taranıyor...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {sensorList.map((sensor) => (
                <View
                  key={sensor.id}
                  style={[
                    styles.sensorCard,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sensorName, { color: theme.textPrimary }]}>
                      {sensor.name}
                    </Text>
                    <Text style={[styles.sensorDesc, { color: theme.textSecondary }]}>
                      {sensor.description}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.pillBadge,
                      {
                        backgroundColor: sensor.available
                          ? theme.successContainer
                          : theme.surfaceVariant,
                      },
                    ]}
                  >
                    <Ionicons
                      name={sensor.available ? 'checkmark-circle' : 'remove-circle-outline'}
                      size={12}
                      color={sensor.available ? theme.success : theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.pillText,
                        { color: sensor.available ? theme.success : theme.textMuted },
                      ]}
                    >
                      {sensor.available ? 'VAR' : 'YOK / UNSUPPORTED'}
                    </Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.scanAgainBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={runSensorsScan}
              >
                <Ionicons name="refresh-outline" size={18} color={theme.onPrimary} />
                <Text style={{ color: theme.onPrimary, fontWeight: '600', marginLeft: 8 }}>
                  Sensörleri Yeniden Tara
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  summarySub: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  testList: {
    gap: 10,
    paddingBottom: 24,
  },
  testItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  testIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  testTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  testDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  fullModalContainer: {
    flex: 1,
    paddingTop: 40,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-around',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  modalFloatingHeader: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  colorPatternName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  colorTip: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
  },
  modalFloatingFooter: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  modalActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  touchGridMatrix: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'center',
    alignContent: 'center',
  },
  touchTile: {
    width: `${100 / 6 - 2}%`,
    height: `${100 / 10 - 2}%`,
    margin: '1%',
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchTileText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dialogDesc: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  vibeButtonsContainer: {
    gap: 8,
    marginBottom: 20,
  },
  vibeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  vibeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogFooter: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  hiddenCameraBox: {
    height: 1,
    width: 1,
    overflow: 'hidden',
  },
  tinyCamera: {
    width: 1,
    height: 1,
  },
  torchToggleBtn: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 8,
  },
  torchToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  unsupportedTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  unsupportedSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  accelContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  bubbleTargetCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  bubbleDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  accelTable: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  accelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accelLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  accelVal: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  sensorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  sensorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  sensorDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  scanAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
});
