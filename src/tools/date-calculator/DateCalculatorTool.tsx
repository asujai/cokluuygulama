import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../core/theme';
import {
  TURKISH_MONTHS,
  formatDateTurkish,
  calculateDateDifference,
  addSubtractDate,
  calculateDetailedAge,
  loadSavedCountdowns,
  saveSavedCountdowns,
} from './dateMath';
import { SavedCountdown } from './types';

export const DateCalculatorTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography, isDark } = useTheme();

  // Active Tab: 'diff' | 'math' | 'countdown' | 'age'
  const [activeTab, setActiveTab] = useState<'diff' | 'math' | 'countdown' | 'age'>('diff');

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  // ==========================================
  // TAB 1: DATE DIFFERENCE STATE
  // ==========================================
  const now = new Date();
  const [startYear, setStartYear] = useState(now.getFullYear().toString());
  const [startMonth, setStartMonth] = useState((now.getMonth() + 1).toString());
  const [startDay, setStartDay] = useState(now.getDate().toString());

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [endYear, setEndYear] = useState(nextMonthDate.getFullYear().toString());
  const [endMonth, setEndMonth] = useState((nextMonthDate.getMonth() + 1).toString());
  const [endDay, setEndDay] = useState(nextMonthDate.getDate().toString());

  const [includeEndDate, setIncludeEndDate] = useState(false);
  const [excludeHolidays, setExcludeHolidays] = useState(false);

  const startDateObj = useMemo(() => {
    const y = parseInt(startYear, 10) || now.getFullYear();
    const m = Math.max(1, Math.min(12, parseInt(startMonth, 10) || 1)) - 1;
    const d = Math.max(1, Math.min(31, parseInt(startDay, 10) || 1));
    return new Date(y, m, d);
  }, [startYear, startMonth, startDay, now]);

  const endDateObj = useMemo(() => {
    const y = parseInt(endYear, 10) || now.getFullYear();
    const m = Math.max(1, Math.min(12, parseInt(endMonth, 10) || 1)) - 1;
    const d = Math.max(1, Math.min(31, parseInt(endDay, 10) || 1));
    return new Date(y, m, d);
  }, [endYear, endMonth, endDay, now]);

  const diffResult = useMemo(() => {
    return calculateDateDifference(startDateObj, endDateObj, includeEndDate, excludeHolidays);
  }, [startDateObj, endDateObj, includeEndDate, excludeHolidays]);

  // ==========================================
  // TAB 2: ADD / SUBTRACT DATE STATE
  // ==========================================
  const [mathBaseYear, setMathBaseYear] = useState(now.getFullYear().toString());
  const [mathBaseMonth, setMathBaseMonth] = useState((now.getMonth() + 1).toString());
  const [mathBaseDay, setMathBaseDay] = useState(now.getDate().toString());
  const [mathOperation, setMathOperation] = useState<'add' | 'subtract'>('add');
  const [addYears, setAddYears] = useState('0');
  const [addMonths, setAddMonths] = useState('0');
  const [addWeeks, setAddWeeks] = useState('0');
  const [addDays, setAddDays] = useState('30');

  const mathBaseDateObj = useMemo(() => {
    const y = parseInt(mathBaseYear, 10) || now.getFullYear();
    const m = Math.max(1, Math.min(12, parseInt(mathBaseMonth, 10) || 1)) - 1;
    const d = Math.max(1, Math.min(31, parseInt(mathBaseDay, 10) || 1));
    return new Date(y, m, d);
  }, [mathBaseYear, mathBaseMonth, mathBaseDay, now]);

  const mathResult = useMemo(() => {
    const y = parseInt(addYears, 10) || 0;
    const m = parseInt(addMonths, 10) || 0;
    const w = parseInt(addWeeks, 10) || 0;
    const d = parseInt(addDays, 10) || 0;
    return addSubtractDate(mathBaseDateObj, mathOperation, y, m, w, d);
  }, [mathBaseDateObj, mathOperation, addYears, addMonths, addWeeks, addDays]);

  // ==========================================
  // TAB 3: LIVE COUNTDOWN STATE
  // ==========================================
  const [savedCountdowns, setSavedCountdowns] = useState<SavedCountdown[]>([]);
  const [activeCountdownId, setActiveCountdownId] = useState<string>('ny-2027');
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());
  const [addCountdownModal, setAddCountdownModal] = useState(false);
  const [newCdTitle, setNewCdTitle] = useState('');
  const [newCdYear, setNewCdYear] = useState('2027');
  const [newCdMonth, setNewCdMonth] = useState('1');
  const [newCdDay, setNewCdDay] = useState('1');
  const [newCdEmoji, setNewCdEmoji] = useState('🎯');

  useEffect(() => {
    loadSavedCountdowns().then((list) => {
      setSavedCountdowns(list);
      if (list.length > 0) setActiveCountdownId(list[0].id);
    });
  }, []);

  // Tick live countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeCountdown = useMemo(() => {
    return savedCountdowns.find((c) => c.id === activeCountdownId) || savedCountdowns[0];
  }, [savedCountdowns, activeCountdownId]);

  const countdownBreakdown = useMemo(() => {
    if (!activeCountdown) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: false };
    const targetMs = new Date(activeCountdown.targetDateIso).getTime();
    const diffMs = targetMs - currentTimestamp;

    if (diffMs <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds, isPassed: false };
  }, [activeCountdown, currentTimestamp]);

  const handleSaveNewCountdown = async () => {
    if (!newCdTitle.trim()) return;
    const y = parseInt(newCdYear, 10) || 2027;
    const m = Math.max(1, Math.min(12, parseInt(newCdMonth, 10) || 1)) - 1;
    const d = Math.max(1, Math.min(31, parseInt(newCdDay, 10) || 1));
    const target = new Date(y, m, d);

    const item: SavedCountdown = {
      id: Date.now().toString(),
      title: newCdTitle.trim(),
      targetDateIso: target.toISOString(),
      emoji: newCdEmoji || '📅',
    };

    const updated = [item, ...savedCountdowns];
    setSavedCountdowns(updated);
    setActiveCountdownId(item.id);
    await saveSavedCountdowns(updated);
    setAddCountdownModal(false);
    setNewCdTitle('');
  };

  const handleDeleteCountdown = async (id: string) => {
    triggerHaptic();
    const updated = savedCountdowns.filter((c) => c.id !== id);
    setSavedCountdowns(updated);
    if (activeCountdownId === id && updated.length > 0) {
      setActiveCountdownId(updated[0].id);
    }
    await saveSavedCountdowns(updated);
  };

  // ==========================================
  // TAB 4: AGE CALCULATOR STATE
  // ==========================================
  const [birthYear, setBirthYear] = useState('1998');
  const [birthMonth, setBirthMonth] = useState('5');
  const [birthDay, setBirthDay] = useState('19');

  const birthDateObj = useMemo(() => {
    const y = parseInt(birthYear, 10) || 1998;
    const m = Math.max(1, Math.min(12, parseInt(birthMonth, 10) || 1)) - 1;
    const d = Math.max(1, Math.min(31, parseInt(birthDay, 10) || 1));
    return new Date(y, m, d);
  }, [birthYear, birthMonth, birthDay]);

  const ageResult = useMemo(() => {
    return calculateDetailedAge(birthDateObj);
  }, [birthDateObj]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={[typography.titleLarge, { color: theme.textPrimary }]}>
          Tarih & Gün Hesaplayıcı
        </Text>
        <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
          Tarih farkı, iş günleri, süre ekleme, geri sayım ve yaş analizi
        </Text>
      </View>

      {/* 4 Tabs Menu */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {[
          { key: 'diff', title: 'Tarih Farkı', icon: 'calendar-outline' },
          { key: 'math', title: 'Ekle / Çıkar', icon: 'calculator-outline' },
          { key: 'countdown', title: 'Geri Sayım', icon: 'hourglass-outline' },
          { key: 'age', title: 'Yaş & Hayat', icon: 'heart-outline' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabBtn,
              {
                backgroundColor:
                  activeTab === tab.key ? theme.primary : theme.surface,
                borderColor:
                  activeTab === tab.key ? theme.primary : theme.cardBorder,
              },
            ]}
            onPress={() => {
              triggerHaptic();
              setActiveTab(tab.key as any);
            }}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#FFFFFF' : theme.textSecondary}
            />
            <Text
              style={[
                typography.labelMedium,
                {
                  color: activeTab === tab.key ? '#FFFFFF' : theme.textPrimary,
                  marginLeft: 6,
                },
              ]}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ======================================================= */}
      {/* TAB 1: DATE DIFFERENCE                                  */}
      {/* ======================================================= */}
      {activeTab === 'diff' && (
        <View>
          {/* Start Date Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar" size={18} color={theme.primary} />
              <Text style={[typography.titleSmall, { color: theme.textPrimary, marginLeft: 6 }]}>
                Başlangıç Tarihi: {formatDateTurkish(startDateObj)}
              </Text>
            </View>
            <View style={styles.dateInputsRow}>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Gün</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={startDay}
                  onChangeText={setStartDay}
                  maxLength={2}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Ay (1-12)</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={startMonth}
                  onChangeText={setStartMonth}
                  maxLength={2}
                />
              </View>
              <View style={[styles.inputCol, { flex: 1.5 }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Yıl</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={startYear}
                  onChangeText={setStartYear}
                  maxLength={4}
                />
              </View>
            </View>

            {/* Quick shortcuts */}
            <View style={styles.shortcutRow}>
              <TouchableOpacity
                style={[styles.shortcutChip, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => {
                  const t = new Date();
                  setStartYear(t.getFullYear().toString());
                  setStartMonth((t.getMonth() + 1).toString());
                  setStartDay(t.getDate().toString());
                }}
              >
                <Text style={[typography.labelSmall, { color: theme.textPrimary }]}>Bugün</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shortcutChip, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => {
                  const t = new Date(now.getFullYear(), 0, 1);
                  setStartYear(t.getFullYear().toString());
                  setStartMonth('1');
                  setStartDay('1');
                }}
              >
                <Text style={[typography.labelSmall, { color: theme.textPrimary }]}>Yıl Başı (1 Oca)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* End Date Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={18} color={theme.accent} />
              <Text style={[typography.titleSmall, { color: theme.textPrimary, marginLeft: 6 }]}>
                Bitiş Tarihi: {formatDateTurkish(endDateObj)}
              </Text>
            </View>
            <View style={styles.dateInputsRow}>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Gün</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={endDay}
                  onChangeText={setEndDay}
                  maxLength={2}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Ay (1-12)</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={endMonth}
                  onChangeText={setEndMonth}
                  maxLength={2}
                />
              </View>
              <View style={[styles.inputCol, { flex: 1.5 }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Yıl</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={endYear}
                  onChangeText={setEndYear}
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Inclusion & Holiday Toggles */}
          <View style={[styles.optionsRow, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                triggerHaptic();
                setIncludeEndDate(!includeEndDate);
              }}
            >
              <Ionicons
                name={includeEndDate ? 'checkbox' : 'square-outline'}
                size={20}
                color={includeEndDate ? theme.primary : theme.textMuted}
              />
              <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginLeft: 8 }]}>
                Bitiş gününü hesaba dahil et (+1 gün)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleRow, { marginTop: 10 }]}
              onPress={() => {
                triggerHaptic();
                setExcludeHolidays(!excludeHolidays);
              }}
            >
              <Ionicons
                name={excludeHolidays ? 'checkbox' : 'square-outline'}
                size={20}
                color={excludeHolidays ? theme.primary : theme.textMuted}
              />
              <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginLeft: 8 }]}>
                Resmi bayram ve tatilleri iş gününden düş
              </Text>
            </TouchableOpacity>
          </View>

          {/* Results Display */}
          <View style={[styles.resultMainCard, { backgroundColor: theme.primaryContainer }]}>
            <Text style={[typography.labelMedium, { color: theme.onPrimaryContainer }]}>
              TOPLAM GEÇEN SÜRE
            </Text>
            <Text style={[styles.mainDiffNumber, { color: theme.onPrimaryContainer }]}>
              {diffResult.totalDays} Gün
            </Text>
            <Text style={[typography.titleMedium, { color: theme.onPrimaryContainer, fontWeight: '700' }]}>
              {diffResult.years > 0 && `${diffResult.years} yıl `}
              {diffResult.months > 0 && `${diffResult.months} ay `}
              {diffResult.days} gün
            </Text>
          </View>

          {/* Stats Breakdown Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>HAFTA & GÜN</Text>
              <Text style={[typography.titleSmall, { color: theme.textPrimary, marginTop: 4 }]}>
                {diffResult.totalWeeks} Hafta {diffResult.remainingDays} Gün
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>İŞ GÜNLERİ</Text>
              <Text style={[typography.titleSmall, { color: '#10B981', marginTop: 4 }]}>
                {diffResult.businessDays} İş Günü
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>HAFTA SONLARI</Text>
              <Text style={[typography.titleSmall, { color: theme.warning, marginTop: 4 }]}>
                {diffResult.weekendDays} Gün
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>TOPLAM SAAT</Text>
              <Text style={[typography.titleSmall, { color: theme.textPrimary, marginTop: 4 }]}>
                {diffResult.totalHours.toLocaleString()} Saat
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ======================================================= */}
      {/* TAB 2: ADD / SUBTRACT TIME                              */}
      {/* ======================================================= */}
      {activeTab === 'math' && (
        <View>
          {/* Base Date Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: 8 }]}>
              Baz Tarih: {formatDateTurkish(mathBaseDateObj)}
            </Text>
            <View style={styles.dateInputsRow}>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Gün</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={mathBaseDay}
                  onChangeText={setMathBaseDay}
                  maxLength={2}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Ay (1-12)</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={mathBaseMonth}
                  onChangeText={setMathBaseMonth}
                  maxLength={2}
                />
              </View>
              <View style={[styles.inputCol, { flex: 1.5 }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Yıl</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={mathBaseYear}
                  onChangeText={setMathBaseYear}
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Operation Selector: Ekle (+) / Çıkar (-) */}
          <View style={[styles.mathOpRow, { backgroundColor: theme.surfaceVariant }]}>
            <TouchableOpacity
              style={[
                styles.mathOpBtn,
                mathOperation === 'add' && { backgroundColor: theme.primary },
              ]}
              onPress={() => {
                triggerHaptic();
                setMathOperation('add');
              }}
            >
              <Ionicons
                name="add-circle"
                size={18}
                color={mathOperation === 'add' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[
                  typography.labelLarge,
                  { color: mathOperation === 'add' ? '#FFFFFF' : theme.textSecondary, marginLeft: 6 },
                ]}
              >
                Süre Ekle (+)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mathOpBtn,
                mathOperation === 'subtract' && { backgroundColor: theme.error },
              ]}
              onPress={() => {
                triggerHaptic();
                setMathOperation('subtract');
              }}
            >
              <Ionicons
                name="remove-circle"
                size={18}
                color={mathOperation === 'subtract' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[
                  typography.labelLarge,
                  { color: mathOperation === 'subtract' ? '#FFFFFF' : theme.textSecondary, marginLeft: 6 },
                ]}
              >
                Süre Çıkar (-)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Duration Inputs: Years, Months, Weeks, Days */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
              EKLENECEK / ÇIKARILACAK MİKTAR
            </Text>
            <View style={styles.dateInputsRow}>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Yıl</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={addYears}
                  onChangeText={setAddYears}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Ay</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={addMonths}
                  onChangeText={setAddMonths}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Hafta</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={addWeeks}
                  onChangeText={setAddWeeks}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Gün</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={addDays}
                  onChangeText={setAddDays}
                />
              </View>
            </View>

            {/* Quick shortcuts */}
            <View style={styles.shortcutRow}>
              {['+7 Gün', '+15 Gün', '+30 Gün', '+90 Gün', '+1 Yıl'].map((lbl) => (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.shortcutChip, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => {
                    setAddYears(lbl.includes('Yıl') ? '1' : '0');
                    setAddMonths('0');
                    setAddWeeks('0');
                    setAddDays(
                      lbl.includes('7') ? '7' : lbl.includes('15') ? '15' : lbl.includes('30') ? '30' : lbl.includes('90') ? '90' : '0'
                    );
                  }}
                >
                  <Text style={[typography.labelSmall, { color: theme.textPrimary }]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Math Result Card */}
          <View
            style={[
              styles.resultMainCard,
              {
                backgroundColor: mathOperation === 'add' ? theme.primaryContainer : theme.errorContainer,
              },
            ]}
          >
            <Text
              style={[
                typography.labelMedium,
                { color: mathOperation === 'add' ? theme.onPrimaryContainer : theme.onErrorContainer },
              ]}
            >
              HESAPLANAN HEDEF TARİH
            </Text>
            <Text
              style={[
                styles.mainDiffNumber,
                { color: mathOperation === 'add' ? theme.onPrimaryContainer : theme.onErrorContainer, fontSize: 24, marginVertical: 6 },
              ]}
            >
              {mathResult.formattedDate}
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: mathOperation === 'add' ? theme.onPrimaryContainer : theme.onErrorContainer },
              ]}
            >
              Yılın {mathResult.dayOfYear}. günü • {mathResult.weekOfYear}. Hafta • {mathResult.isLeapYear ? 'Artık Yıl' : 'Normal Yıl'}
            </Text>
          </View>
        </View>
      )}

      {/* ======================================================= */}
      {/* TAB 3: LIVE EVENT COUNTDOWN                             */}
      {/* ======================================================= */}
      {activeTab === 'countdown' && (
        <View>
          {/* Saved Countdowns Scroll Row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedCdRow}
          >
            {savedCountdowns.map((cd) => (
              <TouchableOpacity
                key={cd.id}
                style={[
                  styles.savedCdChip,
                  {
                    backgroundColor:
                      activeCountdownId === cd.id ? theme.primary : theme.surface,
                    borderColor:
                      activeCountdownId === cd.id ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => {
                  triggerHaptic();
                  setActiveCountdownId(cd.id);
                }}
              >
                <Text style={{ fontSize: 16 }}>{cd.emoji || '🎯'}</Text>
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: activeCountdownId === cd.id ? '#FFFFFF' : theme.textPrimary,
                      marginLeft: 6,
                    },
                  ]}
                >
                  {cd.title}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.savedCdAddChip, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => setAddCountdownModal(true)}
            >
              <Ionicons name="add" size={18} color={theme.primary} />
              <Text style={[typography.labelMedium, { color: theme.primary, marginLeft: 4 }]}>
                Yeni Ekle
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Active Countdown Big Ticking Display */}
          {activeCountdown && (
            <View style={[styles.bigCountdownCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <View style={styles.countdownTitleRow}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>{activeCountdown.emoji}</Text>
                <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                  {activeCountdown.title}
                </Text>
              </View>
              <Text style={[typography.bodySmall, { color: theme.textSecondary, marginBottom: 16 }]}>
                Hedef: {formatDateTurkish(new Date(activeCountdown.targetDateIso))}
              </Text>

              {countdownBreakdown.isPassed ? (
                <View style={styles.passedBanner}>
                  <Text style={[typography.titleMedium, { color: '#10B981', fontWeight: '700' }]}>
                    🎉 Hedef Tarihe Ulaşıldı!
                  </Text>
                </View>
              ) : (
                <View style={styles.countdownBlocksRow}>
                  <View style={[styles.cdBlock, { backgroundColor: theme.surfaceVariant }]}>
                    <Text style={[styles.cdNumber, { color: theme.primary }]}>
                      {countdownBreakdown.days}
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>GÜN</Text>
                  </View>

                  <View style={[styles.cdBlock, { backgroundColor: theme.surfaceVariant }]}>
                    <Text style={[styles.cdNumber, { color: theme.primary }]}>
                      {countdownBreakdown.hours}
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>SAAT</Text>
                  </View>

                  <View style={[styles.cdBlock, { backgroundColor: theme.surfaceVariant }]}>
                    <Text style={[styles.cdNumber, { color: theme.primary }]}>
                      {countdownBreakdown.minutes}
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>DAKİKA</Text>
                  </View>

                  <View style={[styles.cdBlock, { backgroundColor: theme.surfaceVariant }]}>
                    <Text style={[styles.cdNumber, { color: '#EF4444' }]}>
                      {countdownBreakdown.seconds}
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>SANİYE</Text>
                  </View>
                </View>
              )}

              {/* Delete event button */}
              <TouchableOpacity
                style={styles.deleteCdBtn}
                onPress={() => handleDeleteCountdown(activeCountdown.id)}
              >
                <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                <Text style={[typography.labelSmall, { color: theme.textMuted, marginLeft: 4 }]}>
                  Bu Geri Sayımı Sil
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ======================================================= */}
      {/* TAB 4: DETAILED AGE & LIFE STATS                        */}
      {/* ======================================================= */}
      {activeTab === 'age' && (
        <View>
          {/* Birth Date Picker Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: 8 }]}>
              Doğum Tarihiniz: {formatDateTurkish(birthDateObj)}
            </Text>
            <View style={styles.dateInputsRow}>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Gün</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={birthDay}
                  onChangeText={setBirthDay}
                  maxLength={2}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Ay (1-12)</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={birthMonth}
                  onChangeText={setBirthMonth}
                  maxLength={2}
                />
              </View>
              <View style={[styles.inputCol, { flex: 1.5 }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Yıl</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={birthYear}
                  onChangeText={setBirthYear}
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Age Highlight Card */}
          <View style={[styles.resultMainCard, { backgroundColor: theme.primaryContainer }]}>
            <Text style={[typography.labelMedium, { color: theme.onPrimaryContainer }]}>
              NET YAŞINIZ
            </Text>
            <Text style={[styles.mainDiffNumber, { color: theme.onPrimaryContainer, fontSize: 32 }]}>
              {ageResult.years} Yaş
            </Text>
            <Text style={[typography.titleMedium, { color: theme.onPrimaryContainer, fontWeight: '600' }]}>
              {ageResult.months} Ay, {ageResult.days} Gün
            </Text>
          </View>

          {/* Next Birthday Banner */}
          <View style={[styles.birthdayCard, { backgroundColor: isDark ? '#14532D' : '#DCFCE7' }]}>
            <Ionicons name="gift" size={24} color="#16A34A" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[typography.titleSmall, { color: '#16A34A' }]}>
                Gelecek Doğum Günü: {ageResult.nextBirthdayDays} Gün Sonra
              </Text>
              <Text style={[typography.bodySmall, { color: '#15803D' }]}>
                {ageResult.nextBirthdayDateFormatted} ({ageResult.nextBirthdayDayName})
              </Text>
            </View>
          </View>

          {/* Astrological / Zodiac Signs */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
              BURÇ & ASTROLOJİ BİLGİLERİ
            </Text>
            <View style={styles.zodiacRow}>
              <View style={styles.zodiacBox}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>BATI BURCU</Text>
                <Text style={[typography.titleSmall, { color: theme.textPrimary, marginTop: 2 }]}>
                  {ageResult.zodiacSign}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Element: {ageResult.zodiacElement}
                </Text>
              </View>
              <View style={styles.zodiacBox}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>ÇİN BURCU</Text>
                <Text style={[typography.titleSmall, { color: theme.textPrimary, marginTop: 2 }]}>
                  {ageResult.chineseZodiac}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
                  Doğum Yılı: {birthYear}
                </Text>
              </View>
            </View>
          </View>

          {/* Lifetime Milestones Trivia */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 12 }]}>
              HAYAT İSTATİSTİKLERİ & DÖNÜM NOKTALARI
            </Text>
            <View style={styles.triviaList}>
              <View style={styles.triviaItem}>
                <Ionicons name="sunny-outline" size={18} color="#F59E0B" />
                <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginLeft: 8 }]}>
                  Toplam Yaşanılan Gün: <Text style={{ fontWeight: '700' }}>{ageResult.totalDays.toLocaleString()} Gün</Text>
                </Text>
              </View>

              <View style={styles.triviaItem}>
                <Ionicons name="heart" size={18} color="#EF4444" />
                <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginLeft: 8 }]}>
                  Tahmini Kalp Atışı: <Text style={{ fontWeight: '700' }}>~{ageResult.heartbeats.toLocaleString()} Kez</Text>
                </Text>
              </View>

              <View style={styles.triviaItem}>
                <Ionicons name="cloud-outline" size={18} color="#06B6D4" />
                <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginLeft: 8 }]}>
                  Tahmini Nefes Sayısı: <Text style={{ fontWeight: '700' }}>~{ageResult.breaths.toLocaleString()} Kez</Text>
                </Text>
              </View>

              <View style={styles.triviaItem}>
                <Ionicons name="bed-outline" size={18} color="#8B5CF6" />
                <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginLeft: 8 }]}>
                  Uykuda Geçen Süre: <Text style={{ fontWeight: '700' }}>~{ageResult.sleepYears} Yıl (~8 sa/gün)</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* MODAL: ADD COUNTDOWN */}
      <Modal visible={addCountdownModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                Yeni Geri Sayım Ekle
              </Text>
              <TouchableOpacity onPress={() => setAddCountdownModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: 12 }]}>
              Etkinlik Adı
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              placeholder="Örn: Yaz Tatili, Doğum Günü, Sınav"
              placeholderTextColor={theme.textMuted}
              value={newCdTitle}
              onChangeText={setNewCdTitle}
            />

            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: 12 }]}>
              Hedef Tarih
            </Text>
            <View style={styles.dateInputsRow}>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Gün</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={newCdDay}
                  onChangeText={setNewCdDay}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Ay</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={newCdMonth}
                  onChangeText={setNewCdMonth}
                />
              </View>
              <View style={[styles.inputCol, { flex: 1.5 }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Yıl</Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  value={newCdYear}
                  onChangeText={setNewCdYear}
                />
              </View>
            </View>

            <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: 12 }]}>
              Emoji İkonu
            </Text>
            <View style={styles.emojiRow}>
              {['🎯', '🎂', '🏖️', '✈️', '🎓', '💍', '🎄', '🏆'].map((em) => (
                <TouchableOpacity
                  key={em}
                  style={[
                    styles.emojiBtn,
                    newCdEmoji === em && { backgroundColor: theme.surfaceVariant, borderWidth: 1, borderColor: theme.primary },
                  ]}
                  onPress={() => setNewCdEmoji(em)}
                >
                  <Text style={{ fontSize: 22 }}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: theme.primary }]}
              onPress={handleSaveNewCountdown}
            >
              <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Geri Sayımı Kaydet</Text>
            </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBar: {
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputCol: {
    flex: 1,
  },
  inputBox: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  shortcutChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  optionsRow: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultMainCard: {
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  mainDiffNumber: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  mathOpRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  mathOpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  savedCdRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  savedCdChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  savedCdAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bigCountdownCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  countdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownBlocksRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  cdBlock: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 64,
  },
  cdNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  passedBanner: {
    padding: 16,
    alignItems: 'center',
  },
  deleteCdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  zodiacRow: {
    flexDirection: 'row',
    gap: 12,
  },
  zodiacBox: {
    flex: 1,
  },
  triviaList: {
    gap: 10,
  },
  triviaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    justifyContent: 'space-around',
  },
  emojiBtn: {
    padding: 6,
    borderRadius: 10,
  },
  modalSubmitBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
});
