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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../core/theme';
import { CardOcrProgress, ExtractedContact } from './types';
import { saveToNativeContacts, scanBusinessCard } from './cardOcrService';
import { exportVCardFile } from './vcardService';

// Sample demonstration business card SVG data URI for instant testing
const DEMO_CARD_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" width="700" height="400">
    <rect width="700" height="400" rx="16" fill="#0f172a"/>
    <rect x="20" y="20" width="660" height="360" rx="12" fill="#1e293b" stroke="#334155" stroke-width="3"/>
    
    <!-- Accent Bar -->
    <rect x="40" y="50" width="8" height="300" rx="4" fill="#38bdf8"/>
    
    <text x="70" y="100" fill="#38bdf8" font-family="sans-serif" font-size="32" font-weight="bold">NOVA TEKNOLOJİ A.Ş.</text>
    <text x="70" y="145" fill="#f8fafc" font-family="sans-serif" font-size="24" font-weight="600">SELENA KAYA</text>
    <text x="70" y="175" fill="#94a3b8" font-family="sans-serif" font-size="18">Kıdemli Yazılım Mimarı / CTO</text>
    
    <line x1="70" y1="200" x2="620" y2="200" stroke="#334155" stroke-width="2"/>
    
    <text x="70" y="240" fill="#cbd5e1" font-family="sans-serif" font-size="16">Tel: +90 532 999 88 77</text>
    <text x="70" y="275" fill="#cbd5e1" font-family="sans-serif" font-size="16">E-posta: selena.kaya@novatech.com.tr</text>
    <text x="70" y="310" fill="#cbd5e1" font-family="sans-serif" font-size="16">Web: www.novatech.com.tr</text>
    <text x="70" y="345" fill="#94a3b8" font-family="sans-serif" font-size="14">Maslak Plaza No:14, Sarıyer / İSTANBUL</text>
  </svg>
`)}`;

