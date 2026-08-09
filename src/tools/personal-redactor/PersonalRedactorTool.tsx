import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import { RedactMode, RedactRegion } from './types';
import { applyRedactionsToImage, shareOrDownloadImage } from './redactorService';

// Sample demonstration image SVG data URI for instant testing
const DEMO_IMAGE_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
    <rect width="800" height="500" fill="#1e293b"/>
    <rect x="40" y="40" width="720" height="420" rx="16" fill="#0f172a" stroke="#334155" stroke-width="4"/>
    <text x="80" y="100" fill="#38bdf8" font-family="sans-serif" font-size="28" font-weight="bold">KİŞİSEL KİMLİK / EHLİYET MASKESİ</text>
    <text x="80" y="160" fill="#f8fafc" font-family="sans-serif" font-size="22">Ad Soyad: AHMET YILMAZ</text>
    <text x="80" y="210" fill="#f8fafc" font-family="sans-serif" font-size="22">T.C. Kimlik No: 12345678901</text>
    <text x="80" y="260" fill="#f8fafc" font-family="sans-serif" font-size="22">Doğum Tarihi: 15.04.1992</text>
    <text x="80" y="310" fill="#f8fafc" font-family="sans-serif" font-size="22">Tel: +90 532 100 20 30</text>
    <rect x="520" y="130" width="200" height="240" rx="12" fill="#334155" stroke="#475569" stroke-width="2"/>
    <circle cx="620" cy="210" r="50" fill="#94a3b8"/>
    <path d="M 540,340 C 540,280 700,280 700,340 Z" fill="#94a3b8"/>
    <text x="80" y="410" fill="#94a3b8" font-family="monospace" font-size="16">GİZLİ &amp; KİŞİSEL BİLGİ İÇERİR - SADECE TEST İÇİNDİR</text>
  </svg>
`)}`;

