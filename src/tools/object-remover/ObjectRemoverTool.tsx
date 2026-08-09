import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  BrushSizePreset,
  BrushStroke,
  CompareMode,
  InpaintingResult,
  Point,
  SamplePhoto,
  ViewMode,
} from './types';
import {
  SAMPLE_PHOTOS,
  inpaintImage,
  shareCleanedImage,
} from './inpaintingService';

const BRUSH_PRESETS: { size: BrushSizePreset; label: string }[] = [
  { size: 15, label: 'İnce (15px)' },
  { size: 30, label: 'Orta (30px)' },
  { size: 50, label: 'Geniş (50px)' },
];

export const ObjectRemoverTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Photo & Canvas state
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [cleanedImageUri, setCleanedImageUri] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Mode and stroke history state
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [redoStack, setRedoStack] = useState<BrushStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<BrushStroke | null>(null);

  // Inpainting Progress state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>('');
  const [lastResult, setLastResult] = useState<InpaintingResult | null>(null);

  // Comparison state
  const [compareMode, setCompareMode] = useState<CompareMode>('split');
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [isHoldingBefore, setIsHoldingBefore] = useState<boolean>(false);

  // Display container layout
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>({
    width: 360,
    height: 270,
  });

  // Brush hover cursor
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const canvasRef = useRef<any>(null);
  const containerRef = useRef<View>(null);

  // Measure and adjust canvas display size while preserving aspect ratio
  const updateDisplayDimensions = useCallback(
    (containerW: number, naturalW: number, naturalH: number) => {
      const maxW = Math.max(280, containerW - spacing.lg * 2);
      const aspect = naturalW / naturalH;
      let targetW = maxW;
      let targetH = targetW / aspect;

      const screenH = Dimensions.get('window').height;
      const maxH = Math.min(480, screenH * 0.5);
      if (targetH > maxH) {
        targetH = maxH;
        targetW = targetH * aspect;
      }

      setDisplaySize({
        width: Math.round(targetW),
        height: Math.round(targetH),
      });
    },
    [spacing.lg]
  );

  // Redraw mask canvas on web whenever strokes or currentStroke changes
  const redrawCanvas = useCallback(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.48)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of allStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.lineWidth = stroke.brushSize;

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle Photo selection from ImagePicker
  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçebilmek için galeri izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const w = asset.width || 800;
        const h = asset.height || 600;
        setImageDimensions({ width: w, height: h });
        setSelectedImageUri(asset.uri);
        setOriginalImageUri(asset.uri);
        setCleanedImageUri(null);
        setStrokes([]);
        setRedoStack([]);
        setViewMode('mask');

        const screenW = Dimensions.get('window').width;
        updateDisplayDimensions(screenW, w, h);
      }
    } catch (err) {
      console.warn('Error picking image:', err);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir sorun oluştu.');
    }
  };

  // Handle Camera Capture
  const handleCaptureWithCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted && Platform.OS !== 'web') {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekebilmek için kamera izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const w = asset.width || 800;
        const h = asset.height || 600;
        setImageDimensions({ width: w, height: h });
        setSelectedImageUri(asset.uri);
        setOriginalImageUri(asset.uri);
        setCleanedImageUri(null);
        setStrokes([]);
        setRedoStack([]);
        setViewMode('mask');

        const screenW = Dimensions.get('window').width;
        updateDisplayDimensions(screenW, w, h);
      }
    } catch (err) {
      console.warn('Error launching camera:', err);
      Alert.alert('Hata', 'Kamera açılırken bir sorun oluştu.');
    }
  };

  // Handle Sample Photo Selection
  const handleSelectSample = (sample: SamplePhoto, autoApplyDemo = false) => {
    setImageDimensions({ width: sample.width, height: sample.height });
    setSelectedImageUri(sample.imageUri);
    setOriginalImageUri(sample.imageUri);
    setCleanedImageUri(null);
    setRedoStack([]);
    setViewMode('mask');

    const screenW = Dimensions.get('window').width;
    updateDisplayDimensions(screenW, sample.width, sample.height);

    if (autoApplyDemo && sample.demoStrokes) {
      // Scale demo stroke coordinates to display canvas
      const scaleX = displaySize.width / sample.width;
      const scaleY = displaySize.height / sample.height;
      const scaledStrokes: BrushStroke[] = sample.demoStrokes.map((s, idx) => ({
        id: `demo_${idx}_${Date.now()}`,
        brushSize: Math.round(s.brushSize * scaleX),
        points: s.points.map((p) => ({
          x: Math.round(p.x * scaleX),
          y: Math.round(p.y * scaleY),
        })),
      }));
      setStrokes(scaledStrokes);
    } else {
      setStrokes([]);
    }
  };

  // Touch & Pointer Drawing handlers
  const handleTouchStart = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const startPoint: Point = { x: locationX, y: locationY };
    const newStroke: BrushStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      points: [startPoint],
      brushSize,
    };
    setCurrentStroke(newStroke);
    setCursorPos({ x: locationX, y: locationY, visible: true });
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    setCursorPos({ x: locationX, y: locationY, visible: true });

    if (currentStroke) {
      setCurrentStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, { x: locationX, y: locationY }],
        };
      });
    }
  };

  const handleTouchEnd = () => {
    if (currentStroke && currentStroke.points.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setRedoStack([]);
      setCurrentStroke(null);
    }
    setCursorPos((prev) => ({ ...prev, visible: false }));
  };

  // Undo / Redo / Clear Actions
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, lastStroke]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const restoredStroke = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setStrokes((prev) => [...prev, restoredStroke]);
  };

  const handleClearMask = () => {
    if (strokes.length === 0) return;
    setStrokes([]);
    setRedoStack([]);
  };

  // Start Inpainting Execution
  const handleExecuteInpainting = async () => {
    if (!selectedImageUri) return;
    if (strokes.length === 0) {
      Alert.alert(
        'Maske Çizilmedi',
        'Lütfen önce silmek istediğiniz nesnenin üzerini fırça ile kırmızı renkle boyayın.'
      );
      return;
    }

    try {
      setIsProcessing(true);
      setProgressPercent(10);
      setProgressStage('Maske katmanı taranıyor...');

      const result = await inpaintImage(
        selectedImageUri,
        {
          strokes,
          canvasWidth: displaySize.width,
          canvasHeight: displaySize.height,
        },
        {
          radius: 4,
          onProgress: (percent, stage) => {
            setProgressPercent(percent);
            setProgressStage(stage);
          },
        }
      );

      setCleanedImageUri(result.cleanedImageUri);
      setLastResult(result);
      setViewMode('result');
      setSplitRatio(0.5);
    } catch (err) {
      console.warn('Inpainting error:', err);
      Alert.alert(
        'İşlem Başarısız Oldu',
        'Nesne silinirken bir hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Use cleaned image to erase another object sequentially
  const handleContinueErasing = () => {
    if (cleanedImageUri) {
      setSelectedImageUri(cleanedImageUri);
      setStrokes([]);
      setRedoStack([]);
      setViewMode('mask');
    }
  };

  // Reset to original image
  const handleResetMasking = () => {
    if (originalImageUri) {
      setSelectedImageUri(originalImageUri);
      setStrokes([]);
      setRedoStack([]);
      setViewMode('mask');
    }
  };

  // Export / Share
  const handleShareImage = async () => {
    if (!cleanedImageUri) return;
    try {
      await shareCleanedImage(
        cleanedImageUri,
        `temizlenmis_fotograf_${Date.now()}.jpg`
      );
    } catch (err) {
      Alert.alert('Paylaşım Hatası', 'Görsel kaydedilirken veya paylaşılırken bir sorun oluştu.');
    }
  };

  // Split comparison drag handler
  const handleSplitTouchMove = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0.05, Math.min(0.95, locationX / displaySize.width));
    setSplitRatio(ratio);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ------------------------------------------------------------- */}
      {/* Header Info Banner */}
      {/* ------------------------------------------------------------- */}
      <View
        style={[
          styles.headerBanner,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.full },
            ]}
          >
            <Ionicons name="sparkles" size={22} color={theme.primary} />
          </View>
          <View style={styles.headerTextWrapper}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary, ...typography.titleMedium }]}>
              Fotoğraftan Nesne Silme
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary, ...typography.bodySmall }]}>
              İstenmeyen kişi, nesne, logo, yazı veya lekeleri boyayın ve anında yok edin.
            </Text>
          </View>
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* VIEW MODE 1: Select / Sample Photos Screen */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'select' && (
        <View style={styles.selectContainer}>
          {/* Main Action Buttons */}
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[
                styles.primaryPickCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.primary,
                  borderRadius: borderRadius.lg,
                },
              ]}
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Galeriden Fotoğraf Seç"
            >
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.md },
                ]}
              >
                <Ionicons name="images-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary, ...typography.titleSmall }]}>
                Galeriden Fotoğraf Seç
              </Text>
              <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.bodySmall }]}>
                Cihazınızdaki fotoğraflardan birini seçin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryPickCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.lg,
                },
              ]}
              onPress={handleCaptureWithCamera}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Fotoğraf Çek"
            >
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                ]}
              >
                <Ionicons name="camera-outline" size={32} color={theme.textPrimary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary, ...typography.titleSmall }]}>
                Fotoğraf Çek
              </Text>
              <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.bodySmall }]}>
                Kamera ile yeni bir görüntü yakalayın
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sample Photos Section */}
          <View style={styles.samplesSection}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="flash-outline" size={18} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.textPrimary, ...typography.titleSmall }]}>
                Hızlı Deneme Örnekleri (1-Tıkla Test Edin)
              </Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary, ...typography.bodySmall }]}>
              Herhangi bir dosya yüklemeden algoritmanın gücünü hemen test edin:
            </Text>

            <View style={styles.samplesList}>
              {SAMPLE_PHOTOS.map((sample) => (
                <View
                  key={sample.id}
                  style={[
                    styles.sampleCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                      borderRadius: borderRadius.lg,
                    },
                  ]}
                >
                  <View style={styles.sampleImageContainer}>
                    <Image
                      source={{ uri: sample.imageUri }}
                      style={styles.sampleThumbnail}
                      resizeMode="cover"
                    />
                    <View
                      style={[
                        styles.categoryBadge,
                        {
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.cardBorder,
                          borderRadius: borderRadius.xs,
                        },
                      ]}
                    >
                      <Text style={[styles.categoryBadgeText, { color: theme.primary, ...typography.labelSmall }]}>
                        {sample.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sampleInfo}>
                    <Text style={[styles.sampleTitle, { color: theme.textPrimary, ...typography.titleSmall }]}>
                      {sample.title}
                    </Text>
                    <Text style={[styles.sampleDesc, { color: theme.textSecondary, ...typography.bodySmall }]}>
                      {sample.description}
                    </Text>

                    <View style={styles.sampleActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.sampleBtnSecondary,
                          {
                            backgroundColor: theme.surfaceVariant,
                            borderRadius: borderRadius.md,
                          },
                        ]}
                        onPress={() => handleSelectSample(sample, false)}
                      >
                        <Ionicons name="brush-outline" size={16} color={theme.textPrimary} />
                        <Text style={[styles.sampleBtnText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                          Kendin Boya
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.sampleBtnPrimary,
                          {
                            backgroundColor: theme.primary,
                            borderRadius: borderRadius.md,
                          },
                        ]}
                        onPress={() => handleSelectSample(sample, true)}
                      >
                        <Ionicons name="sparkles" size={16} color={theme.onPrimary} />
                        <Text style={[styles.sampleBtnTextPrimary, { color: theme.onPrimary, ...typography.labelMedium }]}>
                          Örnek Maskeyi Uygula
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW MODE 2: Interactive Masking & Drawing Canvas */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'mask' && selectedImageUri && (
        <View style={styles.maskContainer}>
          {/* Top Actions: Change Image, Info */}
          <View style={styles.toolbarTop}>
            <TouchableOpacity
              style={[
                styles.smallButton,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => setViewMode('select')}
            >
              <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
              <Text style={[styles.smallButtonText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                Görseli Değiştir
              </Text>
            </TouchableOpacity>

            <View style={styles.strokeCountBadge}>
              <Text style={[styles.strokeCountText, { color: theme.textMuted, ...typography.bodySmall }]}>
                {strokes.length > 0 ? `${strokes.length} fırça darbesi` : 'Boyama bekleniyor'}
              </Text>
            </View>
          </View>

          {/* Interactive Canvas Board */}
          <View
            ref={containerRef}
            style={[
              styles.canvasWrapper,
              {
                width: displaySize.width,
                height: displaySize.height,
                borderRadius: borderRadius.md,
                borderColor: theme.cardBorder,
              },
            ]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleTouchStart}
            onResponderMove={handleTouchMove}
            onResponderRelease={handleTouchEnd}
            onResponderTerminate={handleTouchEnd}
          >
            {/* Background Image */}
            <Image
              source={{ uri: selectedImageUri }}
              style={[styles.canvasImage, { width: displaySize.width, height: displaySize.height }]}
              resizeMode="contain"
            />

            {/* Web HTML5 Canvas Overlay */}
            {Platform.OS === 'web' && (
              <canvas
                ref={canvasRef}
                width={displaySize.width}
                height={displaySize.height}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: displaySize.width,
                  height: displaySize.height,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Brush Cursor Indicator */}
            {cursorPos.visible && (
              <View
                style={[
                  styles.brushCursor,
                  {
                    left: cursorPos.x - brushSize / 2,
                    top: cursorPos.y - brushSize / 2,
                    width: brushSize,
                    height: brushSize,
                    borderRadius: brushSize / 2,
                  },
                ]}
              />
            )}
          </View>

          {/* Hint instruction bar */}
          <View
            style={[
              styles.hintBox,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.md,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
            <Text style={[styles.hintText, { color: theme.textSecondary, ...typography.bodySmall }]}>
              Silmek istediğiniz nesnenin tamamını kırmızı fırça ile kaplayacak şekilde boyayın.
            </Text>
          </View>

          {/* Brush Controls & Presets */}
          <View
            style={[
              styles.controlsCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            {/* Brush Size Selector */}
            <View style={styles.brushHeaderRow}>
              <View style={styles.brushTitleLeft}>
                <Ionicons name="brush" size={18} color={theme.textPrimary} />
                <Text style={[styles.controlLabel, { color: theme.textPrimary, ...typography.titleSmall }]}>
                  Fırça Boyutu: {brushSize}px
                </Text>
              </View>

              {/* Dynamic visual preview of brush diameter */}
              <View style={styles.brushPreviewContainer}>
                <View
                  style={[
                    styles.brushPreviewDot,
                    {
                      width: Math.min(36, brushSize),
                      height: Math.min(36, brushSize),
                      borderRadius: Math.min(36, brushSize) / 2,
                      backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Preset Buttons */}
            <View style={styles.presetButtonsRow}>
              {BRUSH_PRESETS.map((preset) => {
                const isSelected = brushSize === preset.size;
                return (
                  <TouchableOpacity
                    key={preset.size}
                    style={[
                      styles.presetButton,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.surfaceVariant,
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    onPress={() => setBrushSize(preset.size)}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        {
                          ...typography.labelMedium,
                          color: isSelected ? theme.onPrimaryContainer : theme.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Adjustment Stepper (+ / -) */}
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[
                  styles.stepperBtn,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                ]}
                onPress={() => setBrushSize((prev) => Math.max(10, prev - 5))}
              >
                <Ionicons name="remove" size={20} color={theme.textPrimary} />
                <Text style={[styles.stepperText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                  -5px Küçült
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.stepperBtn,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                ]}
                onPress={() => setBrushSize((prev) => Math.min(80, prev + 5))}
              >
                <Ionicons name="add" size={20} color={theme.textPrimary} />
                <Text style={[styles.stepperText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                  +5px Büyüt
                </Text>
              </TouchableOpacity>
            </View>

            {/* Undo / Redo / Clear Tools Row */}
            <View style={styles.historyToolbar}>
              <TouchableOpacity
                style={[
                  styles.historyBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    opacity: strokes.length > 0 ? 1 : 0.45,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={handleUndo}
                disabled={strokes.length === 0}
              >
                <Ionicons name="arrow-undo-outline" size={18} color={theme.textPrimary} />
                <Text style={[styles.historyBtnText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                  Geri Al
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.historyBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    opacity: redoStack.length > 0 ? 1 : 0.45,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={handleRedo}
                disabled={redoStack.length === 0}
              >
                <Ionicons name="arrow-redo-outline" size={18} color={theme.textPrimary} />
                <Text style={[styles.historyBtnText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                  İleri Al
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.historyBtn,
                  {
                    backgroundColor: theme.errorContainer,
                    opacity: strokes.length > 0 ? 1 : 0.45,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={handleClearMask}
                disabled={strokes.length === 0}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
                <Text style={[styles.historyBtnText, { color: theme.error, ...typography.labelMedium }]}>
                  Temizle
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Action Button: Nesneyi Sil */}
          <TouchableOpacity
            style={[
              styles.primaryExecuteBtn,
              {
                backgroundColor: strokes.length > 0 ? theme.primary : theme.surfaceVariant,
                borderRadius: borderRadius.lg,
              },
            ]}
            onPress={handleExecuteInpainting}
            disabled={strokes.length === 0 || isProcessing}
            activeOpacity={0.85}
          >
            <Ionicons
              name="sparkles"
              size={22}
              color={strokes.length > 0 ? theme.onPrimary : theme.textMuted}
            />
            <Text
              style={[
                styles.primaryExecuteBtnText,
                {
                  color: strokes.length > 0 ? theme.onPrimary : theme.textMuted,
                  ...typography.titleSmall,
                },
              ]}
            >
              Nesneyi Sil & Temizle
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW MODE 3: Before / After Comparison & Export Result */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'result' && cleanedImageUri && (
        <View style={styles.resultContainer}>
          {/* Result Status Header */}
          <View
            style={[
              styles.resultHeaderBox,
              {
                backgroundColor: theme.successContainer,
                borderColor: theme.success,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={24} color={theme.success} />
            <View style={styles.resultHeaderText}>
              <Text style={[styles.resultHeaderTitle, { color: theme.textPrimary, ...typography.titleSmall }]}>
                Nesne Başarıyla Silindi!
              </Text>
              <Text style={[styles.resultHeaderSub, { color: theme.textSecondary, ...typography.bodySmall }]}>
                {lastResult
                  ? `Süre: ${lastResult.processingTimeMs}ms • Algoritma: ${lastResult.algorithmUsed}`
                  : 'Doku ve renk dengelenmesi tamamlandı.'}
              </Text>
            </View>
          </View>

          {/* Compare Mode Selector Tabs */}
          <View
            style={[
              styles.tabsContainer,
              {
                backgroundColor: theme.surfaceVariant,
                borderRadius: borderRadius.md,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabBtn,
                compareMode === 'split' && {
                  backgroundColor: theme.surface,
                  borderRadius: borderRadius.sm,
                },
              ]}
              onPress={() => setCompareMode('split')}
            >
              <Ionicons
                name="git-compare-outline"
                size={16}
                color={compareMode === 'split' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    ...typography.labelMedium,
                    color: compareMode === 'split' ? theme.primary : theme.textSecondary,
                    fontWeight: compareMode === 'split' ? '700' : '500',
                  },
                ]}
              >
                Kaydırıcı (Önce/Sonra)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                compareMode === 'hold' && {
                  backgroundColor: theme.surface,
                  borderRadius: borderRadius.sm,
                },
              ]}
              onPress={() => setCompareMode('hold')}
            >
              <Ionicons
                name="hand-left-outline"
                size={16}
                color={compareMode === 'hold' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    ...typography.labelMedium,
                    color: compareMode === 'hold' ? theme.primary : theme.textSecondary,
                    fontWeight: compareMode === 'hold' ? '700' : '500',
                  },
                ]}
              >
                Basılı Tut (Önceyi Gör)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                compareMode === 'side-by-side' && {
                  backgroundColor: theme.surface,
                  borderRadius: borderRadius.sm,
                },
              ]}
              onPress={() => setCompareMode('side-by-side')}
            >
              <Ionicons
                name="browsers-outline"
                size={16}
                color={compareMode === 'side-by-side' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    ...typography.labelMedium,
                    color: compareMode === 'side-by-side' ? theme.primary : theme.textSecondary,
                    fontWeight: compareMode === 'side-by-side' ? '700' : '500',
                  },
                ]}
              >
                Yan Yana
              </Text>
            </TouchableOpacity>
          </View>

          {/* Comparison Viewports */}
          {compareMode === 'split' && (
            <View
              style={[
                styles.splitWrapper,
                {
                  width: displaySize.width,
                  height: displaySize.height,
                  borderRadius: borderRadius.md,
                  borderColor: theme.cardBorder,
                },
              ]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={handleSplitTouchMove}
              onResponderMove={handleSplitTouchMove}
            >
              {/* Cleaned Image (Full background) */}
              <Image
                source={{ uri: cleanedImageUri }}
                style={[styles.splitImage, { width: displaySize.width, height: displaySize.height }]}
                resizeMode="contain"
              />

              {/* Original Image (Clipped to splitRatio width) */}
              <View
                style={[
                  styles.splitLeftClip,
                  {
                    width: displaySize.width * splitRatio,
                    height: displaySize.height,
                  },
                ]}
              >
                <Image
                  source={{ uri: originalImageUri || selectedImageUri || '' }}
                  style={[
                    styles.splitImageOriginal,
                    {
                      width: displaySize.width,
                      height: displaySize.height,
                    },
                  ]}
                  resizeMode="contain"
                />
              </View>

              {/* Vertical Split Bar */}
              <View
                style={[
                  styles.splitDividerBar,
                  {
                    left: displaySize.width * splitRatio - 1.5,
                    height: displaySize.height,
                  },
                ]}
              >
                <View
                  style={[
                    styles.splitHandleCircle,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.primary,
                    },
                  ]}
                >
                  <Ionicons name="swap-horizontal" size={16} color={theme.primary} />
                </View>
              </View>

              {/* Badges */}
              <View style={[styles.badgeLeft, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
                <Text style={styles.badgeText}>Önce</Text>
              </View>
              <View style={[styles.badgeRight, { backgroundColor: theme.primary }]}>
                <Text style={styles.badgeText}>Sonra</Text>
              </View>
            </View>
          )}

          {compareMode === 'hold' && (
            <View style={styles.holdCompareContainer}>
              <View
                style={[
                  styles.canvasWrapper,
                  {
                    width: displaySize.width,
                    height: displaySize.height,
                    borderRadius: borderRadius.md,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Image
                  source={{
                    uri: isHoldingBefore
                      ? originalImageUri || selectedImageUri || ''
                      : cleanedImageUri,
                  }}
                  style={[styles.canvasImage, { width: displaySize.width, height: displaySize.height }]}
                  resizeMode="contain"
                />
                <View
                  style={[
                    styles.holdStatusBadge,
                    {
                      backgroundColor: isHoldingBefore ? theme.warning : theme.success,
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {isHoldingBefore ? 'Orijinal (Önce)' : 'Temizlenmiş (Sonra)'}
                  </Text>
                </View>
              </View>

              {/* Hold Button */}
              <TouchableOpacity
                style={[
                  styles.holdTriggerBtn,
                  {
                    backgroundColor: isHoldingBefore ? theme.primary : theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.lg,
                  },
                ]}
                onPressIn={() => setIsHoldingBefore(true)}
                onPressOut={() => setIsHoldingBefore(false)}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="hand-left"
                  size={20}
                  color={isHoldingBefore ? theme.onPrimary : theme.textPrimary}
                />
                <Text
                  style={[
                    styles.holdTriggerBtnText,
                    {
                      color: isHoldingBefore ? theme.onPrimary : theme.textPrimary,
                      ...typography.titleSmall,
                    },
                  ]}
                >
                  {isHoldingBefore ? 'Bırakınca Temizlenmiş Hali Görünür' : 'Önceki Halini Görmek İçin Basılı Tut'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {compareMode === 'side-by-side' && (
            <View style={styles.sideBySideContainer}>
              <View
                style={[
                  styles.sideCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <View style={[styles.sideCardHeader, { backgroundColor: theme.surfaceVariant }]}>
                  <Text style={[styles.sideCardHeaderText, { color: theme.textSecondary, ...typography.labelMedium }]}>
                    Önce (Orijinal)
                  </Text>
                </View>
                <Image
                  source={{ uri: originalImageUri || selectedImageUri || '' }}
                  style={styles.sideImage}
                  resizeMode="cover"
                />
              </View>

              <View
                style={[
                  styles.sideCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <View style={[styles.sideCardHeader, { backgroundColor: theme.primaryContainer }]}>
                  <Text style={[styles.sideCardHeaderText, { color: theme.onPrimaryContainer, ...typography.labelMedium }]}>
                    Sonra (Temizlenmiş)
                  </Text>
                </View>
                <Image
                  source={{ uri: cleanedImageUri }}
                  style={styles.sideImage}
                  resizeMode="cover"
                />
              </View>
            </View>
          )}

          {/* Action Buttons: Save/Share, Continue, Reset */}
          <View style={styles.resultActionsGrid}>
            <TouchableOpacity
              style={[
                styles.mainShareBtn,
                {
                  backgroundColor: theme.primary,
                  borderRadius: borderRadius.lg,
                },
              ]}
              onPress={handleShareImage}
              activeOpacity={0.85}
            >
              <Ionicons name="download-outline" size={22} color={theme.onPrimary} />
              <Text style={[styles.mainShareBtnText, { color: theme.onPrimary, ...typography.titleSmall }]}>
                Temizlenmiş Görseli Kaydet / Paylaş
              </Text>
            </TouchableOpacity>

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={handleContinueErasing}
              >
                <Ionicons name="brush-outline" size={18} color={theme.textPrimary} />
                <Text style={[styles.secondaryActionText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                  Başka Bir Nesne Sil
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: theme.surfaceVariant,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={handleResetMasking}
              >
                <Ionicons name="refresh-outline" size={18} color={theme.textPrimary} />
                <Text style={[styles.secondaryActionText, { color: theme.textPrimary, ...typography.labelMedium }]}>
                  En Başa Dön
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Processing Modal Overlay */}
      {/* ------------------------------------------------------------- */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
              },
            ]}
          >
            <View
              style={[
                styles.modalIconBox,
                { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.full },
              ]}
            >
              <ActivityIndicator size="large" color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.textPrimary, ...typography.titleMedium }]}>
              Nesne Temizleniyor...
            </Text>

            <Text style={[styles.modalStage, { color: theme.textSecondary, ...typography.bodySmall }]}>
              {progressStage || 'Fast Marching doku yayılımı hesaplanıyor...'}
            </Text>

            {/* Progress Bar */}
            <View
              style={[
                styles.progressBarTrack,
                { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.full,
                  },
                ]}
              />
            </View>

            <Text style={[styles.modalPercentText, { color: theme.textMuted, ...typography.labelSmall }]}>
              %{progressPercent}
            </Text>
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
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBanner: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    marginBottom: 4,
  },
  headerSubtitle: {
    lineHeight: 18,
  },

  // Select Screen Styles
  selectContainer: {
    gap: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryPickCard: {
    flex: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cardIconBox: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDesc: {
    textAlign: 'center',
    lineHeight: 16,
  },

  // Samples Section
  samplesSection: {
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionSubtitle: {
    marginBottom: 14,
  },
  samplesList: {
    gap: 16,
  },
  sampleCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  sampleImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#000',
  },
  sampleThumbnail: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontWeight: '600',
  },
  sampleInfo: {
    padding: 14,
  },
  sampleTitle: {
    marginBottom: 4,
  },
  sampleDesc: {
    marginBottom: 12,
  },
  sampleActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sampleBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  sampleBtnPrimary: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  sampleBtnText: {
    fontWeight: '600',
  },
  sampleBtnTextPrimary: {
    fontWeight: '700',
  },

  // Mask View Mode
  maskContainer: {
    alignItems: 'center',
    gap: 14,
  },
  toolbarTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 4,
  },
  smallButtonText: {
    fontWeight: '600',
  },
  strokeCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  strokeCountText: {},

  canvasWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    alignSelf: 'center',
    backgroundColor: '#000000',
  },
  canvasImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  brushCursor: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    pointerEvents: 'none',
  },

  hintBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    gap: 8,
  },
  hintText: {
    flex: 1,
    lineHeight: 16,
  },

  controlsCard: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  brushHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brushTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlLabel: {
    fontWeight: '600',
  },
  brushPreviewContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushPreviewDot: {},

  presetButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  presetButtonText: {},

  stepperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepperBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  stepperText: {},

  historyToolbar: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
    paddingTop: 12,
  },
  historyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  historyBtnText: {
    fontWeight: '600',
  },

  primaryExecuteBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  primaryExecuteBtnText: {
    fontWeight: '700',
  },

  // Result / Comparison Styles
  resultContainer: {
    gap: 16,
    alignItems: 'center',
  },
  resultHeaderBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  resultHeaderText: {
    flex: 1,
  },
  resultHeaderTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  resultHeaderSub: {},

  tabsContainer: {
    width: '100%',
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  tabBtnText: {},

  splitWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#000',
  },
  splitImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  splitLeftClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  splitImageOriginal: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  splitDividerBar: {
    position: 'absolute',
    top: 0,
    width: 3,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  splitHandleCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  badgeLeft: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 5,
  },
  badgeRight: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 5,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  holdCompareContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  holdStatusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  holdTriggerBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
  },
  holdTriggerBtnText: {
    fontWeight: '700',
  },

  sideBySideContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  sideCard: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sideCardHeader: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  sideCardHeaderText: {},
  sideImage: {
    width: '100%',
    height: 180,
  },

  resultActionsGrid: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  mainShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  mainShareBtnText: {
    fontWeight: '700',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderWidth: 1,
    gap: 6,
  },
  secondaryActionText: {
    fontWeight: '600',
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  modalStage: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
  },
  modalPercentText: {
    fontWeight: '700',
  },
});
