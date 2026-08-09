import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import {
  NfcCapabilityStatus,
  NfcOperationStatus,
  NfcRecordPayload,
  NfcRecordType,
  ParsedNfcMessage,
} from './types';
import { checkNfcCapability, readNfcTag, writeNfcTag } from './nfcService';

export const NfcTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // Capability Status State
  const [capability, setCapability] = useState<NfcCapabilityStatus>({ isSupported: false });

  // Main UI Mode Tab
  const [activeTab, setActiveTab] = useState<'read' | 'write' | 'history'>('read');

  // Operation State
  const [opStatus, setOpStatus] = useState<NfcOperationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Read State & History
  const [lastReadMessage, setLastReadMessage] = useState<ParsedNfcMessage | null>(null);
  const [history, setHistory] = useState<ParsedNfcMessage[]>([]);

  // Write Draft State
  const [writeType, setWriteType] = useState<NfcRecordType>('text');
  const [textContent, setTextContent] = useState<string>('Merhaba Gündelik NFC');
  const [urlContent, setUrlContent] = useState<string>('https://gundelik.app');
  const [phoneContent, setPhoneContent] = useState<string>('+905551234567');
  const [mimeContent, setMimeContent] = useState<string>('{"app": "gundelik", "v": 1}');
  const [mimeType, setMimeType] = useState<string>('application/json');

  useEffect(() => {
    const status = checkNfcCapability();
    setCapability(status);
  }, []);

  // Handle Start NFC Read Session
  const handleStartRead = async () => {
    if (!capability.isSupported) {
      Alert.alert('NFC Desteklenmiyor', capability.reason || 'Cihazınızda NFC okuma donanımı/tarayıcı desteği yok.');
      return;
    }

    setOpStatus('scanning_read');
    setStatusMessage('Lütfen NFC etiketini veya kartınızı cihazın arkasına yaklaştırın...');

    const cancelFn = await readNfcTag(
      (msg) => {
        setLastReadMessage(msg);
        setHistory((prev) => [msg, ...prev]);
        setOpStatus('success');
        setStatusMessage('NFC Etiketi Başarıyla Okundu!');
      },
      (errMessage) => {
        setOpStatus('error');
        setStatusMessage(errMessage);
      }
    );
  };

  // Handle Write NFC Action
  const handleWriteNfc = async () => {
    if (!capability.isSupported) {
      Alert.alert('NFC Desteklenmiyor', capability.reason || 'NFC yazma özelliği bu cihazda/tarayıcıda aktif değil.');
      return;
    }

    let payloadContent = textContent;
    if (writeType === 'url') payloadContent = urlContent;
    if (writeType === 'phone') payloadContent = phoneContent;
    if (writeType === 'mime') payloadContent = mimeContent;

    if (!payloadContent.trim()) {
      Alert.alert('Uyarı', 'Lütfen yazılacak NDEF içeriğini giriniz.');
      return;
    }

    const payload: NfcRecordPayload = {
      id: `payload_${Date.now()}`,
      type: writeType,
      content: payloadContent,
      mimeType,
      lang: 'tr',
    };

    try {
      setOpStatus('scanning_write');
      setStatusMessage('Yazma modunda NFC etiketi bekleniyor. Lütfen etikete dokundurun...');
      await writeNfcTag(payload);
      setOpStatus('success');
      setStatusMessage('NDEF Kaydı NFC Etiketine Başarıyla Yazıldı!');
      Alert.alert('Başarılı', 'İçerik NFC etiketine başarıyla kaydedildi.');
    } catch (err: any) {
      setOpStatus('error');
      setStatusMessage(err?.message || 'NFC yazma sırasında hata oluştu.');
      Alert.alert('Yazma Hatası', err?.message || 'Etikete yazılamadı.');
    }
  };

  // Copy Content to Clipboard
  const handleCopyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopyalandı', 'Metin panoya kopyalandı.');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Ionicons name="hardware-chip-outline" size={32} color={theme.primary} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>NFC Araç Kutusu</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            NFC kart ve etiketlerinden NDEF metin, URL ve telefon verilerini okuyun ve yazın.
          </Text>
        </View>
      </View>

      {/* Capability Status Banner */}
      <View
        style={[
          styles.statusBanner,
          {
            backgroundColor: capability.isSupported
              ? theme.successContainer
              : theme.warningContainer,
            borderColor: capability.isSupported ? theme.success : theme.warning,
          },
        ]}
      >
        <Ionicons
          name={capability.isSupported ? 'checkmark-circle' : 'alert-circle'}
          size={22}
          color={capability.isSupported ? theme.success : theme.warning}
        />
        <View style={{ flex: 1, marginLeft: spacing.xs }}>
          <Text
            style={[
              styles.statusBannerTitle,
              { color: capability.isSupported ? theme.success : theme.textPrimary },
            ]}
          >
            {capability.isSupported ? 'NFC Donanımı & API Aktif' : 'NFC Desteklenmiyor'}
          </Text>
          <Text style={[styles.statusBannerSub, { color: theme.textSecondary }]}>
            {capability.isSupported
              ? 'Cihazınız NDEF okuma ve yazma işlemlerine hazır.'
              : capability.reason}
          </Text>
        </View>
      </View>

      {/* Navigation Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'read' && { backgroundColor: theme.primary }]}
          onPress={() => setActiveTab('read')}
        >
          <Ionicons name="radio-outline" size={18} color={activeTab === 'read' ? '#FFFFFF' : theme.textPrimary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'read' ? '#FFFFFF' : theme.textPrimary }]}>
            NFC Oku
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'write' && { backgroundColor: theme.primary }]}
          onPress={() => setActiveTab('write')}
        >
          <Ionicons name="pencil-outline" size={18} color={activeTab === 'write' ? '#FFFFFF' : theme.textPrimary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'write' ? '#FFFFFF' : theme.textPrimary }]}>
            NFC Yaz
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && { backgroundColor: theme.primary }]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="time-outline" size={18} color={activeTab === 'history' ? '#FFFFFF' : theme.textPrimary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'history' ? '#FFFFFF' : theme.textPrimary }]}>
            Geçmiş ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: READ NFC */}
      {activeTab === 'read' && (
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>NFC Etiketi Okuma</Text>
          <Text style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: 12 }]}>
            NFC kartınızı veya etiketinizi (akıllı kart, otobüs kartı, NFC sticker) okutmak için taramayı başlatın.
          </Text>

          {opStatus === 'scanning_read' ? (
            <View style={styles.scanningBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.scanningText, { color: theme.primary }]}>{statusMessage}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: capability.isSupported ? theme.primary : theme.textMuted },
              ]}
              disabled={!capability.isSupported}
              onPress={handleStartRead}
            >
              <Ionicons name="radio-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>NFC Tarayıcıyı Başlat</Text>
            </TouchableOpacity>
          )}

          {/* Last Read Result Card */}
          {lastReadMessage && (
            <View style={[styles.readResultCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}>
              <View style={styles.readResultHeader}>
                <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                <Text style={[styles.readResultTitle, { color: theme.textPrimary }]}>
                  Seri No: {lastReadMessage.serialNumber || 'NFC_TAG'}
                </Text>
              </View>

              {lastReadMessage.records.map((rec, i) => (
                <View key={i} style={[styles.recordBox, { borderColor: theme.cardBorder }]}>
                  <Text style={[styles.recordTypeTag, { color: theme.primary }]}>
                    Kayıt Türü: {rec.recordType.toUpperCase()} {rec.mediaType ? `(${rec.mediaType})` : ''}
                  </Text>

                  <Text style={[styles.recordContent, { color: theme.textPrimary }]}>
                    {rec.textData || '(Boş Veri)'}
                  </Text>

                  <TouchableOpacity
                    style={[styles.smallCopyBtn, { borderColor: theme.primary }]}
                    onPress={() => handleCopyToClipboard(rec.textData || '')}
                  >
                    <Ionicons name="copy-outline" size={14} color={theme.primary} />
                    <Text style={[styles.smallCopyText, { color: theme.primary }]}>Metni Kopyala</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* TAB 2: WRITE NFC */}
      {activeTab === 'write' && (
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder, marginBottom: 32 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>NFC Etiketine Yazma</Text>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Yazılacak NDEF Kayıt Türünü Seçin:</Text>

          <View style={styles.writeTypeRow}>
            {[
              { id: 'text', label: 'Metin', icon: 'text-outline' },
              { id: 'url', label: 'URL / Bağlantı', icon: 'link-outline' },
              { id: 'phone', label: 'Telefon (tel:)', icon: 'call-outline' },
              { id: 'mime', label: 'JSON / Mime', icon: 'code-slash-outline' },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.writeTypeChip,
                  { borderColor: theme.cardBorder },
                  writeType === t.id && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => setWriteType(t.id as any)}
              >
                <Ionicons name={t.icon as any} size={16} color={writeType === t.id ? theme.primary : theme.textSecondary} />
                <Text style={[styles.writeTypeChipText, { color: writeType === t.id ? theme.primary : theme.textPrimary }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form Fields according to Write Type */}
          {writeType === 'text' && (
            <View>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Yazılacak Metin İçeriği:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={textContent}
                onChangeText={setTextContent}
                placeholder="Örn: Wi-Fi Şifresi veya İletişim Notu"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          )}

          {writeType === 'url' && (
            <View>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Hedef Web URL Adresi:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={urlContent}
                onChangeText={setUrlContent}
                placeholder="https://gundelik.app"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          )}

          {writeType === 'phone' && (
            <View>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Telefon Numarası:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                keyboardType="phone-pad"
                value={phoneContent}
                onChangeText={setPhoneContent}
                placeholder="+905551234567"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          )}

          {writeType === 'mime' && (
            <View>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>MIME Türü:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={mimeType}
                onChangeText={setMimeType}
                placeholder="application/json"
              />
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>MIME Payload Verisi (JSON/String):</Text>
              <TextInput
                style={[styles.input, { height: 80, backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                multiline
                value={mimeContent}
                onChangeText={setMimeContent}
              />
            </View>
          )}

          {/* Live Preview of NDEF Structure */}
          <View style={[styles.ndefPreviewBox, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NDEF Yapı Önizlemesi:</Text>
            <Text style={[styles.ndefPreviewCode, { color: theme.textPrimary }]}>
              Type: {writeType.toUpperCase()} | TNF: 0x01 | Size: ~
              {(writeType === 'text'
                ? textContent
                : writeType === 'url'
                ? urlContent
                : phoneContent
              ).length}{' '}
              Bytes
            </Text>
          </View>

          {opStatus === 'scanning_write' ? (
            <View style={styles.scanningBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.scanningText, { color: theme.primary }]}>{statusMessage}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: capability.isSupported ? theme.success : theme.textMuted, marginTop: spacing.md },
              ]}
              disabled={!capability.isSupported}
              onPress={handleWriteNfc}
            >
              <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>NFC Etiketine Yaz</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* TAB 3: READ HISTORY */}
      {activeTab === 'history' && (
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder, marginBottom: 32 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Okuma Geçmişi</Text>

          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Henüz okunan NFC kaydı bulunmuyor.</Text>
          ) : (
            history.map((msg, idx) => (
              <View key={idx} style={[styles.recordBox, { borderColor: theme.cardBorder }]}>
                <Text style={[styles.recordTypeTag, { color: theme.primary }]}>
                  {new Date(msg.timestamp).toLocaleTimeString()} - Tag #{msg.serialNumber || 'NFC'}
                </Text>
                {msg.records.map((r, rIdx) => (
                  <Text key={rIdx} style={[styles.recordContent, { color: theme.textPrimary }]}>
                    [{r.recordType}] {r.textData}
                  </Text>
                ))}
              </View>
            ))
          )}
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
    marginBottom: 12,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
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
    marginBottom: 8,
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
  scanningBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  readResultCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  readResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readResultTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  recordBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  recordTypeTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  recordContent: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  smallCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  smallCopyText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  writeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  writeTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  writeTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  ndefPreviewBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  ndefPreviewCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
