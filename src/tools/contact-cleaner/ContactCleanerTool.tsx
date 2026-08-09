import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useTheme } from '../../core/theme';
import {
  ContactItem,
  DuplicateGroup,
  MOCK_CONTACTS,
  groupDuplicatePhones,
  groupDuplicateEmails,
  groupDuplicateNames,
  groupIncompleteContacts,
  mergeContacts,
} from './contactUtils';

type ActiveTab = 'phone' | 'email' | 'name' | 'incomplete';

export const ContactCleanerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [activeTab, setActiveTab] = useState<ActiveTab>('phone');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWebOrMockMode, setIsWebOrMockMode] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal confirmation state for deletion
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [targetContactIds, setTargetContactIds] = useState<string[]>([]);
  const [deleteModalTitle, setDeleteModalTitle] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        setIsWebOrMockMode(true);
        setContacts([...MOCK_CONTACTS]);
        setIsLoading(false);
        return;
      }

      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.Company,
          ],
        });

        if (data && data.length > 0) {
          const parsed: ContactItem[] = data.map((c) => ({
            id: c.id || `contact-${Math.random()}`,
            name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Adsız Kişi',
            firstName: c.firstName,
            lastName: c.lastName,
            phoneNumbers: (c.phoneNumbers || []).map((p) => p.number).filter(Boolean) as string[],
            emails: (c.emails || []).map((e) => e.email).filter(Boolean) as string[],
            company: c.company,
          }));
          setContacts(parsed);
          setIsWebOrMockMode(false);
        } else {
          setIsWebOrMockMode(true);
          setContacts([...MOCK_CONTACTS]);
        }
      } else {
        setIsWebOrMockMode(true);
        setContacts([...MOCK_CONTACTS]);
      }
    } catch (error) {
      setIsWebOrMockMode(true);
      setContacts([...MOCK_CONTACTS]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // Compute duplicate groups
  const phoneGroups = useMemo(() => groupDuplicatePhones(contacts), [contacts]);
  const emailGroups = useMemo(() => groupDuplicateEmails(contacts), [contacts]);
  const nameGroups = useMemo(() => groupDuplicateNames(contacts), [contacts]);
  const incompleteGroups = useMemo(() => groupIncompleteContacts(contacts), [contacts]);

  const activeGroups = useMemo(() => {
    switch (activeTab) {
      case 'phone':
        return phoneGroups;
      case 'email':
        return emailGroups;
      case 'name':
        return nameGroups;
      case 'incomplete':
        return incompleteGroups;
      default:
        return [];
    }
  }, [activeTab, phoneGroups, emailGroups, nameGroups, incompleteGroups]);

  const totalDuplicates = phoneGroups.length + emailGroups.length + nameGroups.length;

  // Merge Handler
  const handleMergeGroup = (group: DuplicateGroup) => {
    try {
      const merged = mergeContacts(group.contacts);
      const groupIds = new Set(group.contacts.map((c) => c.id));

      // Replace merged contacts in state with unified single contact
      const updated = contacts.filter((c) => !groupIds.has(c.id));
      updated.push(merged);
      setContacts(updated);

      showToast(`'${merged.name}' için mükerrer kayıtlar birleştirildi.`);
    } catch (err) {
      showToast('Birleştirme sırasında hata oluştu.');
    }
  };

  // Delete Handler Request
  const promptDeleteContacts = (ids: string[], title: string) => {
    setTargetContactIds(ids);
    setDeleteModalTitle(title);
    setDeleteModalVisible(true);
  };

  // Confirmed Delete Execution
  const confirmDeleteContacts = async () => {
    setDeleteModalVisible(false);
    if (targetContactIds.length === 0) return;

    try {
      if (!isWebOrMockMode && Platform.OS !== 'web') {
        for (const id of targetContactIds) {
          try {
            await Contacts.removeContactAsync(id);
          } catch {
            // ignore individual native failure
          }
        }
      }

      const idSet = new Set(targetContactIds);
      setContacts((prev) => prev.filter((c) => !idSet.has(c.id)));
      showToast(`${targetContactIds.length} kişi rehberden silindi.`);
    } catch (error) {
      showToast('Silme işlemi tamamlanamadı.');
    } finally {
      setTargetContactIds([]);
    }
  };

  const handleResetMock = () => {
    setContacts([...MOCK_CONTACTS]);
    showToast('Örnek rehber listesi sıfırlandı.');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.lg }]}
    >
      {/* Toast */}
      {toastMessage && (
        <View style={[styles.toast, { backgroundColor: theme.primary, borderRadius: borderRadius.sm }]}>
          <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
          <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: spacing.xs }]}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Header Banner for Web/Mock Mode */}
      {isWebOrMockMode && (
        <View
          style={[
            styles.mockBanner,
            {
              backgroundColor: theme.surfaceVariant,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.bannerRow}>
            <Ionicons name="desktop-outline" size={20} color={theme.primary} />
            <Text style={[typography.labelLarge, { color: theme.textPrimary, marginLeft: spacing.xs, flex: 1 }]}>
              Web / Simülasyon Modu
            </Text>
            <TouchableOpacity
              onPress={handleResetMock}
              style={[styles.resetBtn, { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.xs }]}
            >
              <Text style={[typography.labelSmall, { color: theme.onPrimaryContainer }]}>Sıfırla</Text>
            </TouchableOpacity>
          </View>
          <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: spacing.xxs }]}>
            Web ortamında olduğunuz için deterministik örnek Türkçe rehber kişileri üzerinde güvenle test yapabilirsiniz.
          </Text>
        </View>
      )}

      {/* Summary Cards Grid */}
      <View style={styles.summaryGrid}>
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Toplam Kişi</Text>
          <Text style={[typography.titleLarge, { color: theme.primary, marginTop: spacing.xxs }]}>
            {contacts.length}
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Mükerrer Gruplar</Text>
          <Text style={[typography.titleLarge, { color: theme.error, marginTop: spacing.xxs }]}>
            {totalDuplicates}
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Eksik Kişiler</Text>
          <Text style={[typography.titleLarge, { color: theme.accent, marginTop: spacing.xxs }]}>
            {incompleteGroups.length > 0 ? incompleteGroups[0].contacts.length : 0}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { marginTop: spacing.lg }]}>
        <TabButton
          label={`Telefon (${phoneGroups.length})`}
          active={activeTab === 'phone'}
          onPress={() => setActiveTab('phone')}
          theme={theme}
          borderRadius={borderRadius}
          typography={typography}
        />
        <TabButton
          label={`E-posta (${emailGroups.length})`}
          active={activeTab === 'email'}
          onPress={() => setActiveTab('email')}
          theme={theme}
          borderRadius={borderRadius}
          typography={typography}
        />
        <TabButton
          label={`İsim (${nameGroups.length})`}
          active={activeTab === 'name'}
          onPress={() => setActiveTab('name')}
          theme={theme}
          borderRadius={borderRadius}
          typography={typography}
        />
        <TabButton
          label={`Eksik (${incompleteGroups.length > 0 ? incompleteGroups[0].contacts.length : 0})`}
          active={activeTab === 'incomplete'}
          onPress={() => setActiveTab('incomplete')}
          theme={theme}
          borderRadius={borderRadius}
          typography={typography}
        />
      </View>

      {/* Loading Indicator */}
      {isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[typography.bodyMedium, { color: theme.textSecondary, marginTop: spacing.sm }]}>
            Rehber taranıyor...
          </Text>
        </View>
      ) : (
        /* Group List */
        <View style={{ marginTop: spacing.md }}>
          {activeGroups.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                  borderRadius: borderRadius.md,
                  padding: spacing.xl,
                },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={48} color="#16A34A" />
              <Text style={[typography.titleMedium, { color: theme.textPrimary, marginTop: spacing.sm }]}>
                Temiz! Mükerrer Kayıt Bulunmadı
              </Text>
              <Text style={[typography.bodySmall, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                Bu kategoride herhangi bir tekrarlayan veya sorunlu kişi bulunamadı.
              </Text>
            </View>
          ) : (
            activeGroups.map((group) => (
              <View
                key={group.id}
                style={[
                  styles.groupCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                {/* Group Header */}
                <View style={styles.groupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleSmall, { color: theme.primary }]}>
                      {group.title}
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>
                      {group.contacts.length} adet kayıt
                    </Text>
                  </View>

                  {/* Group Action Buttons */}
                  <View style={styles.groupHeaderActions}>
                    {group.type !== 'incomplete' && (
                      <TouchableOpacity
                        onPress={() => handleMergeGroup(group)}
                        style={[
                          styles.actionChip,
                          { backgroundColor: theme.primaryContainer, borderRadius: borderRadius.xs },
                        ]}
                      >
                        <Ionicons name="git-merge-outline" size={14} color={theme.onPrimaryContainer} />
                        <Text style={[typography.labelSmall, { color: theme.onPrimaryContainer, marginLeft: 4 }]}>
                          Birleştir
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() =>
                        promptDeleteContacts(
                          group.contacts.slice(1).map((c) => c.id),
                          `Mükerrer ${group.contacts.length - 1} kaydı sil`
                        )
                      }
                      style={[
                        styles.actionChip,
                        { backgroundColor: theme.errorContainer, borderRadius: borderRadius.xs, marginLeft: spacing.xs },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.onErrorContainer} />
                      <Text style={[typography.labelSmall, { color: theme.onErrorContainer, marginLeft: 4 }]}>
                        Yedekleri Sil
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Contacts in Group */}
                <View style={[styles.contactsSubList, { marginTop: spacing.sm }]}>
                  {group.contacts.map((contact, idx) => (
                    <View
                      key={contact.id}
                      style={[
                        styles.contactRow,
                        {
                          backgroundColor: theme.surfaceVariant,
                          borderRadius: borderRadius.sm,
                          padding: spacing.sm,
                          marginTop: idx > 0 ? spacing.xs : 0,
                        },
                      ]}
                    >
                      <View style={styles.avatarBox}>
                        <Ionicons name="person-circle-outline" size={32} color={theme.primary} />
                      </View>

                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={[typography.labelLarge, { color: theme.textPrimary }]}>
                          {contact.name}
                        </Text>
                        {contact.phoneNumbers.length > 0 && (
                          <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                            Tel: {contact.phoneNumbers.join(', ')}
                          </Text>
                        )}
                        {contact.emails.length > 0 && (
                          <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                            E-posta: {contact.emails.join(', ')}
                          </Text>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => promptDeleteContacts([contact.id], `'${contact.name}' kişisini sil`)}
                        style={styles.singleDeleteBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surface,
                borderRadius: borderRadius.md,
                padding: spacing.lg,
              },
            ]}
          >
            <Ionicons name="warning-outline" size={40} color={theme.error} />
            <Text style={[typography.titleMedium, { color: theme.textPrimary, marginTop: spacing.sm }]}>
              Silme Onayı
            </Text>
            <Text style={[typography.bodyMedium, { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
              {deleteModalTitle} istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </Text>

            <View style={[styles.modalActions, { marginTop: spacing.lg }]}>
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.sm },
                ]}
              >
                <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmDeleteContacts}
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.error, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
                ]}
              >
                <Text style={[typography.labelMedium, { color: '#FFFFFF' }]}>Evet, Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const TabButton = ({ label, active, onPress, theme, borderRadius, typography }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.tabItem,
      {
        backgroundColor: active ? theme.primary : theme.surfaceVariant,
        borderRadius: borderRadius.sm,
      },
    ]}
  >
    <Text style={[typography.labelSmall, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  toast: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    elevation: 4,
  },
  mockBanner: {
    borderWidth: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  groupCard: {
    borderWidth: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  contactsSubList: {},
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleDeleteBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    elevation: 5,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