export const PersonalRedactorTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 500,
  });

  const [regions, setRegions] = useState<RedactRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<RedactMode>('blackout');

  const [isProcessing, setIsProcessing] = useState(false);
  const [redactedUri, setRedactedUri] = useState<string | null>(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  // Pick Image from Gallery
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Galeriden görsel seçmek için medya kitaplığı izni veriniz.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageDimensions({
          width: asset.width || 800,
          height: asset.height || 600,
        });
        setRegions([]);
        setSelectedRegionId(null);
        setRedactedUri(null);
      }
    } catch (err) {
      console.error('Pick image error:', err);
      Alert.alert('Hata', 'Görsel seçilirken bir hata oluştu.');
    }
  };

  // Camera Capture
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera izni veriniz.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageDimensions({
          width: asset.width || 800,
          height: asset.height || 600,
        });
        setRegions([]);
        setSelectedRegionId(null);
        setRedactedUri(null);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Hata', 'Fotoğraf çekilirken bir hata oluştu.');
    }
  };

  // Load Demo Image
  const handleLoadDemo = () => {
    setImageUri(DEMO_IMAGE_URI);
    setImageDimensions({ width: 800, height: 500 });
    setRegions([
      { id: '1', x: 8, y: 38, width: 50, height: 16, mode: 'blackout', label: 'T.C. No Maske' },
      { id: '2', x: 8, y: 58, width: 45, height: 16, mode: 'blur', label: 'Telefon Maske' },
      { id: '3', x: 64, y: 22, width: 28, height: 54, mode: 'pixelate', label: 'Fotoğraf Maske' },
    ]);
    setSelectedRegionId('1');
    setRedactedUri(null);
  };

  // Add new rectangle region
  const handleAddRegion = (presetMode?: RedactMode) => {
    const mode = presetMode || activeMode;
    const newId = Date.now().toString();
    const count = regions.length + 1;

    // Calculate a good offset for overlapping rectangles
    const offset = (count * 4) % 20;
    const newRegion: RedactRegion = {
      id: newId,
      x: Math.min(70, 20 + offset),
      y: Math.min(70, 20 + offset),
      width: 40,
      height: 20,
      mode,
      label: `Bölge #${count}`,
    };

    setRegions((prev) => [...prev, newRegion]);
    setSelectedRegionId(newId);
  };

  // Preset region shortcuts (e.g. Center, Top Half, Face/Right area)
  const handleAddPresetRegion = (type: 'top' | 'center' | 'bottom' | 'right') => {
    const newId = Date.now().toString();
    let newRegion: RedactRegion;

    if (type === 'top') {
      newRegion = { id: newId, x: 10, y: 10, width: 80, height: 25, mode: activeMode, label: 'Üst Başlık Maske' };
    } else if (type === 'bottom') {
      newRegion = { id: newId, x: 10, y: 65, width: 80, height: 25, mode: activeMode, label: 'Alt Bölge Maske' };
    } else if (type === 'right') {
      newRegion = { id: newId, x: 60, y: 15, width: 35, height: 70, mode: activeMode, label: 'Sağ Taraf Maske' };
    } else {
      newRegion = { id: newId, x: 25, y: 30, width: 50, height: 40, mode: activeMode, label: 'Orta Bölge Maske' };
    }

    setRegions((prev) => [...prev, newRegion]);
    setSelectedRegionId(newId);
  };

  // Update selected region position / size
  const updateSelectedRegion = (updates: Partial<RedactRegion>) => {
    if (!selectedRegionId) return;
    setRegions((prev) =>
      prev.map((r) => (r.id === selectedRegionId ? { ...r, ...updates } : r))
    );
  };

  // Delete selected region
  const handleDeleteRegion = (idToDelete: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== idToDelete));
    if (selectedRegionId === idToDelete) {
      setSelectedRegionId(null);
    }
  };

  // Process & Apply Redactions
  const handleExportRedacted = async () => {
    if (!imageUri) return;
    if (regions.length === 0) {
      Alert.alert('Bilgi', 'Lütfen kapatılacak/maskelenecek en az bir bölge ekleyin.');
      return;
    }

    setIsProcessing(true);
    try {
      const outputUri = await applyRedactionsToImage(
        imageUri,
        regions,
        imageDimensions.width,
        imageDimensions.height
      );
      setRedactedUri(outputUri);
      setIsPreviewModalVisible(true);
    } catch (err) {
      console.error('Redaction failed:', err);
      Alert.alert('Hata', 'Görsel maskelenirken bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareOrDownload = async () => {
    if (!redactedUri) return;
    try {
      await shareOrDownloadImage(redactedUri, `redacted_${Date.now()}.png`);
    } catch (err) {
      Alert.alert('Hata', 'Görsel kaydedilirken veya paylaşılırken hata oluştu.');
    }
  };

  const selectedRegion = regions.find((r) => r.id === selectedRegionId);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Info Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primaryContainer }]}>
            <Ionicons name="eye-off-outline" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Kişisel Veri Maskeleyici</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Ekran görüntüleri ve fotoğraflardaki T.C., tel, adres ve yüz gibi hassas alanları karartın veya buzlayın.
            </Text>
          </View>
        </View>

        {/* Action Buttons: Pick / Camera / Demo */}
        <View style={styles.imageActionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={handlePickImage}
            activeOpacity={0.8}
          >
            <Ionicons name="images-outline" size={18} color={theme.onPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>Galeri</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
            onPress={handleTakePhoto}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={18} color={theme.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Kamera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
            onPress={handleLoadDemo}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Örnek Yükle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!imageUri ? (
        <View style={[styles.placeholderCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Ionicons name="image-outline" size={56} color={theme.textMuted} />
          <Text style={[styles.placeholderTitle, { color: theme.textPrimary }]}>Görsel Seçilmedi</Text>
          <Text style={[styles.placeholderDesc, { color: theme.textSecondary }]}>
            Maskelemek istediğiniz belge, fatura veya ekran görüntüsünü seçerek başlayın.
          </Text>
        </View>
      ) : (
        <>
          {/* Main Redaction Canvas Container */}
          <View style={[styles.canvasCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Görsel &amp; Maske Alanları</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Eklemek istediğiniz maskeleme türünü seçip kutuları boyutlandırın.
            </Text>

            <View style={styles.imageWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />

              {/* Render Rectangular Region Overlays */}
              {regions.map((region) => {
                const isSelected = region.id === selectedRegionId;
                let bgStyle = 'rgba(0, 0, 0, 0.85)';
                if (region.mode === 'blur') bgStyle = 'rgba(59, 130, 246, 0.4)';
                if (region.mode === 'pixelate') bgStyle = 'rgba(168, 85, 247, 0.45)';

                return (
                  <TouchableOpacity
                    key={region.id}
                    activeOpacity={0.9}
                    onPress={() => setSelectedRegionId(region.id)}
                    style={[
                      styles.regionOverlay,
                      {
                        left: `${region.x}%`,
                        top: `${region.y}%`,
                        width: `${region.width}%`,
                        height: `${region.height}%`,
                        backgroundColor: bgStyle,
                        borderColor: isSelected ? theme.primary : 'rgba(255, 255, 255, 0.6)',
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={styles.regionBadgeRow}>
                      <Text style={styles.regionBadgeText}>
                        {region.mode === 'blackout' ? 'Siyah Box' : region.mode === 'blur' ? 'Bulanık' : 'Piksel'}
                      </Text>
                      {isSelected && (
                        <TouchableOpacity
                          onPress={() => handleDeleteRegion(region.id)}
                          style={styles.deleteRegionIcon}
                        >
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Add / Mode Selection Buttons */}
            <View style={styles.modeToolbar}>
              <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>Varsayılan Mod:</Text>
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    activeMode === 'blackout' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => {
                    setActiveMode('blackout');
                    if (selectedRegionId) updateSelectedRegion({ mode: 'blackout' });
                  }}
                >
                  <Ionicons
                    name="square"
                    size={16}
                    color={activeMode === 'blackout' ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeTabText,
                      { color: activeMode === 'blackout' ? theme.onPrimary : theme.textSecondary },
                    ]}
                  >
                    Siyah Kutucuk
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    activeMode === 'blur' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => {
                    setActiveMode('blur');
                    if (selectedRegionId) updateSelectedRegion({ mode: 'blur' });
                  }}
                >
                  <Ionicons
                    name="water-outline"
                    size={16}
                    color={activeMode === 'blur' ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeTabText,
                      { color: activeMode === 'blur' ? theme.onPrimary : theme.textSecondary },
                    ]}
                  >
                    Bulanıklaştır
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    activeMode === 'pixelate' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => {
                    setActiveMode('pixelate');
                    if (selectedRegionId) updateSelectedRegion({ mode: 'pixelate' });
                  }}
                >
                  <Ionicons
                    name="grid-outline"
                    size={16}
                    color={activeMode === 'pixelate' ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeTabText,
                      { color: activeMode === 'pixelate' ? theme.onPrimary : theme.textSecondary },
                    ]}
                  >
                    Piksellere Ayır
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Region Addition Buttons */}
            <View style={styles.addRegionRow}>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.primary }]}
                onPress={() => handleAddRegion()}
              >
                <Ionicons name="add-circle-outline" size={18} color={theme.onPrimary} />
                <Text style={[styles.addBtnText, { color: theme.onPrimary }]}>+ Yeni Bölge Ekle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => handleAddPresetRegion('center')}
              >
                <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>Orta Preseti</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => handleAddPresetRegion('right')}
              >
                <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>Sağ Profil</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Region Fine-Tuning Controls (When a region is selected) */}
          {selectedRegion && (
            <View style={[styles.controlCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <View style={styles.controlHeader}>
                <Text style={[styles.controlTitle, { color: theme.textPrimary }]}>
                  {selectedRegion.label || 'Seçili Bölge Ayarları'}
                </Text>
                <TouchableOpacity onPress={() => handleDeleteRegion(selectedRegion.id)}>
                  <Ionicons name="trash-outline" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>

              {/* Position X Slider & Controls */}
              <View style={styles.adjustRow}>
                <Text style={[styles.adjustLabel, { color: theme.textSecondary }]}>Yatay Konum (X): {selectedRegion.x}%</Text>
                <View style={styles.stepBtnGroup}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ x: Math.max(0, selectedRegion.x - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ x: Math.min(95, selectedRegion.x + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Position Y Slider & Controls */}
              <View style={styles.adjustRow}>
                <Text style={[styles.adjustLabel, { color: theme.textSecondary }]}>Dikey Konum (Y): {selectedRegion.y}%</Text>
                <View style={styles.stepBtnGroup}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ y: Math.max(0, selectedRegion.y - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ y: Math.min(95, selectedRegion.y + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Width & Height adjustments */}
              <View style={styles.adjustRow}>
                <Text style={[styles.adjustLabel, { color: theme.textSecondary }]}>Genişlik: {selectedRegion.width}%</Text>
                <View style={styles.stepBtnGroup}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ width: Math.max(5, selectedRegion.width - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ width: Math.min(100 - selectedRegion.x, selectedRegion.width + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.adjustRow}>
                <Text style={[styles.adjustLabel, { color: theme.textSecondary }]}>Yükseklik: {selectedRegion.height}%</Text>
                <View style={styles.stepBtnGroup}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ height: Math.max(5, selectedRegion.height - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => updateSelectedRegion({ height: Math.min(100 - selectedRegion.y, selectedRegion.height + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Export Action Button */}
          <TouchableOpacity
            style={[
              styles.exportMainBtn,
              { backgroundColor: theme.primary },
              isProcessing && { opacity: 0.7 },
            ]}
            onPress={handleExportRedacted}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <ActivityIndicator color={theme.onPrimary} style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="shield-checkmark-outline" size={22} color={theme.onPrimary} style={{ marginRight: 8 }} />
            )}
            <Text style={[styles.exportBtnText, { color: theme.onPrimary }]}>
              {isProcessing ? 'Maskeleniyor...' : 'Maskelenmiş Görseli Dönüştür &amp; Dışa Aktar'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Output Preview Modal */}
      <Modal visible={isPreviewModalVisible} animationType="slide" transparent={false}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderColor: theme.divider }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Maskelenmiş Görsel Önizleme</Text>
            <TouchableOpacity onPress={() => setIsPreviewModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {redactedUri && (
            <View style={styles.modalBody}>
              <Image source={{ uri: redactedUri }} style={styles.modalImage} resizeMode="contain" />
            </View>
          )}

          <View style={[styles.modalFooter, { borderColor: theme.divider }]}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => setIsPreviewModalVisible(false)}
            >
              <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Kapat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              onPress={handleShareOrDownload}
            >
              <Ionicons name="share-outline" size={18} color={theme.onPrimary} style={{ marginRight: 6 }} />
              <Text style={{ color: theme.onPrimary, fontWeight: '600' }}>Paylaş / İndir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  imageActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 10,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  placeholderDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  canvasCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 12,
    marginBottom: 12,
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: 280,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  regionOverlay: {
    position: 'absolute',
    borderRadius: 4,
    justifyContent: 'space-between',
    padding: 4,
  },
  regionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regionBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  deleteRegionIcon: {
    padding: 2,
  },
  modeToolbar: {
    marginBottom: 14,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    gap: 4,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addRegionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  adjustLabel: {
    fontSize: 13,
  },
  stepBtnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
});
