import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  DuplicateGroup,
  FilterCategory,
  PhotoItem,
  ScanStats,
} from './types';
import {
  applySmartKeepBest,
  calculateStats,
  formatBytes,
  getSampleDemoPhotos,
  scanAndGroupPhotos,
} from './photoScanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const DuplicatePhotoCleanerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [stats, setStats] = useState<ScanStats>({
    totalScanned: 0,
    totalDuplicatesFound: 0,
    totalSimilarFound: 0,
    totalScreenshotsFound: 0,
    totalLargeFound: 0,
    totalRecoverableBytes: 0,
    selectedRecoverableBytes: 0,
    selectedCount: 0,
  });

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [hasLoadedInitialDemo, setHasLoadedInitialDemo] = useState<boolean>(false);

  // Load sample demonstration photos on mount for instant zero-setup demonstration
  useEffect(() => {
    if (!hasLoadedInitialDemo && photos.length === 0) {
      handleLoadDemoSamples();
      setHasLoadedInitialDemo(true);
    }
  }, [hasLoadedInitialDemo, photos.length]);

  const handleScanPhotos = async (rawPhotos: PhotoItem[]) => {
    setIsScanning(true);
    try {
      const { groups: scannedGroups, stats: initialStats } = await scanAndGroupPhotos(rawPhotos);
      // Automatically apply "En İyisini Koru" for optimal user convenience
      const autoCleanGroups = applySmartKeepBest(scannedGroups);
      const updatedStats = calculateStats(rawPhotos.length, autoCleanGroups);

      setGroups(autoCleanGroups);
      setStats(updatedStats);
    } catch (err) {
      console.error('Scan error:', err);
      Alert.alert('Tarama Hatası', 'Fotoğraflar taranırken bir sorun oluştu.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadDemoSamples = async () => {
    const demoItems = getSampleDemoPhotos();
    setPhotos(demoItems);
    await handleScanPhotos(demoItems);
  };

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert(
          'Galeri İzni Gerekli',
          'Benzer fotoğrafları tespit edebilmek için cihaz galerisine erişim izni gereklidir.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedItems: PhotoItem[] = result.assets.map((asset, index) => ({
          id: `picked_${Date.now()}_${index}`,
          uri: asset.uri,
          name: asset.fileName || `foto_${index + 1}.jpg`,
          size:
            asset.fileSize ||
            (asset.width && asset.height ? Math.round(asset.width * asset.height * 0.75) : 3.5 * 1024 * 1024),
          width: asset.width || 1920,
          height: asset.height || 1080,
          createdAt: Date.now(),
          assetId: asset.assetId,
        }));

        setPhotos(pickedItems);
        await handleScanPhotos(pickedItems);
      }
    } catch (error) {
      console.warn('Gallery pick error:', error);
      Alert.alert('Hata', 'Fotoğraflar seçilirken bir sorun oluştu.');
    }
  };

  const handleTogglePhotoSelection = (groupId: string, photoId: string) => {
    const updatedGroups = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        photos: g.photos.map((p) => {
          if (p.id !== photoId) return p;
          return {
            ...p,
            selectedForDelete: !p.selectedForDelete,
          };
        }),
      };
    });

    setGroups(updatedGroups);
    setStats(calculateStats(photos.length, updatedGroups));
  };

  const handleApplyKeepBest = () => {
    const smartGroups = applySmartKeepBest(groups);
    setGroups(smartGroups);
    setStats(calculateStats(photos.length, smartGroups));
  };

  const handleSelectAllInFilter = (select: boolean) => {
    const updatedGroups = groups.map((g) => {
      if (activeFilter !== 'all' && g.type !== activeFilter) return g;
      return {
        ...g,
        photos: g.photos.map((p) => ({
          ...p,
          selectedForDelete: select,
        })),
      };
    });
    setGroups(updatedGroups);
    setStats(calculateStats(photos.length, updatedGroups));
  };

  const handleConfirmDelete = async () => {
    const selectedIds = new Set<string>();
    const assetIdsToDelete: string[] = [];

    groups.forEach((g) => {
      g.photos.forEach((p) => {
        if (p.selectedForDelete) {
          selectedIds.add(p.id);
          if (p.assetId) {
            assetIdsToDelete.push(p.assetId);
          }
        }
      });
    });

    if (selectedIds.size === 0) return;

    // Delete from system gallery if native media assets
    if (assetIdsToDelete.length > 0 && Platform.OS !== 'web') {
      try {
        // Platform-specific module: expo-media-library is only loaded on native platforms
        const MediaLibrary = await import('expo-media-library');
        await MediaLibrary.deleteAssetsAsync(assetIdsToDelete);
      } catch (err) {
        console.warn('Device media delete note:', err);
      }
    }

    const remainingPhotos = photos.filter((p) => !selectedIds.has(p.id));
    const freedBytes = stats.selectedRecoverableBytes;
    const freedCount = stats.selectedCount;

    setPhotos(remainingPhotos);
    setDeleteModalVisible(false);

    // Rescan remaining
    await handleScanPhotos(remainingPhotos);

    Alert.alert(
      'Temizlik Tamamlandı! 🎉',
      `${freedCount} adet gereksiz görsel başarıyla temizlendi. Toplam ${formatBytes(
        freedBytes
      )} depolama alanı geri kazanıldı.`
    );
  };

  const filteredGroups = useMemo(() => {
    if (activeFilter === 'all') return groups;
    return groups.filter((g) => g.type === activeFilter);
  }, [groups, activeFilter]);

  const filterChips: { id: FilterCategory; label: string; icon: string; count: number }[] = [
    { id: 'all', label: 'Tümü', icon: 'layers-outline', count: groups.length },
    {
      id: 'exact',
      label: 'Kopyalar',
      icon: 'copy-outline',
      count: stats.totalDuplicatesFound,
    },
    {
      id: 'similar',
      label: 'Benzerler',
      icon: 'images-outline',
      count: stats.totalSimilarFound,
    },
    {
      id: 'screenshot',
      label: 'Ekran Görüntüsü',
      icon: 'phone-portrait-outline',
      count: stats.totalScreenshotsFound,
    },
    {
      id: 'large',
      label: 'Büyük (>5MB)',
      icon: 'expand-outline',
      count: stats.totalLargeFound,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header Summary & Action Bar */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderBottomWidth: 1,
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.headerStatsRow}>
          <View style={styles.statItem}>
            <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
              TOPLAM TARANAN
            </Text>
            <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
              {stats.totalScanned} Görsel
            </Text>
          </View>

          <View style={[styles.verticalDivider, { backgroundColor: theme.divider }]} />

          <View style={styles.statItem}>
            <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
              KAZANILABİLİR ALAN
            </Text>
            <Text style={[typography.titleMedium, { color: theme.success, fontWeight: '700' }]}>
              {formatBytes(stats.totalRecoverableBytes)}
            </Text>
          </View>
        </View>

        {/* Quick Toolbar */}
        <View style={[styles.toolbarRow, { marginTop: spacing.sm }]}>
          <TouchableOpacity
            onPress={handlePickFromGallery}
            style={[
              styles.toolbarBtn,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Galeriden Fotoğraf Seç"
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.onPrimaryContainer} />
            <Text
              style={[
                typography.labelMedium,
                { color: theme.onPrimaryContainer, marginLeft: spacing.xs },
              ]}
            >
              Galeri Seç
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLoadDemoSamples}
            style={[
              styles.toolbarBtn,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Örnek Fotoğrafları Yükle"
          >
            <Ionicons name="sparkles-outline" size={16} color={theme.textPrimary} />
            <Text
              style={[
                typography.labelMedium,
                { color: theme.textPrimary, marginLeft: spacing.xs },
              ]}
            >
              Örnek Modu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleApplyKeepBest}
            style={[
              styles.toolbarBtn,
              {
                backgroundColor: theme.accent,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="En İyisini Koru"
          >
            <Ionicons name="star" size={16} color="#FFFFFF" />
            <Text
              style={[
                typography.labelMedium,
                { color: '#FFFFFF', marginLeft: spacing.xs, fontWeight: '700' },
              ]}
            >
              En İyisini Koru
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Category Chips Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterContainer, { paddingHorizontal: spacing.md }]}
      >
        {filterChips.map((chip) => {
          const isSelected = activeFilter === chip.id;
          return (
            <TouchableOpacity
              key={chip.id}
              onPress={() => setActiveFilter(chip.id)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.cardBorder,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Ionicons
                name={chip.icon as any}
                size={14}
                color={isSelected ? theme.onPrimary : theme.textSecondary}
              />
              <Text
                style={[
                  typography.labelSmall,
                  {
                    color: isSelected ? theme.onPrimary : theme.textPrimary,
                    marginLeft: 6,
                  },
                ]}
              >
                {chip.label} {chip.count > 0 ? `(${chip.count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Main Content Area */}
      {isScanning ? (
        <View style={styles.centerLoadingBox}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text
            style={[
              typography.titleSmall,
              { color: theme.textPrimary, marginTop: spacing.md },
            ]}
          >
            Görseller taranıyor ve algoritmik benzerlik hesaplanıyor...
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: theme.textSecondary, marginTop: spacing.xs },
            ]}
          >
            Perceptual aHash & dHash ile %100 cihaz içinde çalışır.
          </Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={[styles.emptyBox, { padding: spacing.xxl }]}>
          <View
            style={[
              styles.emptyIconCircle,
              {
                backgroundColor: theme.successContainer,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Ionicons name="checkmark-done-circle" size={54} color={theme.success} />
          </View>
          <Text
            style={[
              typography.titleMedium,
              { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            Galeriniz Tertemiz!
          </Text>
          <Text
            style={[
              typography.bodyMedium,
              {
                color: theme.textSecondary,
                marginTop: spacing.xs,
                textAlign: 'center',
                lineHeight: 22,
              },
            ]}
          >
            Hiçbir kopya, benzer seri çekim veya gereksiz ekran görüntüsü bulunamadı.
          </Text>
          <TouchableOpacity
            onPress={handleLoadDemoSamples}
            style={[
              styles.demoLoadBtn,
              {
                backgroundColor: theme.primary,
                borderRadius: borderRadius.md,
                marginTop: spacing.lg,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <Ionicons name="sparkles" size={18} color={theme.onPrimary} />
            <Text
              style={[
                typography.labelLarge,
                { color: theme.onPrimary, marginLeft: spacing.xs },
              ]}
            >
              Örnek Fotoğraflarla Test Et
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.groupsScroll}
          contentContainerStyle={[styles.groupsList, { padding: spacing.md, paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          {filteredGroups.map((group) => (
            <View
              key={group.id}
              style={[
                styles.groupCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.xl,
                  marginBottom: spacing.lg,
                  padding: spacing.md,
                },
              ]}
            >
              {/* Group Header */}
              <View style={styles.groupHeaderRow}>
                <View style={styles.groupTitleInfo}>
                  <View style={styles.groupBadgeRow}>
                    <View
                      style={[
                        styles.groupTypeTag,
                        {
                          backgroundColor:
                            group.type === 'exact'
                              ? theme.errorContainer
                              : group.type === 'similar'
                              ? theme.primaryContainer
                              : theme.surfaceVariant,
                          borderRadius: borderRadius.xs,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          {
                            color:
                              group.type === 'exact'
                                ? theme.onErrorContainer
                                : group.type === 'similar'
                                ? theme.onPrimaryContainer
                                : theme.textPrimary,
                          },
                        ]}
                      >
                        {group.type === 'exact'
                          ? 'BİREBİR KOPYA'
                          : group.type === 'similar'
                          ? 'SERİ ÇEKİM'
                          : group.type === 'screenshot'
                          ? 'EKRAN GÖRÜNTÜSÜ'
                          : 'BÜYÜK DOSYA'}
                      </Text>
                    </View>

                    {group.similarityPercent > 0 && (
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: theme.accent, marginLeft: spacing.xs, fontWeight: '700' },
                        ]}
                      >
                        %{group.similarityPercent} Benzerlik
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      typography.titleSmall,
                      { color: theme.textPrimary, marginTop: 4 },
                    ]}
                  >
                    {group.title}
                  </Text>
                  <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                    {group.subtitle}
                  </Text>
                </View>

                {group.recoverableBytes > 0 && (
                  <View
                    style={[
                      styles.groupRecoverPill,
                      {
                        backgroundColor: theme.successContainer,
                        borderRadius: borderRadius.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: theme.success, fontWeight: '700' },
                      ]}
                    >
                      +{formatBytes(group.recoverableBytes)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Photos Comparison Grid / Row */}
              <View style={[styles.photosGrid, { marginTop: spacing.md }]}>
                {group.photos.map((photo) => {
                  const isSelected = !!photo.selectedForDelete;
                  const isBest = !!photo.isBest;

                  return (
                    <View
                      key={photo.id}
                      style={[
                        styles.photoCard,
                        {
                          backgroundColor: theme.surfaceVariant,
                          borderColor: isSelected
                            ? theme.error
                            : isBest
                            ? theme.accent
                            : theme.cardBorder,
                          borderWidth: isSelected || isBest ? 2 : 1,
                          borderRadius: borderRadius.lg,
                        },
                      ]}
                    >
                      {/* Image Preview Container */}
                      <TouchableOpacity
                        onPress={() => setPreviewPhoto(photo)}
                        activeOpacity={0.85}
                        style={styles.photoThumbContainer}
                      >
                        <Image
                          source={{ uri: photo.uri }}
                          style={styles.photoThumb}
                          resizeMode="cover"
                        />

                        {/* Best Photo Ribbon / Badge */}
                        {isBest && (
                          <View
                            style={[
                              styles.bestRibbon,
                              {
                                backgroundColor: theme.accent,
                                borderBottomRightRadius: borderRadius.sm,
                              },
                            ]}
                          >
                            <Ionicons name="star" size={12} color="#FFFFFF" />
                            <Text style={styles.bestRibbonText}>En İyisi</Text>
                          </View>
                        )}

                        {/* Resolution Overlay Tag */}
                        <View
                          style={[
                            styles.resOverlayTag,
                            {
                              backgroundColor: 'rgba(15, 23, 42, 0.75)',
                              borderRadius: borderRadius.xs,
                            },
                          ]}
                        >
                          <Text style={styles.resOverlayText}>
                            {photo.width}×{photo.height}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Photo Details & Checkbox Action */}
                      <View style={[styles.photoDetailsRow, { padding: spacing.xs + 2 }]}>
                        <View style={styles.photoInfoTexts}>
                          <Text
                            style={[
                              typography.labelSmall,
                              { color: theme.textPrimary, fontWeight: '700' },
                            ]}
                          >
                            {formatBytes(photo.size)}
                          </Text>
                          <Text
                            style={[
                              typography.bodySmall,
                              { color: theme.textMuted, fontSize: 10 },
                            ]}
                            numberOfLines={1}
                          >
                            {photo.name}
                          </Text>
                        </View>

                        {/* Selection Checkbox */}
                        <TouchableOpacity
                          onPress={() => handleTogglePhotoSelection(group.id, photo.id)}
                          style={[
                            styles.checkboxCircle,
                            {
                              backgroundColor: isSelected
                                ? theme.error
                                : theme.surface,
                              borderColor: isSelected
                                ? theme.error
                                : theme.cardBorder,
                            },
                          ]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          accessibilityLabel={
                            isSelected ? 'Silme seçimini kaldır' : 'Silmek için seç'
                          }
                        >
                          {isSelected && (
                            <Ionicons name="trash" size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Floating Bottom Sticky Action Bar */}
      {stats.selectedCount > 0 && (
        <View
          style={[
            styles.bottomStickyBar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderTopWidth: 1,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.bottomStatsLeft}>
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              {stats.selectedCount} Fotoğraf Seçildi
            </Text>
            <Text style={[typography.bodySmall, { color: theme.success, fontWeight: '700' }]}>
              +{formatBytes(stats.selectedRecoverableBytes)} Alan Açılacak
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setDeleteModalVisible(true)}
            style={[
              styles.cleanButton,
              {
                backgroundColor: theme.error,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Seçilen fotoğrafları temizle"
          >
            <Ionicons name="trash-bin-outline" size={20} color="#FFFFFF" />
            <Text
              style={[
                typography.labelLarge,
                { color: '#FFFFFF', marginLeft: spacing.xs, fontWeight: '700' },
              ]}
            >
              Güvenli Temizle
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Deletion Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
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
                  backgroundColor: theme.errorContainer,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <Ionicons name="trash" size={32} color={theme.error} />
            </View>

            <Text
              style={[
                typography.titleMedium,
                { color: theme.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              Fotoğrafları Temizle
            </Text>

            <Text
              style={[
                typography.bodyMedium,
                {
                  color: theme.textSecondary,
                  marginTop: spacing.xs,
                  textAlign: 'center',
                  lineHeight: 22,
                },
              ]}
            >
              Seçilen <Text style={{ fontWeight: '700' }}>{stats.selectedCount} adet</Text> kopya ve
              gereksiz görsel cihazınızdan kaldırılacak ve{' '}
              <Text style={{ fontWeight: '700', color: theme.success }}>
                {formatBytes(stats.selectedRecoverableBytes)}
              </Text>{' '}
              depolama alanı kazanacaksınız.
            </Text>

            <View style={[styles.modalActionsRow, { marginTop: spacing.xl }]}>
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
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
                onPress={handleConfirmDelete}
                style={[
                  styles.modalDeleteBtn,
                  {
                    backgroundColor: theme.error,
                    borderRadius: borderRadius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Evet, Temizle
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Photo Inspector Modal */}
      <Modal
        visible={!!previewPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={() => setPreviewPhoto(null)}
              style={styles.previewCloseBtn}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {previewPhoto && (
            <View style={styles.previewBody}>
              <Image
                source={{ uri: previewPhoto.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <View style={styles.previewFooterMeta}>
                <Text style={styles.previewFileName}>{previewPhoto.name}</Text>
                <Text style={styles.previewFileSpecs}>
                  {previewPhoto.width} × {previewPhoto.height} px • {formatBytes(previewPhoto.size)}
                  {previewPhoto.isBest ? ' • ⭐ En İyisi Olarak Korunuyor' : ''}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    elevation: 2,
  },
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 36,
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScroll: {
    maxHeight: 48,
    marginVertical: 6,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  centerLoadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoLoadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupsScroll: {
    flex: 1,
  },
  groupsList: {},
  groupCard: {
    borderWidth: 1,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  groupTitleInfo: {
    flex: 1,
    marginRight: 8,
  },
  groupBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  groupRecoverPill: {
    alignSelf: 'flex-start',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCard: {
    width: (SCREEN_WIDTH - 64) / 2 > 150 ? (SCREEN_WIDTH - 64) / 2 : 150,
    flexGrow: 1,
    overflow: 'hidden',
  },
  photoThumbContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  bestRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  bestRibbonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  resOverlayTag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  resOverlayText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  photoDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoInfoTexts: {
    flex: 1,
    marginRight: 6,
  },
  checkboxCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomStatsLeft: {
    flex: 1,
  },
  cleanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
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
  modalDeleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'space-between',
  },
  previewHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  previewCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewImage: {
    width: '100%',
    height: '75%',
  },
  previewFooterMeta: {
    marginTop: 16,
    alignItems: 'center',
  },
  previewFileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  previewFileSpecs: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
});
