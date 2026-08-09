import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import {
  FormCheckboxField,
  FormFillerActiveTab,
  FormSignatureField,
  FormTextField,
  LoadedPdfInfo,
  PdfFormFillerResult,
} from './types';
import {
  fillAndExportPdf,
  formatFileSize,
  getPdfPageCount,
  readUriAsBytes,
  shareOrDownloadPdf,
} from './pdfFormFillerService';

export const PdfFormFillerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Document State
  const [loadedPdf, setLoadedPdf] = useState<LoadedPdfInfo | null>(null);
  const [activePage, setActivePage] = useState<number>(0); // 0-indexed
  const [activeTab, setActiveTab] = useState<FormFillerActiveTab>('text');

  // Fields State
  const [textFields, setTextFields] = useState<FormTextField[]>([]);
  const [checkboxes, setCheckboxes] = useState<FormCheckboxField[]>([]);
  const [signatures, setSignatures] = useState<FormSignatureField[]>([]);

  // Draft Text Field Inputs
  const [draftTextLabel, setDraftTextLabel] = useState<string>('Ad Soyad');
  const [draftTextValue, setDraftTextValue] = useState<string>('Ahmet Yılmaz');
  const [draftTextX, setDraftTextX] = useState<number>(20);
  const [draftTextY, setDraftTextY] = useState<number>(30);
  const [draftFontSize, setDraftFontSize] = useState<number>(14);
  const [draftTextColor, setDraftTextColor] = useState<string>('#000000');

  // Draft Checkbox Inputs
  const [draftCbLabel, setDraftCbLabel] = useState<string>('Şartları Kabul Ediyorum');
  const [draftCbChecked, setDraftCbChecked] = useState<boolean>(true);
  const [draftCbX, setDraftCbX] = useState<number>(20);
  const [draftCbY, setDraftCbY] = useState<number>(45);
  const [draftCbSize, setDraftCbSize] = useState<number>(18);

  // Signature State & Drawing Canvas (Web & Touch)
  const [sigImageUri, setSigImageUri] = useState<string | null>(null);
  const [draftSigX, setDraftSigX] = useState<number>(50);
  const [draftSigY, setDraftSigY] = useState<number>(75);
  const [draftSigW, setDraftSigW] = useState<number>(30);
  const [draftSigH, setDraftSigH] = useState<number>(12);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [outputFileName, setOutputFileName] = useState<string>('doldurulmus_form');
  const [exportResult, setExportResult] = useState<PdfFormFillerResult | null>(null);

  // Pick PDF File
  const handlePickPdf = async () => {
    try {
      const pickRes = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (pickRes.canceled || !pickRes.assets || pickRes.assets.length === 0) {
        return;
      }

      const asset = pickRes.assets[0];
      const bytes = await readUriAsBytes(asset.uri);
      const pageCount = await getPdfPageCount(bytes);

      setLoadedPdf({
        uri: asset.uri,
        fileName: asset.name || 'belge.pdf',
        fileSize: asset.size || bytes.length,
        pageCount,
        bytes,
      });
      setActivePage(0);
      setExportResult(null);
      setOutputFileName(
        asset.name ? asset.name.replace(/\.pdf$/i, '_form') : 'doldurulmus_form'
      );
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'PDF dosyası yüklenirken bir hata oluştu.');
    }
  };

  // Add Text Field
  const handleAddTextField = () => {
    if (!draftTextValue.trim()) {
      Alert.alert('Uyarı', 'Lütfen metin içeriği giriniz.');
      return;
    }

    const newField: FormTextField = {
      id: `text_${Date.now()}`,
      pageIndex: activePage,
      label: draftTextLabel.trim() || 'Metin Alanı',
      value: draftTextValue,
      x: draftTextX,
      y: draftTextY,
      fontSize: draftFontSize,
      color: draftTextColor,
    };

    setTextFields((prev) => [...prev, newField]);
    Alert.alert('Başarılı', `${activePage + 1}. Sayfaya metin alanı eklendi.`);
  };

  // Add Checkbox Field
  const handleAddCheckbox = () => {
    const newCb: FormCheckboxField = {
      id: `cb_${Date.now()}`,
      pageIndex: activePage,
      label: draftCbLabel.trim() || 'Onay Kutusu',
      checked: draftCbChecked,
      x: draftCbX,
      y: draftCbY,
      size: draftCbSize,
    };

    setCheckboxes((prev) => [...prev, newCb]);
    Alert.alert('Başarılı', `${activePage + 1}. Sayfaya onay kutusu eklendi.`);
  };

  // Pick Signature Image
  const handlePickSignatureImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setSigImageUri(uri);
      }
    } catch (err: any) {
      Alert.alert('Hata', 'İmza görseli seçilemedi.');
    }
  };

  // Clear Web Canvas Signature
  const handleClearCanvas = () => {
    if (Platform.OS === 'web' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    setSigImageUri(null);
  };

  // Save Canvas Signature as Image Data URI
  const handleSaveCanvasSignature = () => {
    if (Platform.OS === 'web' && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      setSigImageUri(dataUrl);
      Alert.alert('İmza Oluşturuldu', 'Çizilen imza hazır! Şimdi sayfaya ekleyebilirsiniz.');
    } else {
      Alert.alert('İmza', 'Lütfen imza görseli yükleyin veya imza seçeneğini kullanın.');
    }
  };

  // Add Signature to Page
  const handleAddSignatureToPage = () => {
    if (!sigImageUri) {
      Alert.alert('Uyarı', 'Lütfen önce imza çizin veya imza görseli seçin.');
      return;
    }

    const newSig: FormSignatureField = {
      id: `sig_${Date.now()}`,
      pageIndex: activePage,
      label: 'Dijital İmza',
      imageUri: sigImageUri,
      x: draftSigX,
      y: draftSigY,
      width: draftSigW,
      height: draftSigH,
    };

    setSignatures((prev) => [...prev, newSig]);
    Alert.alert('Başarılı', `${activePage + 1}. Sayfaya imza eklendi.`);
  };

  // Export PDF
  const handleExportPdf = async () => {
    if (!loadedPdf) return;

    if (textFields.length === 0 && checkboxes.length === 0 && signatures.length === 0) {
      Alert.alert('Uyarı', 'Henüz belgeye hiçbir metin, onay kutusu veya imza eklemediniz.');
    }

    try {
      setIsExporting(true);
      const res = await fillAndExportPdf(
        loadedPdf.bytes,
        textFields,
        checkboxes,
        signatures,
        outputFileName
      );
      setExportResult(res);
    } catch (err: any) {
      Alert.alert('Dışa Aktarma Hatası', err?.message || 'PDF oluşturulurken bir hata meydana geldi.');
    } finally {
      setIsExporting(false);
    }
  };

  // Share or Download Result
  const handleShareResult = async () => {
    if (!exportResult) return;
    try {
      await shareOrDownloadPdf(exportResult);
    } catch (err: any) {
      Alert.alert('Paylaşım Hatası', err?.message || 'Dosya indirilemedi/paylaşılamadı.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Ionicons name="create-outline" size={32} color={theme.primary} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>PDF Form Doldurucu</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            PDF belgelerine metin alanları, onay kutuları ve dijital imza ekleyip dışa aktarın.
          </Text>
        </View>
      </View>

      {/* PDF Loader Section */}
      {!loadedPdf ? (
        <View style={[styles.uploadBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Ionicons name="document-text-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.uploadTitle, { color: theme.textPrimary }]}>PDF Belgesi Seçin</Text>
          <Text style={[styles.uploadSub, { color: theme.textSecondary }]}>
            Form eklemek istediğiniz PDF dosyasını cihazınızdan seçin.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handlePickPdf}
          >
            <Ionicons name="folder-open-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>PDF Seç</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {/* File Selected Card */}
          <View style={[styles.fileCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.fileCardInfo}>
              <Ionicons name="document-attach" size={28} color={theme.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.fileName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {loadedPdf.fileName}
                </Text>
                <Text style={[styles.fileMeta, { color: theme.textSecondary }]}>
                  {formatFileSize(loadedPdf.fileSize)} • {loadedPdf.pageCount} Sayfa
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.changeButton, { borderColor: theme.cardBorder }]}
              onPress={handlePickPdf}
            >
              <Text style={[styles.changeButtonText, { color: theme.primary }]}>Değiştir</Text>
            </TouchableOpacity>
          </View>

          {/* Page Navigator */}
          <View style={[styles.pageBar, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={[styles.pageBarLabel, { color: theme.textPrimary }]}>
              Hedef Sayfa: <Text style={{ fontWeight: '700' }}>Sayfa {activePage + 1} / {loadedPdf.pageCount}</Text>
            </Text>
            <View style={styles.pageBarControls}>
              <TouchableOpacity
                disabled={activePage === 0}
                onPress={() => setActivePage((p) => Math.max(0, p - 1))}
                style={[styles.pageNavBtn, { opacity: activePage === 0 ? 0.4 : 1 }]}
              >
                <Ionicons name="chevron-back" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                disabled={activePage === loadedPdf.pageCount - 1}
                onPress={() => setActivePage((p) => Math.min(loadedPdf.pageCount - 1, p + 1))}
                style={[styles.pageNavBtn, { opacity: activePage === loadedPdf.pageCount - 1 ? 0.4 : 1 }]}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'text' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('text')}
            >
              <Ionicons
                name="text-outline"
                size={18}
                color={activeTab === 'text' ? theme.primary : theme.textMuted}
              />
              <Text style={[styles.tabText, { color: activeTab === 'text' ? theme.primary : theme.textMuted }]}>
                Metin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'checkbox' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('checkbox')}
            >
              <Ionicons
                name="checkbox-outline"
                size={18}
                color={activeTab === 'checkbox' ? theme.primary : theme.textMuted}
              />
              <Text style={[styles.tabText, { color: activeTab === 'checkbox' ? theme.primary : theme.textMuted }]}>
                Onay
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'signature' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('signature')}
            >
              <Ionicons
                name="pencil-outline"
                size={18}
                color={activeTab === 'signature' ? theme.primary : theme.textMuted}
              />
              <Text style={[styles.tabText, { color: activeTab === 'signature' ? theme.primary : theme.textMuted }]}>
                İmza
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'fields' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('fields')}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={activeTab === 'fields' ? theme.primary : theme.textMuted}
              />
              <Text style={[styles.tabText, { color: activeTab === 'fields' ? theme.primary : theme.textMuted }]}>
                Eklenenler ({textFields.length + checkboxes.length + signatures.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab 1: Text Field Editor */}
          {activeTab === 'text' && (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Metin Alanı Ekle</Text>

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Metin İçeriği:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={draftTextValue}
                onChangeText={setDraftTextValue}
                placeholder="Örn: Ad Soyad, T.C. No, Tarih..."
                placeholderTextColor={theme.textMuted}
              />

              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>X Pozisyonu (%): {draftTextX}%</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    keyboardType="numeric"
                    value={String(draftTextX)}
                    onChangeText={(val) => setDraftTextX(Math.max(0, Math.min(100, Number(val) || 0)))}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Y Pozisyonu (%): {draftTextY}%</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    keyboardType="numeric"
                    value={String(draftTextY)}
                    onChangeText={(val) => setDraftTextY(Math.max(0, Math.min(100, Number(val) || 0)))}
                  />
                </View>
              </View>

              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Yazı Boyutu (pt):</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    keyboardType="numeric"
                    value={String(draftFontSize)}
                    onChangeText={(val) => setDraftFontSize(Math.max(6, Math.min(72, Number(val) || 12)))}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Renk (Hex):</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    value={draftTextColor}
                    onChangeText={setDraftTextColor}
                    placeholder="#000000"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: spacing.md }]}
                onPress={handleAddTextField}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{activePage + 1}. Sayfaya Metin Ekle</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tab 2: Checkbox Editor */}
          {activeTab === 'checkbox' && (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Onay Kutusu Ekle</Text>

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Kutu Etiketi:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={draftCbLabel}
                onChangeText={setDraftCbLabel}
                placeholder="Örn: Okudum, onaylıyorum"
                placeholderTextColor={theme.textMuted}
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setDraftCbChecked(!draftCbChecked)}
              >
                <Ionicons
                  name={draftCbChecked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={theme.primary}
                />
                <Text style={[styles.checkboxRowLabel, { color: theme.textPrimary }]}>
                  Varsayılan Durum: {draftCbChecked ? 'İşaretli (X)' : 'Boş'}
                </Text>
              </TouchableOpacity>

              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>X Pozisyonu (%): {draftCbX}%</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    keyboardType="numeric"
                    value={String(draftCbX)}
                    onChangeText={(val) => setDraftCbX(Math.max(0, Math.min(100, Number(val) || 0)))}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Y Pozisyonu (%): {draftCbY}%</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    keyboardType="numeric"
                    value={String(draftCbY)}
                    onChangeText={(val) => setDraftCbY(Math.max(0, Math.min(100, Number(val) || 0)))}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: spacing.md }]}
                onPress={handleAddCheckbox}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{activePage + 1}. Sayfaya Onay Kutusu Ekle</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tab 3: Signature Drawing / Upload */}
          {activeTab === 'signature' && (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>İmza Ekle / Çiz</Text>

              {/* Web Canvas Signature Area */}
              {Platform.OS === 'web' ? (
                <View style={styles.canvasContainer}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>İmzanızı Aşağıdaki Alana Çizin:</Text>
                  <div
                    style={{
                      border: `2px dashed ${theme.cardBorder}`,
                      borderRadius: borderRadius.md,
                      backgroundColor: '#FFFFFF',
                      touchAction: 'none',
                      cursor: 'crosshair',
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={180}
                      onMouseDown={(e) => {
                        setIsDrawing(true);
                        const ctx = e.currentTarget.getContext('2d');
                        if (ctx) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          ctx.beginPath();
                          ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                          ctx.strokeStyle = '#000000';
                          ctx.lineWidth = 2.5;
                          ctx.lineCap = 'round';
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawing) return;
                        const ctx = e.currentTarget.getContext('2d');
                        if (ctx) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                          ctx.stroke();
                        }
                      }}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                    />
                  </div>
                  <View style={styles.canvasActionRow}>
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.surfaceVariant }]} onPress={handleClearCanvas}>
                      <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Temizle</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.primary }]} onPress={handleSaveCanvasSignature}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>İmza Kaydet</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: spacing.sm }]}>veya Galeriden İmza Görseli Yükleyin:</Text>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.primary }]}
                onPress={handlePickSignatureImage}
              >
                <Ionicons name="image-outline" size={20} color={theme.primary} />
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>İmza Fotoğrafı Seç</Text>
              </TouchableOpacity>

              {sigImageUri ? (
                <View style={styles.previewSigBox}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Hazır İmza Önizleme:</Text>
                  <Image source={{ uri: sigImageUri }} style={styles.sigPreviewImage} resizeMode="contain" />
                </View>
              ) : null}

              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>X Pozisyonu (%): {draftSigX}%</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    keyboardType="numeric"
                    value={String(draftSigX)}
                    onChangeText={(val) => setDraftSigX(Math.max(0, Math.min(100, Number(val) || 0)))}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Y Pozisyonu (%): {draftSigY}%</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                    keyboardType="numeric"
                    value={String(draftSigY)}
                    onChangeText={(val) => setDraftSigY(Math.max(0, Math.min(100, Number(val) || 0)))}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: spacing.md }]}
                onPress={handleAddSignatureToPage}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{activePage + 1}. Sayfaya İmza Ekle</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tab 4: Added Fields Summary List */}
          {activeTab === 'fields' && (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Eklenen Alanlar Listesi</Text>

              {textFields.length === 0 && checkboxes.length === 0 && signatures.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Henüz hiçbir form alanı eklenmedi.
                </Text>
              ) : (
                <View>
                  {textFields.map((item) => (
                    <View key={item.id} style={[styles.fieldRow, { borderColor: theme.cardBorder }]}>
                      <Ionicons name="text-outline" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={[styles.fieldRowTitle, { color: theme.textPrimary }]}>{item.label}: "{item.value}"</Text>
                        <Text style={[styles.fieldRowSub, { color: theme.textSecondary }]}>
                          Sayfa {item.pageIndex + 1} • X: %{item.x}, Y: %{item.y}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setTextFields((prev) => prev.filter((f) => f.id !== item.id))}>
                        <Ionicons name="trash-outline" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {checkboxes.map((item) => (
                    <View key={item.id} style={[styles.fieldRow, { borderColor: theme.cardBorder }]}>
                      <Ionicons name="checkbox-outline" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={[styles.fieldRowTitle, { color: theme.textPrimary }]}>{item.label} ({item.checked ? 'İşaretli' : 'Boş'})</Text>
                        <Text style={[styles.fieldRowSub, { color: theme.textSecondary }]}>
                          Sayfa {item.pageIndex + 1} • X: %{item.x}, Y: %{item.y}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setCheckboxes((prev) => prev.filter((c) => c.id !== item.id))}>
                        <Ionicons name="trash-outline" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {signatures.map((item) => (
                    <View key={item.id} style={[styles.fieldRow, { borderColor: theme.cardBorder }]}>
                      <Ionicons name="pencil-outline" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={[styles.fieldRowTitle, { color: theme.textPrimary }]}>Dijital İmza</Text>
                        <Text style={[styles.fieldRowSub, { color: theme.textSecondary }]}>
                          Sayfa {item.pageIndex + 1} • X: %{item.x}, Y: %{item.y}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setSignatures((prev) => prev.filter((s) => s.id !== item.id))}>
                        <Ionicons name="trash-outline" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Export Action Card */}
          <View style={[styles.exportCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Formlu PDF'yi Dışa Aktar</Text>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Çıktı Dosya Adı:</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              value={outputFileName}
              onChangeText={setOutputFileName}
              placeholder="doldurulmus_form"
            />

            {isExporting ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>PDF Alanları İşleniyor...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.success, marginTop: spacing.md }]}
                onPress={handleExportPdf}
              >
                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Yeni PDF Oluştur</Text>
              </TouchableOpacity>
            )}

            {exportResult ? (
              <View style={[styles.resultBox, { backgroundColor: theme.successContainer }]}>
                <Ionicons name="checkmark-circle" size={32} color={theme.success} />
                <Text style={[styles.resultTitle, { color: theme.textPrimary }]}>Formlu PDF Başarıyla Hazırlandı!</Text>
                <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>
                  {exportResult.fileName} ({formatFileSize(exportResult.fileSize)})
                </Text>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: spacing.sm }]}
                  onPress={handleShareResult}
                >
                  <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>İndir / Paylaş</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  uploadBox: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  uploadSub: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  fileCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
  },
  fileMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  pageBarLabel: {
    fontSize: 14,
  },
  pageBarControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageNavBtn: {
    padding: 6,
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rowTwo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  checkboxRowLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
  canvasContainer: {
    marginVertical: 12,
  },
  canvasActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  smallBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  previewSigBox: {
    marginTop: 12,
  },
  sigPreviewImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginTop: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  fieldRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  exportCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  loadingBox: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  resultBox: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  resultMeta: {
    fontSize: 13,
    marginTop: 4,
  },
});
