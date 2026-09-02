import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { HomeScreenProps, SelectedInputMetadata } from '../../core/navigation/types';
import { useTheme } from '../../core/theme';
import { useLibrary, tempFileManager } from '../../core/storage';
import {
  getAllEnabledCategories,
  ToolDefinition,
  searchTools,
  INTENT_ALIASES,
  inferInputType,
  getToolsForInputType,
  getToolById,
} from '../../registry';
import {
  ToolCard,
  CategoryCard,
  ThemeSelector,
  FirstUseHintBanner,
  ResultCard,
} from '../../components';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, spacing, borderRadius, typography } = useTheme();
  const { favoriteTools, recentTools, clearRecents, historyEntries, removeHistoryEntry } = useLibrary();
  const [intentQuery, setIntentQuery] = useState('');
  const [selectedFileMetadata, setSelectedFileMetadata] = useState<SelectedInputMetadata | null>(null);
  const [tempUsage, setTempUsage] = useState({ count: 0, bytes: 0 });

  const refreshTempUsage = async () => {
    const files = await tempFileManager.getTempFiles();
    setTempUsage({
      count: files.length,
      bytes: files.reduce((total, file) => total + (file.size || 0), 0),
    });
  };

  useEffect(() => {
    refreshTempUsage().catch((error) => console.warn('[HomeScreen] Temp usage error:', error));
  }, []);

  const categories = getAllEnabledCategories();

  const handleOpenTool = (tool: ToolDefinition, withInput?: SelectedInputMetadata) => {
    navigation.navigate('Tool', {
      toolId: tool.id,
      selectedInput: withInput || (selectedFileMetadata || undefined),
    });
  };

  const handleOpenCategory = (categoryId: string) => {
    navigation.navigate('Category', { categoryId });
  };

  const handleOpenFavorites = () => {
    navigation.navigate('Favorites');
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const inferred = inferInputType(asset.mimeType || undefined, asset.name || undefined);
        setSelectedFileMetadata({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || undefined,
          type: inferred,
          size: asset.size ?? 0,
        });
      }
    } catch (err) {
      console.warn('[HomeScreen] Document pick error:', err);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const inferred = inferInputType(
          asset.mimeType || undefined,
          asset.fileName || asset.uri.split('/').pop(),
          asset.type || undefined
        );
        setSelectedFileMetadata({
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'media_file',
          mimeType: asset.mimeType || undefined,
          type: inferred,
          size: asset.fileSize ?? 0,
        });
      }
    } catch (err) {
      console.warn('[HomeScreen] Image pick error:', err);
    }
  };

  // Compute intent search results
  const searchResults = intentQuery.trim() ? searchTools(intentQuery) : [];

  // Compute matching tools for selected file
  const matchingFileTools = selectedFileMetadata
    ? getToolsForInputType(selectedFileMetadata.type || 'file')
    : [];

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Top Header & Brand Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoIconBox,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Ionicons name="construct" size={22} color={theme.onPrimaryContainer} />
          </View>
          <View style={styles.brandTextCol}>
            <Text style={[typography.titleLarge, { color: theme.textPrimary, fontSize: 20 }]}>
              Gündelik
            </Text>
            <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
              Çevrimdışı Pratik Araç Kutusu
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleOpenFavorites}
            style={[
              styles.favoritesShortcutBtn,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.md,
                marginRight: spacing.xs,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Favori araçlar sayfasına git"
          >
            <Ionicons
              name={favoriteTools.length > 0 ? 'star' : 'star-outline'}
              size={18}
              color={favoriteTools.length > 0 ? theme.star : theme.textSecondary}
            />
            {favoriteTools.length > 0 && (
              <View
                style={[
                  styles.favBadge,
                  { backgroundColor: theme.primary, borderRadius: borderRadius.full },
                ]}
              >
                <Text style={[typography.labelSmall, { color: theme.onPrimary, fontSize: 9 }]}>
                  {favoriteTools.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <ThemeSelector />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* First Use Hint Banner */}
        <FirstUseHintBanner />

        {/* Prominent Turkish Intent Search Box */}
        <View
          style={[
            styles.intentSection,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.xl,
              padding: spacing.lg,
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
            },
          ]}
        >
          <View style={styles.intentHeaderRow}>
            <Ionicons name="sparkles" size={20} color={theme.primary} />
            <Text
              style={[
                typography.titleMedium,
                { color: theme.textPrimary, marginLeft: spacing.xs },
              ]}
            >
              Ne yapmak istiyorsun?
            </Text>
          </View>
          <Text
            style={[
              typography.bodySmall,
              { color: theme.textSecondary, marginTop: 2, marginBottom: spacing.md },
            ]}
          >
            Aşağıya aradığınız işlemi doğal dille yazın veya hazır bir görev seçin
          </Text>

          <View style={styles.intentInputWrapper}>
            <TextInput
              style={[
                styles.intentInput,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.inputBorder,
                  color: theme.textPrimary,
                  borderRadius: borderRadius.lg,
                  paddingHorizontal: spacing.md,
                },
              ]}
              placeholder="Örn: PDF küçült, fotoğraftaki bilgileri sil..."
              placeholderTextColor={theme.textMuted}
              value={intentQuery}
              onChangeText={setIntentQuery}
              accessibilityLabel="Ne yapmak istiyorsun arama girişi"
            />
            {intentQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => setIntentQuery('')}
                style={styles.inputActionIcon}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.inputActionIcon}>
                <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
              </View>
            )}
          </View>

          {/* Quick Intent Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {INTENT_ALIASES.map((alias) => (
              <TouchableOpacity
                key={alias.id}
                onPress={() => setIntentQuery(alias.intent)}
                style={[
                  styles.chipBtn,
                  {
                    backgroundColor:
                      intentQuery === alias.intent
                        ? theme.primary
                        : theme.surfaceVariant,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color:
                        intentQuery === alias.intent
                          ? '#FFFFFF'
                          : theme.textPrimary,
                    },
                  ]}
                >
                  {alias.intent}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Intent Search Results (Visible when searching) */}
        {intentQuery.trim().length > 0 && (
          <View style={[styles.section, { marginTop: spacing.lg, paddingHorizontal: spacing.lg }]}>
            <View style={[styles.sectionHeaderRow, { marginBottom: spacing.md }]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="search" size={18} color={theme.primary} />
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Arama Sonuçları ({searchResults.length})
                </Text>
              </View>
            </View>

            {searchResults.length === 0 ? (
              <View
                style={[
                  styles.emptySearchBox,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.lg },
                ]}
              >
                <Ionicons name="search-outline" size={32} color={theme.textMuted} />
                <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: 8 }]}>
                  "{intentQuery}" ile eşleşen araç bulunamadı.
                </Text>
              </View>
            ) : (
              <View style={styles.toolsGrid}>
                {searchResults.map((tool) => (
                  <View key={`search-${tool.id}`} style={styles.toolCol}>
                    <ToolCard
                      tool={tool}
                      variant="full"
                      onPress={() => handleOpenTool(tool)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Quick File & Image Picker Action Cards */}
        <View style={[styles.section, { marginTop: spacing.lg, paddingHorizontal: spacing.lg }]}>
          <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
            Hızlı Dosya ve Görsel İşlemleri
          </Text>

          <View style={styles.pickerRow}>
            <TouchableOpacity
              onPress={handlePickDocument}
              style={[
                styles.pickerCard,
                {
                  backgroundColor: theme.primaryContainer,
                  borderColor: theme.primary,
                  borderRadius: borderRadius.lg,
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="document-attach-outline" size={26} color={theme.onPrimaryContainer} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: theme.onPrimaryContainer, marginTop: 6, fontSize: 14 },
                ]}
              >
                Doküman / Dosya Seç
              </Text>
              <Text
                style={[
                  typography.labelSmall,
                  { color: theme.onPrimaryContainer, opacity: 0.8, marginTop: 2 },
                ]}
              >
                PDF, TXT, ZIP, Dokümanlar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickImage}
              style={[
                styles.pickerCard,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderColor: theme.accent,
                  borderRadius: borderRadius.lg,
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={26} color={theme.textPrimary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: theme.textPrimary, marginTop: 6, fontSize: 14 },
                ]}
              >
                Görsel / Video Seç
              </Text>
              <Text
                style={[
                  typography.labelSmall,
                  { color: theme.textSecondary, marginTop: 2 },
                ]}
              >
                Fotoğraf, Galeri, Videolar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected File & Matching Tools Panel */}
        {selectedFileMetadata && (
          <View
            style={[
              styles.selectedFileSection,
              {
                backgroundColor: theme.surface,
                borderColor: theme.primary,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
                marginHorizontal: spacing.lg,
                marginTop: spacing.lg,
              },
            ]}
          >
            <View style={styles.selectedFileHeader}>
              <View style={styles.fileIconBox}>
                <Ionicons
                  name={
                    selectedFileMetadata.type === 'image'
                      ? 'image-outline'
                      : selectedFileMetadata.type === 'pdf'
                      ? 'document-text-outline'
                      : selectedFileMetadata.type === 'video'
                      ? 'film-outline'
                      : 'document-outline'
                  }
                  size={24}
                  color={theme.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]} numberOfLines={1}>
                  {selectedFileMetadata.name}
                </Text>
                <Text style={[typography.labelSmall, { color: theme.textSecondary, marginTop: 2 }]}>
                  {formatFileSize(selectedFileMetadata.size)}{' '}
                  {selectedFileMetadata.type ? `• ${selectedFileMetadata.type.toUpperCase()}` : ''}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedFileMetadata(null)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Text
                style={[
                  typography.titleSmall,
                  { color: theme.textPrimary, marginBottom: spacing.xs },
                ]}
              >
                Uyumlu Araçlar ({matchingFileTools.length})
              </Text>
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginBottom: spacing.sm }]}>
                Seçtiğiniz bu dosya ile çalışabilen gündelik araçlar:
              </Text>

              {matchingFileTools.length === 0 ? (
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
                  Bu dosya türü için özel eşleşen araç bulunamadı.
                </Text>
              ) : (
                <View style={styles.toolsGrid}>
                  {matchingFileTools.map((tool) => (
                    <View key={`match-${tool.id}`} style={styles.toolCol}>
                      <ToolCard
                        tool={tool}
                        variant="full"
                        onPress={() => handleOpenTool(tool, selectedFileMetadata)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Favorites Section - ONLY visible when non-empty */}
        {favoriteTools.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.lg }]}>
            <View
              style={[
                styles.sectionHeaderRow,
                { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <Ionicons name="star" size={18} color={theme.star} />
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Favoriler
                </Text>
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.full,
                      marginLeft: spacing.xs,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                    {favoriteTools.length}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleOpenFavorites}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Tüm favorileri gör"
              >
                <Text style={[typography.labelMedium, { color: theme.primary }]}>
                  Tümünü Gör
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            >
              {favoriteTools.map((tool) => (
                <ToolCard
                  key={`fav-${tool.id}`}
                  tool={tool}
                  variant="compact"
                  onPress={() => handleOpenTool(tool)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories Section Grid */}
        <View style={[styles.section, { marginTop: spacing.lg, paddingHorizontal: spacing.lg }]}>
          <View style={[styles.sectionHeaderRow, { marginBottom: spacing.md }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid-outline" size={18} color={theme.primary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: theme.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Kategoriler
              </Text>
            </View>
          </View>

          <View style={styles.categoriesGrid}>
            {categories.map((category) => (
              <View key={category.id} style={styles.categoryCol}>
                <CategoryCard
                  category={category}
                  onPress={() => handleOpenCategory(category.id)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Recent Section - ONLY visible when non-empty */}
        {recentTools.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.lg }]}>
            <View
              style={[
                styles.sectionHeaderRow,
                { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
                <Text
                  style={[
                    typography.titleSmall,
                    { color: theme.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Son Kullanılanlar
                </Text>
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderRadius: borderRadius.full,
                      marginLeft: spacing.xs,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                    {recentTools.length}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={clearRecents}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Son kullanılanları temizle"
              >
                <Text style={[typography.labelMedium, { color: theme.error }]}>
                  Temizle
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            >
              {recentTools.map((tool) => (
                <ToolCard
                  key={`rec-${tool.id}`}
                  tool={tool}
                  variant="compact"
                  onPress={() => handleOpenTool(tool)}
                />
              ))}
            </ScrollView>
          </View>
        )}
        {/* Real operation history */}
        {historyEntries.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.lg, paddingHorizontal: spacing.lg }]}>
            <View style={[styles.sectionHeaderRow, { marginBottom: spacing.sm }]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="document-text-outline" size={18} color={theme.primary} />
                <Text style={[typography.titleSmall, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                  Son İşlemler
                </Text>
                <View
                  style={[
                    styles.countPill,
                    { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full, marginLeft: spacing.xs },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                    {historyEntries.length}
                  </Text>
                </View>
              </View>
            </View>
            {historyEntries.slice(0, 5).map((entry) => (
              <ResultCard
                key={entry.id}
                fileName={entry.outputFileName || entry.inputSummary || 'İşlem sonucu'}
                fileUri={entry.outputFileUri}
                fileSize={entry.outputFileSize}
                fileType={entry.outputFileType || 'file'}
                title={entry.actionName || entry.toolName}
                subtitle={entry.outputSummary}
                onContinue={() => {
                  const tool = getToolById(entry.toolId);
                  if (tool) {
                    navigation.navigate('Tool', {
                      toolId: tool.id,
                      selectedInput: entry.outputFileUri
                        ? {
                            uri: entry.outputFileUri,
                            name: entry.outputFileName,
                            type:
                              entry.outputFileType === 'image' ||
                              entry.outputFileType === 'pdf' ||
                              entry.outputFileType === 'video' ||
                              entry.outputFileType === 'audio' ||
                              entry.outputFileType === 'text' ||
                              entry.outputFileType === 'document' ||
                              entry.outputFileType === 'file'
                                ? entry.outputFileType
                                : 'file',
                            size: entry.outputFileSize,
                          }
                        : undefined,
                    });
                  }
                }}
                onDelete={() =>
                  Alert.alert(
                    'İşlemi sil',
                    'Bu işlem geçmişten kaldırılacak. Oluşturulan dosya silinmeyecek.',
                    [
                      { text: 'Vazgeç', style: 'cancel' },
                      { text: 'Sil', style: 'destructive', onPress: () => removeHistoryEntry(entry.id) },
                    ]
                  )
                }
                style={{ marginBottom: spacing.sm }}
              />
            ))}
          </View>
        )}
        <View
          style={[
            styles.storageSection,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.lg,
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <Ionicons name="server-outline" size={18} color={theme.primary} />
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
              Gündelik tarafından kullanılan alan
            </Text>
          </View>
          <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: spacing.xs }]}>
            {tempUsage.count > 0
              ? `${formatFileSize(tempUsage.bytes) || '0 B'} geçici dosya`
              : 'Geçici dosya bulunmuyor.'}
          </Text>
          {tempUsage.count > 0 && (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Geçici dosyaları temizle',
                  'Bu dosyalar yalnızca işlemleri hızlandırmak için tutulur ve silinecek.',
                  [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                      text: 'Temizle',
                      style: 'destructive',
                      onPress: async () => {
                        await tempFileManager.cleanupTempFiles(0);
                        await refreshTempUsage();
                      },
                    },
                  ]
                )
              }
              style={[styles.storageAction, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
            >
              <Ionicons name="trash-outline" size={16} color={theme.error} />
              <Text style={[typography.labelMedium, { color: theme.error, marginLeft: spacing.xs }]}>
                Geçici dosyaları temizle
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoIconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextCol: {
    marginLeft: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoritesShortcutBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  favBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  intentSection: {
    borderWidth: 1,
  },
  intentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intentInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  intentInput: {
    height: 48,
    borderWidth: 1,
    fontSize: 14,
    paddingRight: 40,
  },
  inputActionIcon: {
    position: 'absolute',
    right: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingTop: 12,
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
  },
  selectedFileSection: {
    borderWidth: 1.5,
  },
  selectedFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {},
  storageSection: {
    borderWidth: 1,
  },
  storageAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  categoryCol: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  toolCol: {
    width: '100%',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
});
