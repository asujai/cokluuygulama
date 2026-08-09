import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { VcfContact, BackupTab } from './types';
import { generateVcf, parseVcf, MOCK_CONTACTS_BACKUP } from './vcfService';

export const ContactsBackupTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  // State
  const [activeTab, setActiveTab] = useState<BackupTab>('export');
  const [contacts, setContacts] = useState<VcfContact[]>([]);
  const [importedContacts, setImportedContacts] = useState<VcfContact[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Confirmation
  const [confirmImportModalVisible, setConfirmImportModalVisible] = useState(false);
  const [isWritingNative, setIsWritingNative] = useState(false);
  const [rawVcfText, setRawVcfText] = useState('');
  const [vcfPreviewModalVisible, setVcfPreviewModalVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load Native Contacts
  const loadDeviceContacts = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        setHasPermission(false);
        setContacts([...MOCK_CONTACTS_BACKUP]);
        setIsLoading(false);
        return;
      }

      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.Company,
            Contacts.Fields.JobTitle,
            Contacts.Fields.Note,
          ],
        });

        if (data && data.length > 0) {
          const parsed: VcfContact[] = data.map((c, i) => ({
            id: c.id || `native-${i}`,
            formattedName: c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Adsız Kişi',
            firstName: c.firstName,
            lastName: c.lastName,
            phoneNumbers: (c.phoneNumbers || []).map((p) => ({
              type: p.label || 'CELL',
              number: p.number || '',
            })).filter((p) => p.number),
            emails: (c.emails || []).map((e) => ({
              type: e.label || 'WORK',
              email: e.email || '',
            })).filter((e) => e.email),
            organization: c.company,
            jobTitle: c.jobTitle,
            note: c.note,
            selected: true,
          }));
          setContacts(parsed);
        } else {
          setContacts([...MOCK_CONTACTS_BACKUP]);
        }
      } else {
        setHasPermission(false);
        setContacts([...MOCK_CONTACTS_BACKUP]);
      }
    } catch (err) {
      setHasPermission(false);
      setContacts([...MOCK_CONTACTS_BACKUP]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeviceContacts();
  }, []);

  // Multi Selection Handlers
  const handleToggleSelectAll = (select: boolean) => {
    if (activeTab === 'export') {
      setContacts((prev) => prev.map((c) => ({ ...c, selected: select })));
    } else {
      setImportedContacts((prev) => prev.map((c) => ({ ...c, selected: select })));
    }
  };

  const handleToggleContact = (id: string) => {
    if (activeTab === 'export') {
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
    } else {
      setImportedContacts((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
    }
  };

  const filteredContacts = useMemo(() => {
    const list = activeTab === 'export' ? contacts : importedContacts;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) => {
      const matchName = c.formattedName.toLowerCase().includes(q);
      const matchOrg = c.organization?.toLowerCase().includes(q);
      const matchPhone = c.phoneNumbers.some((p) => p.number.includes(q));
      const matchEmail = c.emails.some((e) => e.email.toLowerCase().includes(q));
      return matchName || matchOrg || matchPhone || matchEmail;
    });
  }, [contacts, importedContacts, activeTab, searchQuery]);

  const selectedCount = useMemo(() => {
    const list = activeTab === 'export' ? contacts : importedContacts;
    return list.filter((c) => c.selected).length;
  }, [contacts, importedContacts, activeTab]);

  // Export Handler
  const handleExportVcf = async () => {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) {
      Alert.alert('Uyarı', 'Lütfen dışa aktarılacak en az bir kişi seçin.');
      return;
    }

    const vcfString = generateVcf(selected);

    if (Platform.OS === 'web') {
      const blob = new Blob([vcfString], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_backup_${new Date().toISOString().slice(0, 10)}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`${selected.length} kişi VCF dosyası olarak indirildi!`);
    } else {
      const cacheUri = FileSystem.Paths.cache.uri;
      const fileUri = `${cacheUri.endsWith('/') ? cacheUri : `${cacheUri}/`}contacts_backup.vcf`;
      await FileSystem.writeAsStringAsync(fileUri, vcfString);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        showToast('VCF dosyası hazırlandı ve kaydedildi!');
      }
    }
  };

  const handleCopyVcf = async () => {
    const selected = (activeTab === 'export' ? contacts : importedContacts).filter((c) => c.selected);
    if (selected.length === 0) {
      Alert.alert('Uyarı', 'Seçili kişi yok.');
      return;
    }
    const vcfString = generateVcf(selected);
    await Clipboard.setStringAsync(vcfString);
    showToast('VCF metni panoya kopyalandı!');
  };

  // Import VCF Handlers
  const handlePickVcfFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const fileUri = res.assets[0].uri;
        let content = '';

        if (Platform.OS === 'web') {
          const resp = await fetch(fileUri);
          content = await resp.text();
        } else {
          content = await FileSystem.readAsStringAsync(fileUri);
        }

        const parsed = parseVcf(content);
        if (parsed.length === 0) {
          Alert.alert('Hata', 'VCF dosyasında geçerli kişi kaydı bulunamadı.');
        } else {
          setImportedContacts(parsed);
          setActiveTab('import');
          showToast(`${parsed.length} kişi VCF dosyasından okundu!`);
        }
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'VCF dosyası okunamadı.');
    }
  };

  const handleParseRawText = () => {
    if (!rawVcfText.trim()) {
      Alert.alert('Hata', 'Lütfen VCF metnini girin.');
      return;
    }
    const parsed = parseVcf(rawVcfText);
    if (parsed.length === 0) {
      Alert.alert('Hata', 'Girdi içinde vCard kaydı bulunamadı.');
      return;
    }
    setImportedContacts(parsed);
    setVcfPreviewModalVisible(false);
    setRawVcfText('');
    setActiveTab('import');
    showToast(`${parsed.length} kişi içe aktarma önizlemesine eklendi!`);
  };

  // Explicit User Confirmation Before Native Write
  const handleOpenConfirmNativeImport = () => {
    const selected = importedContacts.filter((c) => c.selected);
    if (selected.length === 0) {
      Alert.alert('Uyarı', 'Lütfen rehbere eklenecek kişileri seçin.');
      return;
    }
    setConfirmImportModalVisible(true);
  };

  const handleExecuteNativeWrite = async () => {
    const selected = importedContacts.filter((c) => c.selected);
    if (selected.length === 0) return;

    if (Platform.OS === 'web' || !hasPermission) {
      setConfirmImportModalVisible(false);
      Alert.alert(
        'Platform Bilgisi',
        'Cihaz rehberine doğrudan kişi ekleme yalnızca yerel mobil uygulamada desteklenir. Web ortamında VCF dosyasını indirerek rehberinize aktarabilirsiniz.'
      );
      return;
    }

    setIsWritingNative(true);
    let successCount = 0;

    try {
      for (const c of selected) {
        const contactData: Contacts.CreateContactRecord = {
          givenName: c.firstName || c.formattedName,
          familyName: c.lastName || '',
          company: c.organization || '',
          jobTitle: c.jobTitle || '',
          note: c.note || '',
          phones: c.phoneNumbers.map((p) => ({
            label: p.type || 'mobile',
            number: p.number,
          })),
          emails: c.emails.map((e) => ({
            label: e.type || 'work',
            address: e.email,
          })),
        };

        await Contacts.Contact.create(contactData);
        successCount++;
      }

      showToast(`${successCount} kişi cihaz rehberine eklendi!`);
      loadDeviceContacts(); // Refresh list
    } catch (err: any) {
      Alert.alert('Yazma Hatası', err?.message || 'Kişiler eklenirken hata oluştu.');
    } finally {
      setIsWritingNative(false);
      setConfirmImportModalVisible(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {toastMessage && (
        <View style={[styles.toast, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
          <Text style={[typography.bodyMedium, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Permission Status Banner */}
      <View
        style={[
          styles.permissionBanner,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: spacing.sm,
            marginBottom: spacing.md,
          },
        ]}
      >
        <Ionicons
          name={hasPermission ? 'checkmark-circle' : 'information-circle'}
          size={20}
          color={hasPermission ? theme.primary : theme.textSecondary}
        />
        <Text style={[typography.bodySmall, { color: theme.textSecondary, flex: 1, marginLeft: spacing.xs }]}>
          {hasPermission
            ? 'Cihaz Rehber İzni Aktif'
            : 'Mobil cihaz rehber izni olmadan veya web ortamında örnek veri ve VCF motoru aktiftir.'}
        </Text>
      </View>

      {/* Main Mode Tabs */}
      <View
        style={[
          styles.tabsContainer,
          {
            backgroundColor: theme.surfaceVariant,
            borderRadius: borderRadius.lg,
            padding: spacing.xs,
            marginBottom: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'export' && { backgroundColor: theme.surface, borderRadius: borderRadius.md },
          ]}
          onPress={() => setActiveTab('export')}
        >
          <Ionicons
            name="download-outline"
            size={18}
            color={activeTab === 'export' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              { color: activeTab === 'export' ? theme.primary : theme.textSecondary, marginLeft: 4 },
            ]}
          >
            Yedekle / Dışa Aktar ({contacts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'import' && { backgroundColor: theme.surface, borderRadius: borderRadius.md },
          ]}
          onPress={() => setActiveTab('import')}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={18}
            color={activeTab === 'import' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              typography.labelMedium,
              { color: activeTab === 'import' ? theme.primary : theme.textSecondary, marginLeft: 4 },
            ]}
          >
            İçe Aktar & Önizle ({importedContacts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Top Action & Search Bar */}
      <View
        style={[
          styles.cardPanel,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.xl,
            padding: spacing.md,
            marginBottom: spacing.md,
          },
        ]}
      >
        {activeTab === 'export' ? (
          <View>
            <View style={styles.tabHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>Rehber Yedekleme</Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Kişilerinizi seçin ve standart .VCF vCard dosyası olarak dışa aktarın.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                onPress={handleExportVcf}
              >
                <Ionicons name="download-outline" size={18} color={theme.onPrimary} />
                <Text style={[typography.labelMedium, { color: theme.onPrimary, marginLeft: 4 }]}>
                  VCF İndir ({selectedCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.tabHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>VCF İçe Aktarma & Önizleme</Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  VCF dosyası yükleyin, önizleyin ve onay ile rehbere kaydedin.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                  onPress={handlePickVcfFile}
                >
                  <Ionicons name="folder-open-outline" size={18} color={theme.onPrimary} />
                  <Text style={[typography.labelMedium, { color: theme.onPrimary, marginLeft: 4 }]}>VCF Seç</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                  ]}
                  onPress={() => setVcfPreviewModalVisible(true)}
                >
                  <Ionicons name="code-working-outline" size={18} color={theme.textPrimary} />
                  <Text style={[typography.labelMedium, { color: theme.textPrimary, marginLeft: 4 }]}>Metin</Text>
                </TouchableOpacity>
              </View>
            </View>

            {importedContacts.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.nativeWriteBtn,
                  { backgroundColor: theme.primary, borderRadius: borderRadius.md, marginTop: spacing.sm },
                ]}
                onPress={handleOpenConfirmNativeImport}
              >
                <Ionicons name="person-add-outline" size={18} color={theme.onPrimary} />
                <Text style={[typography.labelLarge, { color: theme.onPrimary, marginLeft: spacing.xs }]}>
                  Seçilen {selectedCount} Kişiyi Rehbere Ekle...
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Multi-Selection Control Bar */}
        <View style={[styles.selectControlBar, { marginTop: spacing.md }]}>
          <TouchableOpacity
            style={[styles.smallChipBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm }]}
            onPress={() => handleToggleSelectAll(true)}
          >
            <Ionicons name="checkmark-done-outline" size={16} color={theme.textPrimary} />
            <Text style={[typography.labelSmall, { color: theme.textPrimary, marginLeft: 4 }]}>Tümünü Seç</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.smallChipBtn,
              { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm, marginLeft: spacing.xs },
            ]}
            onPress={() => handleToggleSelectAll(false)}
          >
            <Ionicons name="close-circle-outline" size={16} color={theme.textPrimary} />
            <Text style={[typography.labelSmall, { color: theme.textPrimary, marginLeft: 4 }]}>Tümünü Kaldır</Text>
          </TouchableOpacity>

          <Text style={[typography.labelSmall, { color: theme.textSecondary, marginLeft: 'auto' }]}>
            Seçili: {selectedCount} / {activeTab === 'export' ? contacts.length : importedContacts.length}
          </Text>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.surfaceVariant,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.sm,
              marginTop: spacing.sm,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary, marginLeft: spacing.xs }]}
            placeholder="İsim, telefon, e-posta veya şirket ara..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Contacts List */}
      {isLoading ? (
        <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 20 }} />
      ) : filteredContacts.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.lg,
              padding: spacing.xl,
              alignItems: 'center',
            },
          ]}
        >
          <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
          <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {activeTab === 'export'
              ? 'Gösterilecek kişi bulunamadı.'
              : 'Henüz VCF dosyası aktarılmadı. "VCF Seç" butonuna basarak rehber listenizi önizleyebilirsiniz.'}
          </Text>
        </View>
      ) : (
        <View style={styles.contactsList}>
          {filteredContacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={[
                styles.contactCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: contact.selected ? theme.primary : theme.cardBorder,
                  borderWidth: contact.selected ? 1.5 : 1,
                  borderRadius: borderRadius.lg,
                  padding: spacing.sm,
                  marginBottom: spacing.xs,
                },
              ]}
              onPress={() => handleToggleContact(contact.id)}
            >
              <View style={styles.contactRow}>
                <Ionicons
                  name={contact.selected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={contact.selected ? theme.primary : theme.textSecondary}
                />

                <View
                  style={[
                    styles.avatarBox,
                    { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.full, marginLeft: spacing.sm },
                  ]}
                >
                  <Text style={[typography.labelMedium, { color: theme.onPrimaryContainer, fontWeight: 'bold' }]}>
                    {contact.formattedName.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>{contact.formattedName}</Text>
                  {contact.phoneNumbers.length > 0 && (
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      📞 {contact.phoneNumbers[0].number}
                    </Text>
                  )}
                  {contact.emails.length > 0 && (
                    <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                      ✉️ {contact.emails[0].email}
                    </Text>
                  )}
                  {contact.organization && (
                    <Text style={[typography.labelSmall, { color: theme.primary }]}>
                      🏢 {contact.organization}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Explicit Confirmation Modal Before Native Contact Creation */}
      <Modal visible={confirmImportModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderRadius: borderRadius.xl }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark-outline" size={32} color={theme.primary} />
              <Text style={[typography.titleMedium, { color: theme.textPrimary, marginLeft: spacing.xs }]}>
                Rehbere Ekleme Onayı
              </Text>
            </View>

            <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginTop: spacing.sm, lineHeight: 22 }]}>
              Seçmiş olduğunuz <Text style={{ fontWeight: 'bold', color: theme.primary }}>{selectedCount}</Text> adet kişi cihazınızın adres defterine aktarılacaktır.
            </Text>

            <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: spacing.xs }]}>
              Bu işlem cihazınızda yeni kişi kayıtları oluşturur ve sessiz yazma yapılmaz.
            </Text>

            {isWritingNative ? (
              <ActivityIndicator color={theme.primary} size="large" style={{ marginVertical: 20 }} />
            ) : (
              <View style={[styles.modalActionRow, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
                  onPress={() => setConfirmImportModalVisible(false)}
                >
                  <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>İptal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                  onPress={handleExecuteNativeWrite}
                >
                  <Text style={[typography.labelMedium, { color: theme.onPrimary }]}>Onayla ve Rehbere Ekle</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Raw VCF Text Import Modal */}
      <Modal visible={vcfPreviewModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderRadius: borderRadius.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>Metinden VCF Yükle</Text>
              <TouchableOpacity onPress={() => setVcfPreviewModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.surfaceVariant,
                  color: theme.textPrimary,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                },
              ]}
              multiline
              numberOfLines={8}
              placeholder="BEGIN:VCARD\nVERSION:3.0\nFN:Ahmet Yilmaz\nTEL:+905321112233\nEND:VCARD"
              placeholderTextColor={theme.textSecondary}
              value={rawVcfText}
              onChangeText={setRawVcfText}
            />

            <View style={[styles.modalActionRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md }]}
                onPress={() => setVcfPreviewModalVisible(false)}
              >
                <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
                onPress={handleParseRawText}
              >
                <Text style={[typography.labelMedium, { color: theme.onPrimary }]}>Ayrıştır</Text>
              </TouchableOpacity>
            </View>
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
  content: {
    paddingBottom: 40,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cardPanel: {
    borderWidth: 1,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nativeWriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  selectControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  emptyCard: {
    borderWidth: 1,
    marginTop: 20,
  },
  contactsList: {},
  contactCard: {},
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  textArea: {
    textAlignVertical: 'top',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