export const BusinessCardContactsTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [cardImageUri, setCardImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<CardOcrProgress | null>(null);
  const [showRawOcr, setShowRawOcr] = useState<boolean>(false);

  // Editable Contact Fields State
  const [contact, setContact] = useState<ExtractedContact>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
    jobTitle: '',
    website: '',
    address: '',
    notes: '',
  });

  // Pick card image from gallery
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Galeriden kartvizit seçmek için medya izni veriniz.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCardImageUri(uri);
        startScan(uri);
      }
    } catch (err) {
      console.error('Pick card error:', err);
      Alert.alert('Hata', 'Görsel seçilirken hata oluştu.');
    }
  };

  // Capture card with camera
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Kartvizit çekmek için kamera izni veriniz.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCardImageUri(uri);
        startScan(uri);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Hata', 'Fotoğraf çekilirken hata oluştu.');
    }
  };

  // Load demo card
  const handleLoadDemo = () => {
    setCardImageUri(DEMO_CARD_URI);
    setContact({
      firstName: 'Selena',
      lastName: 'Kaya',
      phone: '+90 532 999 88 77',
      email: 'selena.kaya@novatech.com.tr',
      company: 'Nova Teknoloji A.Ş.',
      jobTitle: 'Kıdemli Yazılım Mimarı / CTO',
      website: 'www.novatech.com.tr',
      address: 'Maslak Plaza No:14, Sarıyer / İSTANBUL',
      notes: 'Gündelik demo kartvizit taraması',
      rawOcrText: 'NOVA TEKNOLOJİ A.Ş.\nSELENA KAYA\nKıdemli Yazılım Mimarı / CTO\nTel: +90 532 999 88 77\nE-posta: selena.kaya@novatech.com.tr\nWeb: www.novatech.com.tr\nMaslak Plaza No:14, Sarıyer / İSTANBUL',
    });
  };

  // Execute OCR Scan
  const startScan = async (uri: string) => {
    setIsScanning(true);
    setOcrProgress({ status: 'Hazırlanıyor...', progress: 0 });

    try {
      const extracted = await scanBusinessCard(uri, (p) => setOcrProgress(p));
      setContact(extracted);
    } catch (err: any) {
      console.error('Card scan error:', err);
      Alert.alert('OCR Okuma Hatası', err.message || 'Kartvizit okunamadı.');
    } finally {
      setIsScanning(false);
      setOcrProgress(null);
    }
  };

  // Field change handler
  const updateField = (field: keyof ExtractedContact, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  };

  // Save to native device contacts
  const handleSaveToNativeContacts = async () => {
    if (!contact.firstName && !contact.lastName && !contact.company) {
      Alert.alert('Eksik Bilgi', 'Lütfen en az ad, soyad veya şirket bilgisi giriniz.');
      return;
    }

    try {
      await saveToNativeContacts(contact);
      Alert.alert(
        'Başarılı! 🎉',
        `"${contact.firstName} ${contact.lastName}" rehberinize başarıyla kaydedildi.`
      );
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Rehbere kaydedilemedi.');
    }
  };

  // Export vCard VCF
  const handleExportVCard = async () => {
    try {
      await exportVCardFile(contact);
    } catch (err) {
      Alert.alert('Hata', 'vCard dosyası aktarılamadı.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primaryContainer }]}>
            <Ionicons name="card-outline" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Kartvizit &amp; Rehber Taraması</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Kartvizitinizi fotoğraflayın, OCR ile isim, telefon ve e-postayı doğrudan rehberinize aktarın.
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
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Örnek Kart</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Banner */}
      {isScanning && (
        <View style={[styles.progressCard, { backgroundColor: theme.primaryContainer, borderColor: theme.primary }]}>
          <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.progressStatus, { color: theme.onPrimaryContainer }]}>
              {ocrProgress?.status || 'Tarama yapılıyor...'}
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

      {!cardImageUri ? (
        <View style={[styles.placeholderCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Ionicons name="card-outline" size={56} color={theme.textMuted} />
          <Text style={[styles.placeholderTitle, { color: theme.textPrimary }]}>Kartvizit Yüklenmedi</Text>
          <Text style={[styles.placeholderDesc, { color: theme.textSecondary }]}>
            Fotoğraf çekerek veya galeriden kartvizit seçerek rehbere otomatik ekleyin.
          </Text>
        </View>
      ) : (
        <>
          {/* Card Preview Image */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Tarana Kartvizit Görseli</Text>
            <Image source={{ uri: cardImageUri }} style={styles.cardImagePreview} resizeMode="contain" />
          </View>

          {/* Extracted Editable Contact Form */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.formHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Çıkarılan İletişim Bilgileri</Text>
              <TouchableOpacity onPress={() => setShowRawOcr(!showRawOcr)}>
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>
                  {showRawOcr ? 'Formu Göster' : 'Ham OCR Metni'}
                </Text>
              </TouchableOpacity>
            </View>

            {showRawOcr ? (
              <View style={[styles.rawOcrBox, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.rawOcrText, { color: theme.textPrimary }]}>
                  {contact.rawOcrText || 'OCR metni bulunamadı.'}
                </Text>
              </View>
            ) : (
              <View style={styles.formGrid}>
                {/* First Name & Last Name */}
                <View style={styles.formRowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Ad</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={contact.firstName}
                      onChangeText={(val) => updateField('firstName', val)}
                      placeholder="Ahmet"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Soyad</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={contact.lastName}
                      onChangeText={(val) => updateField('lastName', val)}
                      placeholder="Yılmaz"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                {/* Phone & Email */}
                <View style={styles.formRowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Telefon</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={contact.phone}
                      onChangeText={(val) => updateField('phone', val)}
                      keyboardType="phone-pad"
                      placeholder="+90 532 000 00 00"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>E-posta</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={contact.email}
                      onChangeText={(val) => updateField('email', val)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="ornek@sirket.com"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                {/* Company & Job Title */}
                <View style={styles.formRowTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Şirket</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={contact.company}
                      onChangeText={(val) => updateField('company', val)}
                      placeholder="Şirket / Kurum Adı"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Unvan</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={contact.jobTitle}
                      onChangeText={(val) => updateField('jobTitle', val)}
                      placeholder="Müdür / Uzman / Yazılımcı"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                {/* Website */}
                <View style={styles.formField}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Web Sitesi</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                    value={contact.website}
                    onChangeText={(val) => updateField('website', val)}
                    autoCapitalize="none"
                    placeholder="www.sirket.com"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                {/* Address */}
                <View style={styles.formField}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Adres</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                    value={contact.address}
                    onChangeText={(val) => updateField('address', val)}
                    placeholder="Ofis / Şirket Adresi"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                {/* Notes */}
                <View style={styles.formField}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Notlar</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                    value={contact.notes}
                    onChangeText={(val) => updateField('notes', val)}
                    multiline
                    numberOfLines={3}
                    placeholder="Kartvizit ile ilgili notlar..."
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>
            )}

            {/* Action Buttons: Save to Native Contacts & Export vCard */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.mainActionBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveToNativeContacts}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={20} color={theme.onPrimary} style={{ marginRight: 6 }} />
                <Text style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 14 }}>
                  Rehbere Kaydet
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mainActionBtn, { backgroundColor: theme.accent }]}
                onPress={handleExportVCard}
                activeOpacity={0.85}
              >
                <Ionicons name="download-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
                  vCard (.vcf)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

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
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardImagePreview: {
    width: '100%',
    height: 200,
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
  formField: {},
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
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  mainActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
});
