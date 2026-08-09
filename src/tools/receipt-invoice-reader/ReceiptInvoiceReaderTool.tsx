import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { ExtractedReceipt, ReceiptExportFormat, ReceiptItem, ReceiptOcrProgress } from './types';
import {
  exportReceiptFile,
  formatReceiptAsText,
  scanReceiptOrInvoice,
} from './receiptOcrService';

// Sample demonstration receipt SVG data URI for instant testing
const DEMO_RECEIPT_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 800" width="500" height="800">
    <rect width="500" height="800" fill="#f8fafc"/>
    <rect x="20" y="20" width="460" height="760" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    
    <text x="250" y="80" text-anchor="middle" fill="#0f172a" font-family="sans-serif" font-size="28" font-weight="bold">MİGROS TİCARET A.Ş.</text>
    <text x="250" y="115" text-anchor="middle" fill="#475569" font-family="sans-serif" font-size="16">KADIKÖY ŞUBESİ - İSTANBUL</text>
    
    <text x="40" y="160" fill="#64748B" font-family="monospace" font-size="14">Tarih: 09.08.2026</text>
    <text x="320" y="160" fill="#64748B" font-family="monospace" font-size="14">Saat: 14:20</text>
    <text x="40" y="185" fill="#64748B" font-family="monospace" font-size="14">Fiş No: 004821</text>
    <text x="320" y="185" fill="#64748B" font-family="monospace" font-size="14">KDV: %10</text>

    <line x1="40" y1="210" x2="460" y2="210" stroke="#94a3b8" stroke-dasharray="4,4"/>

    <text x="40" y="250" fill="#0f172a" font-family="monospace" font-size="16">1 x ORGANİK SÜT 1L</text>
    <text x="400" y="250" fill="#0f172a" font-family="monospace" font-size="16">42.50 TL</text>

    <text x="40" y="290" fill="#0f172a" font-family="monospace" font-size="16">2 x TAM BUĞDAY EKMEK</text>
    <text x="400" y="290" fill="#0f172a" font-family="monospace" font-size="16">30.00 TL</text>

    <text x="40" y="330" fill="#0f172a" font-family="monospace" font-size="16">1 x SÜZME PEYNİR 500G</text>
    <text x="400" y="330" fill="#0f172a" font-family="monospace" font-size="16">95.00 TL</text>

    <text x="40" y="370" fill="#0f172a" font-family="monospace" font-size="16">1 x DEMLİK POŞET ÇAY</text>
    <text x="400" y="370" fill="#0f172a" font-family="monospace" font-size="16">78.00 TL</text>

    <line x1="40" y1="410" x2="460" y2="410" stroke="#94a3b8" stroke-dasharray="4,4"/>

    <text x="40" y="450" fill="#475569" font-family="monospace" font-size="16">TOPLAM KDV (%10):</text>
    <text x="400" y="450" fill="#475569" font-family="monospace" font-size="16">24.55 TL</text>

    <text x="40" y="500" fill="#0f172a" font-family="sans-serif" font-size="24" font-weight="bold">TOPLAM TUTAR:</text>
    <text x="360" y="500" fill="#16a34a" font-family="sans-serif" font-size="26" font-weight="bold">245.50 TL</text>

    <text x="40" y="550" fill="#64748B" font-family="sans-serif" font-size="16">Ödeme: TEMASSIZ KREDİ KARTI</text>

    <line x1="40" y1="590" x2="460" y2="590" stroke="#cbd5e1"/>

    <text x="250" y="650" text-anchor="middle" fill="#64748B" font-family="monospace" font-size="14">BİZİ TERCİH ETTİĞİNİZ İÇİN TEŞEKKÜRLER!</text>
    <rect x="150" y="680" width="200" height="50" fill="#0f172a"/>
  </svg>
`)}`;

const CATEGORY_OPTIONS = [
  'Market & Gıda',
  'Akaryakıt / Ulaşım',
  'Yeme & İçme',
  'Elektronik',
  'Giyim & Tekstil',
  'Ev & Yaşam',
  'Sağlık & Medikal',
  'Genel',
];

export const ReceiptInvoiceReaderTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<ReceiptOcrProgress | null>(null);
  const [showRawOcr, setShowRawOcr] = useState<boolean>(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState<boolean>(false);

  // Extracted Receipt Form State
  const [receipt, setReceipt] = useState<ExtractedReceipt>({
    companyName: '',
    date: '',
    time: '',
    totalAmount: 0,
    currency: 'TL',
    taxAmount: 0,
    invoiceNumber: '',
    paymentMethod: 'Kredi Kartı',
    category: 'Market & Gıda',
    items: [],
  });

  // Pick receipt photo from gallery
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Galeriden fiş/fatura seçmek için medya kitaplığı izni veriniz.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setReceiptImageUri(uri);
        startScan(uri);
      }
    } catch (err) {
      console.error('Pick receipt error:', err);
      Alert.alert('Hata', 'Görsel seçilirken hata oluştu.');
    }
  };

  // Capture receipt with camera
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fiş/Fatura çekmek için kamera izni veriniz.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setReceiptImageUri(uri);
        startScan(uri);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Hata', 'Fotoğraf çekilirken hata oluştu.');
    }
  };

  // Load demo receipt
  const handleLoadDemo = () => {
    setReceiptImageUri(DEMO_RECEIPT_URI);
    setReceipt({
      companyName: 'MİGROS TİCARET A.Ş.',
      date: '09.08.2026',
      time: '14:20',
      totalAmount: 245.5,
      currency: 'TL',
      taxAmount: 24.55,
      invoiceNumber: '004821',
      paymentMethod: 'Kredi Kartı',
      category: 'Market & Gıda',
      items: [
        { id: '1', description: 'ORGANİK SÜT 1L', price: 42.5 },
        { id: '2', description: 'TAM BUĞDAY EKMEK (2x)', price: 30.0 },
        { id: '3', description: 'SÜZME PEYNİR 500G', price: 95.0 },
        { id: '4', description: 'DEMLİK POŞET ÇAY', price: 78.0 },
      ],
      rawOcrText: 'MİGROS TİCARET A.Ş.\nKADIKÖY ŞUBESİ - İSTANBUL\nTarih: 09.08.2026 Saat: 14:20\nFiş No: 004821 KDV: %10\n1 x ORGANİK SÜT 1L 42.50 TL\n2 x TAM BUĞDAY EKMEK 30.00 TL\n1 x SÜZME PEYNİR 500G 95.00 TL\n1 x DEMLİK POŞET ÇAY 78.00 TL\nTOPLAM KDV (%10): 24.55 TL\nTOPLAM TUTAR: 245.50 TL\nÖdeme: TEMASSIZ KREDİ KARTI',
    });
  };

  // Execute OCR scan
  const startScan = async (uri: string) => {
    setIsScanning(true);
    setOcrProgress({ status: 'Hazırlanıyor...', progress: 0 });

    try {
      const extracted = await scanReceiptOrInvoice(uri, (p) => setOcrProgress(p));
      setReceipt(extracted);
    } catch (err: any) {
      console.error('Receipt scan error:', err);
      Alert.alert('OCR Hatası', err.message || 'Fiş/Fatura okunamadı.');
    } finally {
      setIsScanning(false);
      setOcrProgress(null);
    }
  };

  // Field change handler
  const updateField = (field: keyof ExtractedReceipt, value: any) => {
    setReceipt((prev) => ({ ...prev, [field]: value }));
  };

  // Line item CRUD
  const updateItem = (id: string, field: keyof ReceiptItem, val: any) => {
    setReceipt((prev) => {
      const newItems = prev.items.map((it) => (it.id === id ? { ...it, [field]: val } : it));
      // Auto-recalculate total sum of items
      const sum = newItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
      return {
        ...prev,
        items: newItems,
        totalAmount: sum > 0 ? +sum.toFixed(2) : prev.totalAmount,
      };
    });
  };

  const handleAddItem = () => {
    const newItem: ReceiptItem = {
      id: Date.now().toString(),
      description: 'Yeni Ürün / Hizmet',
      price: 0,
    };
    setReceipt((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const handleDeleteItem = (id: string) => {
    setReceipt((prev) => {
      const newItems = prev.items.filter((it) => it.id !== id);
      const sum = newItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
      return {
        ...prev,
        items: newItems,
        totalAmount: sum > 0 ? +sum.toFixed(2) : prev.totalAmount,
      };
    });
  };

  // Copy text summary to clipboard
  const handleCopyTextSummary = async () => {
    const text = formatReceiptAsText(receipt);
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopyalandı! 📋', 'Fiş özeti panoya kopyalandı.');
  };

  // Export receipt file
  const handleExport = async (format: ReceiptExportFormat) => {
    try {
      await exportReceiptFile(receipt, format);
      setIsExportModalVisible(false);
    } catch (err) {
      Alert.alert('Hata', 'Dosya dışa aktarılamadı.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primaryContainer }]}>
            <Ionicons name="receipt-outline" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Fiş &amp; Fatura Okuyucu</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Fiş ve faturaları tarayarak işletme, tarih, KDV, toplam tutar ve satır kalemlerini otomatik çıkarın.
            </Text>
          </View>
        </View>

        {/* Action Pickers */}
        <View style={styles.actionRow}>
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
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Örnek Fiş</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Banner */}
      {isScanning && (
        <View style={[styles.progressCard, { backgroundColor: theme.primaryContainer, borderColor: theme.primary }]}>
          <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.progressStatus, { color: theme.onPrimaryContainer }]}>
              {ocrProgress?.status || 'Fiş ayrıştırılıyor...'}
            </Text>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round((ocrProgress?.progress || 0) * 100)}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {!receiptImageUri ? (
        <View style={[styles.placeholderCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Ionicons name="receipt-outline" size={56} color={theme.textMuted} />
          <Text style={[styles.placeholderTitle, { color: theme.textPrimary }]}>Fiş Yüklenmedi</Text>
          <Text style={[styles.placeholderDesc, { color: theme.textSecondary }]}>
            Fiş veya fatura fotoğrafını yükleyerek harcama kalemlerini ve tutarları otomatik listeleyin.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <View style={styles.statGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Toplam Tutar</Text>
              <Text style={[styles.statValue, { color: theme.success }]}>
                {receipt.totalAmount.toFixed(2)} {receipt.currency}
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>KDV / Vergi</Text>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {receipt.taxAmount.toFixed(2)} {receipt.currency}
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Kalem Adedi</Text>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                {receipt.items.length} Kalem
              </Text>
            </View>
          </View>

          {/* Receipt Image Preview */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Taranan Fiş Görseli</Text>
            <Image source={{ uri: receiptImageUri }} style={styles.receiptImgPreview} resizeMode="contain" />
          </View>

          {/* Editable Receipt Details Form */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.formHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Fiş / Fatura Bilgileri</Text>
              <TouchableOpacity onPress={() => setShowRawOcr(!showRawOcr)}>
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>
                  {showRawOcr ? 'Formu Göster' : 'Ham OCR Metni'}
                </Text>
              </TouchableOpacity>
            </View>

            {showRawOcr ? (
              <View style={[styles.rawOcrBox, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.rawOcrText, { color: theme.textPrimary }]}>
                  {receipt.rawOcrText || 'OCR metni çıkarılamadı.'}
                </Text>
              </View>
            ) : (
              <View style={styles.formGrid}>
                {/* Company Name & Invoice Number */}
                <View style={styles.formRowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Firma / İşletme Adı</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.companyName}
                      onChangeText={(val) => updateField('companyName', val)}
                      placeholder="MİGROS, BİM vb."
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Fiş / Fatura No</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.invoiceNumber}
                      onChangeText={(val) => updateField('invoiceNumber', val)}
                      placeholder="001234"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                {/* Date & Time */}
                <View style={styles.formRowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Tarih</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.date}
                      onChangeText={(val) => updateField('date', val)}
                      placeholder="DD.MM.YYYY"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Saat</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.time || ''}
                      onChangeText={(val) => updateField('time', val)}
                      placeholder="14:30"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                {/* Total & Tax Amount */}
                <View style={styles.formRowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Toplam Tutar ({receipt.currency})</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.totalAmount.toString()}
                      onChangeText={(val) => updateField('totalAmount', parseFloat(val) || 0)}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>KDV Tutarı ({receipt.currency})</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.taxAmount.toString()}
                      onChangeText={(val) => updateField('taxAmount', parseFloat(val) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Category & Payment Method */}
                <View style={styles.formRowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Kategori</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.category}
                      onChangeText={(val) => updateField('category', val)}
                      placeholder="Market / Akaryakıt"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Ödeme Yöntemi</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={receipt.paymentMethod}
                      onChangeText={(val) => updateField('paymentMethod', val)}
                      placeholder="Kredi Kartı / Nakit"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Line Items List */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Harcama Kalemleri</Text>
              <TouchableOpacity onPress={handleAddItem} style={styles.addItemBtn}>
                <Ionicons name="add-circle" size={18} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                  Kalem Ekle
                </Text>
              </TouchableOpacity>
            </View>

            {receipt.items.length === 0 ? (
              <Text style={[styles.emptyItemsText, { color: theme.textMuted }]}>
                Ayrıştırılan kalem bulunamadı. "+ Kalem Ekle"ye basarak elle ekleyebilirsiniz.
              </Text>
            ) : (
              <View style={styles.itemList}>
                {receipt.items.map((item, idx) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Text style={[styles.itemIndex, { color: theme.textMuted }]}>{idx + 1}.</Text>
                    <TextInput
                      style={[
                        styles.itemDescInput,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={item.description}
                      onChangeText={(val) => updateItem(item.id, 'description', val)}
                      placeholder="Ürün adı"
                      placeholderTextColor={theme.textMuted}
                    />
                    <TextInput
                      style={[
                        styles.itemPriceInput,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={item.price.toString()}
                      onChangeText={(val) => updateItem(item.id, 'price', parseFloat(val) || 0)}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Main Action Buttons: Copy Text & Export Modal */}
          <View style={styles.mainActionRow}>
            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={handleCopyTextSummary}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={20} color={theme.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.mainBtnText, { color: theme.textPrimary }]}>Metni Kopyala</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: theme.primary }]}
              onPress={() => setIsExportModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={20} color={theme.onPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.mainBtnText, { color: theme.onPrimary }]}>Özeti Dışa Aktar</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Export Format Modal */}
      <Modal visible={isExportModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Dışa Aktarma Formatı Seçin</Text>
              <TouchableOpacity onPress={() => setIsExportModalVisible(false)}>
                <Ionicons name="close" size={22} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formatList}>
              <TouchableOpacity
                style={[styles.formatOptionBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => handleExport('text')}
              >
                <Ionicons name="document-text-outline" size={24} color={theme.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.formatOptionTitle, { color: theme.textPrimary }]}>Metin Dosyası (.txt)</Text>
                  <Text style={[styles.formatOptionSub, { color: theme.textSecondary }]}>
                    Okunabilir düz metin özeti
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formatOptionBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => handleExport('csv')}
              >
                <Ionicons name="stats-chart-outline" size={24} color={theme.accent} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.formatOptionTitle, { color: theme.textPrimary }]}>Excel / CSV (.csv)</Text>
                  <Text style={[styles.formatOptionSub, { color: theme.textSecondary }]}>
                    Tablo ve muhasebe yazılımları için
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formatOptionBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => handleExport('json')}
              >
                <Ionicons name="code-slash-outline" size={24} color={theme.warning} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.formatOptionTitle, { color: theme.textPrimary }]}>JSON Verisi (.json)</Text>
                  <Text style={[styles.formatOptionSub, { color: theme.textSecondary }]}>
                    Yazılım ve API entegrasyonu için
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
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
  actionRow: {
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
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  progressStatus: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
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
  statGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  receiptImgPreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rawOcrBox: {
    padding: 12,
    borderRadius: 10,
  },
  rawOcrText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  formGrid: {
    gap: 12,
  },
  formRowTwo: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyItemsText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  itemList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemIndex: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 20,
  },
  itemDescInput: {
    flex: 2,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  itemPriceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  mainActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  mainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  mainBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  formatList: {
    gap: 10,
  },
  formatOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
  },
  formatOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  formatOptionSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
