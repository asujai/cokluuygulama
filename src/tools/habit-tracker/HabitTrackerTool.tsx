import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../core/theme';
import { Habit, FrequencyType, HabitStats } from './types';
import {
  formatDateKey,
  formatTurkishDate,
  getLastNDays,
  isHabitScheduledForDate,
  calculateHabitStats,
} from './streakCalculator';
import {
  getHabits,
  upsertHabit,
  toggleHabitCompletion,
  deleteHabit,
} from './habitStorage';

const HABIT_ICONS = [
  'water-outline',
  'fitness-outline',
  'book-outline',
  'code-slash-outline',
  'heart-outline',
  'walk-outline',
  'moon-outline',
  'nutrition-outline',
  'cafe-outline',
  'school-outline',
  'bicycle-outline',
  'sparkles-outline',
];

const HABIT_COLORS = [
  '#0284C7', // Sky Blue
  '#7C3AED', // Violet
  '#16A34A', // Green
  '#EA580C', // Orange
  '#E11D48', // Rose
  '#0D9488', // Teal
  '#D97706', // Amber
  '#4F46E5', // Indigo
];

export const HabitTrackerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(formatDateKey(new Date()));

  // Add Habit Modal
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newIcon, setNewIcon] = useState<string>(HABIT_ICONS[0]);
  const [newColor, setNewColor] = useState<string>(HABIT_COLORS[0]);
  const [newFrequency, setNewFrequency] = useState<FrequencyType>('daily');
  const [newCustomDays, setNewCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newReminderTime, setNewReminderTime] = useState<string>('08:00');

  // Habit Detail & Stats Modal
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);

  // Load habits on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const list = await getHabits();
    setHabits(list);
  };

  // Trigger haptic feedback
  const triggerHaptic = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics optional fallback
    }
  }, []);

  // Change selected date
  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedDateKey(formatDateKey(date));
    triggerHaptic();
  };

  // Toggle habit on selected date
  const handleToggle = async (habitId: string) => {
    triggerHaptic();
    const updated = await toggleHabitCompletion(habitId, selectedDateKey);
    setHabits(updated);

    if (detailHabit && detailHabit.id === habitId) {
      const updatedDetail = updated.find((h) => h.id === habitId);
      if (updatedDetail) setDetailHabit(updatedDetail);
    }
  };

  // Save new habit
  const handleCreateHabit = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen alışkanlık adını girin.');
      return;
    }

    const newHabit: Habit = {
      id: `habit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      icon: newIcon,
      color: newColor,
      frequency: newFrequency,
      customDays: newFrequency === 'custom' ? newCustomDays : undefined,
      reminderTime: newReminderTime.trim() || undefined,
      createdAt: new Date().toISOString(),
      completions: {},
    };

    const updated = await upsertHabit(newHabit);
    setHabits(updated);
    setAddModalVisible(false);

    // Reset form
    setNewTitle('');
    setNewDescription('');
    setNewIcon(HABIT_ICONS[0]);
    setNewColor(HABIT_COLORS[0]);
    setNewFrequency('daily');
    setNewCustomDays([1, 2, 3, 4, 5]);
  };

  // Delete habit
  const handleDelete = async (habitId: string) => {
    Alert.alert('Alışkanlığı Sil', 'Bu alışkanlığı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteHabit(habitId);
          setHabits(updated);
          setDetailHabit(null);
        },
      },
    ]);
  };

  // 7-day strip items
  const weekDays = useMemo(() => getLastNDays(7, new Date()), []);

  // Today's summary stats
  const todaySummary = useMemo(() => {
    const today = new Date();
    const todayKey = formatDateKey(today);
    let scheduledCount = 0;
    let completedCount = 0;

    habits.forEach((h) => {
      if (isHabitScheduledForDate(h, today)) {
        scheduledCount++;
        if (h.completions && h.completions[todayKey]) {
          completedCount++;
        }
      }
    });

    const percentage =
      scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

    return { scheduledCount, completedCount, percentage };
  }, [habits]);

  // Selected date stats
  const detailStats: HabitStats | null = useMemo(() => {
    if (!detailHabit) return null;
    return calculateHabitStats(detailHabit);
  }, [detailHabit]);

  // 30 days history for detail modal
  const last30Days = useMemo(() => getLastNDays(30, new Date()), []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Overview Card */}
      <View
        style={[
          styles.overviewCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
          },
        ]}
      >
        <View style={styles.overviewHeader}>
          <View>
            <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
              {formatTurkishDate(new Date())}
            </Text>
            <Text style={[typography.bodySmall, { color: theme.textSecondary, marginTop: 2 }]}>
              Günlük Alışkanlık İlerlemesi
            </Text>
          </View>

          <View
            style={[
              styles.percentagePill,
              {
                backgroundColor:
                  todaySummary.percentage === 100
                    ? theme.successContainer
                    : theme.primaryContainer,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Text
              style={[
                typography.titleSmall,
                {
                  color:
                    todaySummary.percentage === 100
                      ? theme.success
                      : theme.onPrimaryContainer,
                  fontWeight: '700',
                },
              ]}
            >
              %{todaySummary.percentage}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View
          style={[
            styles.progressBarTrack,
            {
              backgroundColor: theme.surfaceVariant,
              borderRadius: borderRadius.xs,
              marginTop: spacing.md,
            },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor:
                  todaySummary.percentage === 100 ? theme.success : theme.primary,
                width: `${todaySummary.percentage}%`,
                borderRadius: borderRadius.xs,
              },
            ]}
          />
        </View>

        <View style={[styles.progressLabelsRow, { marginTop: spacing.xs }]}>
          <Text style={[typography.bodySmall, { color: theme.textMuted }]}>
            {todaySummary.completedCount} / {todaySummary.scheduledCount} Tamamlandı
          </Text>
          {todaySummary.percentage === 100 && (
            <Text style={[typography.labelSmall, { color: theme.success, fontWeight: '700' }]}>
              🎉 Tebrikler! Tüm hedefler tamam.
            </Text>
          )}
        </View>
      </View>

      {/* 7-Day Interactive Date Selector */}
      <View
        style={[
          styles.dateStripCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            marginTop: spacing.sm,
            padding: spacing.sm,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStripScroll}
        >
          {weekDays.map((item) => {
            const isSelected = item.dateKey === selectedDateKey;
            return (
              <TouchableOpacity
                key={item.dateKey}
                onPress={() => handleSelectDate(item.date)}
                style={[
                  styles.dayPill,
                  {
                    backgroundColor: isSelected
                      ? theme.primary
                      : item.isToday
                      ? theme.primaryContainer
                      : theme.surfaceVariant,
                    borderRadius: borderRadius.md,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${item.dayName} ${item.dayNumber}`}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: isSelected
                        ? theme.onPrimary
                        : item.isToday
                        ? theme.onPrimaryContainer
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {item.dayName}
                </Text>
                <Text
                  style={[
                    typography.titleSmall,
                    {
                      color: isSelected
                        ? theme.onPrimary
                        : item.isToday
                        ? theme.onPrimaryContainer
                        : theme.textPrimary,
                      fontWeight: '700',
                      marginTop: 2,
                    },
                  ]}
                >
                  {item.dayNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Habit List Header */}
      <View style={[styles.sectionHeaderRow, { marginTop: spacing.md }]}>
        <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
          Alışkanlıklarım ({habits.length})
        </Text>

        <TouchableOpacity
          onPress={() => setAddModalVisible(true)}
          style={[
            styles.addHabitBtn,
            { backgroundColor: theme.primary, borderRadius: borderRadius.sm },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Yeni Alışkanlık Ekle"
        >
          <Ionicons name="add" size={18} color={theme.onPrimary} />
          <Text
            style={[
              typography.labelMedium,
              { color: theme.onPrimary, marginLeft: 2 },
            ]}
          >
            Yeni Ekle
          </Text>
        </TouchableOpacity>
      </View>

      {/* Habit Items */}
      <View style={[styles.habitsContainer, { marginTop: spacing.sm }]}>
        {habits.map((habit) => {
          const isCompletedForDate = !!habit.completions?.[selectedDateKey];
          const isScheduledForDate = isHabitScheduledForDate(habit, selectedDate);
          const stats = calculateHabitStats(habit);

          return (
            <TouchableOpacity
              key={habit.id}
              activeOpacity={0.9}
              onPress={() => setDetailHabit(habit)}
              style={[
                styles.habitCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: isCompletedForDate ? habit.color : theme.cardBorder,
                  borderLeftColor: habit.color,
                  borderLeftWidth: 4,
                  borderRadius: borderRadius.lg,
                  padding: spacing.md,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${habit.title} detayları`}
            >
              <View style={styles.habitCardTop}>
                {/* Habit Icon Circle */}
                <View
                  style={[
                    styles.habitIconCircle,
                    {
                      backgroundColor: `${habit.color}20`,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <Ionicons name={habit.icon as any} size={22} color={habit.color} />
                </View>

                {/* Habit Title & Streak Info */}
                <View style={styles.habitMainInfo}>
                  <Text
                    style={[
                      typography.titleSmall,
                      { color: theme.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {habit.title}
                  </Text>

                  <View style={styles.habitSubRow}>
                    <View style={styles.streakBadge}>
                      <Ionicons name="flame" size={14} color="#EA580C" />
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: '#EA580C', fontWeight: '700', marginLeft: 2 },
                        ]}
                      >
                        {stats.currentStreak} gün
                      </Text>
                    </View>

                    <Text style={[typography.bodySmall, { color: theme.textMuted, marginLeft: 6 }]}>
                      • %{stats.weeklyRate} haftalık
                    </Text>
                  </View>
                </View>

                {/* Checkbox Toggle */}
                <TouchableOpacity
                  onPress={() => handleToggle(habit.id)}
                  style={[
                    styles.checkButton,
                    {
                      backgroundColor: isCompletedForDate ? habit.color : theme.surfaceVariant,
                      borderColor: isCompletedForDate ? habit.color : theme.cardBorder,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isCompletedForDate }}
                  accessibilityLabel={`${habit.title} tamamlandı olarak işaretle`}
                >
                  <Ionicons
                    name={isCompletedForDate ? 'checkmark' : 'ellipse-outline'}
                    size={22}
                    color={isCompletedForDate ? '#FFFFFF' : theme.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* 7-Day Mini Dots Timeline */}
              <View style={[styles.miniDotsRow, { marginTop: spacing.sm, borderTopColor: theme.divider, borderTopWidth: 1, paddingTop: 8 }]}>
                <Text style={[typography.labelSmall, { color: theme.textMuted, marginRight: 6 }]}>
                  Son 7 Gün:
                </Text>
                <View style={styles.dotsList}>
                  {weekDays.map((d) => {
                    const done = !!habit.completions?.[d.dateKey];
                    const sched = isHabitScheduledForDate(habit, d.date);
                    return (
                      <View
                        key={d.dateKey}
                        style={[
                          styles.historyDot,
                          {
                            backgroundColor: done
                              ? habit.color
                              : sched
                              ? theme.surfaceVariant
                              : 'transparent',
                            borderColor: done ? habit.color : theme.cardBorder,
                            borderRadius: borderRadius.xs,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detail & Statistics Modal */}
      <Modal
        visible={!!detailHabit}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailHabit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.detailModalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            {detailHabit && detailStats && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderLeft}>
                    <View
                      style={[
                        styles.detailIconBox,
                        {
                          backgroundColor: `${detailHabit.color}25`,
                          borderRadius: borderRadius.md,
                        },
                      ]}
                    >
                      <Ionicons
                        name={detailHabit.icon as any}
                        size={28}
                        color={detailHabit.color}
                      />
                    </View>
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                        {detailHabit.title}
                      </Text>
                      {detailHabit.description && (
                        <Text
                          style={[
                            typography.bodySmall,
                            { color: theme.textSecondary, marginTop: 2 },
                          ]}
                        >
                          {detailHabit.description}
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setDetailHabit(null)}
                    style={[
                      styles.closeButtonCircle,
                      { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Kapat"
                  >
                    <Ionicons name="close" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Stats 4-Grid */}
                <View style={[styles.stats4Grid, { marginTop: spacing.md }]}>
                  {/* Current Streak */}
                  <View
                    style={[
                      styles.statGridItem,
                      { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                    ]}
                  >
                    <Ionicons name="flame" size={20} color="#EA580C" />
                    <Text
                      style={[
                        typography.titleMedium,
                        { color: theme.textPrimary, fontWeight: '700', marginTop: 4 },
                      ]}
                    >
                      {detailStats.currentStreak} Gün
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
                      Mevcut Seri
                    </Text>
                  </View>

                  {/* Longest Streak */}
                  <View
                    style={[
                      styles.statGridItem,
                      { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                    ]}
                  >
                    <Ionicons name="trophy" size={20} color="#EAB308" />
                    <Text
                      style={[
                        typography.titleMedium,
                        { color: theme.textPrimary, fontWeight: '700', marginTop: 4 },
                      ]}
                    >
                      {detailStats.longestStreak} Gün
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
                      En Uzun Seri
                    </Text>
                  </View>

                  {/* Weekly Rate */}
                  <View
                    style={[
                      styles.statGridItem,
                      { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                    ]}
                  >
                    <Ionicons name="stats-chart" size={20} color={theme.primary} />
                    <Text
                      style={[
                        typography.titleMedium,
                        { color: theme.textPrimary, fontWeight: '700', marginTop: 4 },
                      ]}
                    >
                      %{detailStats.weeklyRate}
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
                      Haftalık Başarı
                    </Text>
                  </View>

                  {/* Total Completed */}
                  <View
                    style={[
                      styles.statGridItem,
                      { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.md },
                    ]}
                  >
                    <Ionicons name="checkmark-done-circle" size={20} color={theme.success} />
                    <Text
                      style={[
                        typography.titleMedium,
                        { color: theme.textPrimary, fontWeight: '700', marginTop: 4 },
                      ]}
                    >
                      {detailStats.totalCompletions} Kez
                    </Text>
                    <Text style={[typography.labelSmall, { color: theme.textMuted }]}>
                      Toplam
                    </Text>
                  </View>
                </View>

                {/* 30-Day Heatmap Grid */}
                <View style={[styles.heatmapContainer, { marginTop: spacing.lg }]}>
                  <Text
                    style={[
                      typography.titleSmall,
                      { color: theme.textPrimary, marginBottom: spacing.xs },
                    ]}
                  >
                    Son 30 Günlük Aktivite
                  </Text>
                  <View style={styles.heatmapGrid}>
                    {last30Days.map((d) => {
                      const completed = !!detailHabit.completions?.[d.dateKey];
                      return (
                        <View
                          key={d.dateKey}
                          style={[
                            styles.heatmapCell,
                            {
                              backgroundColor: completed
                                ? detailHabit.color
                                : theme.surfaceVariant,
                              borderColor: theme.cardBorder,
                              borderRadius: borderRadius.xs,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>

                {/* Delete Button */}
                <TouchableOpacity
                  onPress={() => handleDelete(detailHabit.id)}
                  style={[
                    styles.deleteHabitBtn,
                    {
                      backgroundColor: theme.errorContainer,
                      borderRadius: borderRadius.md,
                      marginTop: spacing.xl,
                      paddingVertical: spacing.md,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Bu alışkanlığı sil"
                >
                  <Ionicons name="trash-outline" size={18} color={theme.onErrorContainer} />
                  <Text
                    style={[
                      typography.labelLarge,
                      { color: theme.onErrorContainer, marginLeft: spacing.xs },
                    ]}
                  >
                    Alışkanlığı Sil
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add New Habit Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.addModalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Modal Title Row */}
              <View style={styles.modalHeaderRow}>
                <Text style={[typography.titleMedium, { color: theme.textPrimary }]}>
                  Yeni Alışkanlık Ekle
                </Text>
                <TouchableOpacity
                  onPress={() => setAddModalVisible(false)}
                  style={[
                    styles.closeButtonCircle,
                    { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Kapat"
                >
                  <Ionicons name="close" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Title Input */}
              <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md }]}>
                Alışkanlık Adı *
              </Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Örn: Günde 2 Litre Su İç"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.xs,
                    padding: spacing.md,
                  },
                ]}
              />

              {/* Description Input */}
              <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md }]}>
                Açıklama / Hedef (İsteğe Bağlı)
              </Text>
              <TextInput
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Örn: Sağlıklı kalmak için"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.xs,
                    padding: spacing.md,
                  },
                ]}
              />

              {/* Icon Selector */}
              <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md }]}>
                Simge Seçin
              </Text>
              <View style={[styles.iconPickerGrid, { marginTop: spacing.xs }]}>
                {HABIT_ICONS.map((icon) => {
                  const isSelected = newIcon === icon;
                  return (
                    <TouchableOpacity
                      key={icon}
                      onPress={() => setNewIcon(icon)}
                      style={[
                        styles.iconChoiceBtn,
                        {
                          backgroundColor: isSelected ? newColor : theme.surfaceVariant,
                          borderRadius: borderRadius.md,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Simge ${icon}`}
                    >
                      <Ionicons
                        name={icon as any}
                        size={22}
                        color={isSelected ? '#FFFFFF' : theme.textPrimary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Color Selector */}
              <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md }]}>
                Renk Teması
              </Text>
              <View style={[styles.colorPickerRow, { marginTop: spacing.xs }]}>
                {HABIT_COLORS.map((color) => {
                  const isSelected = newColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setNewColor(color)}
                      style={[
                        styles.colorChoiceBtn,
                        {
                          backgroundColor: color,
                          borderColor: isSelected ? theme.textPrimary : 'transparent',
                          borderWidth: isSelected ? 3 : 0,
                          borderRadius: borderRadius.full,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Renk ${color}`}
                    />
                  );
                })}
              </View>

              {/* Frequency Selector */}
              <Text style={[typography.labelMedium, { color: theme.textSecondary, marginTop: spacing.md }]}>
                Tekrar Sıklığı
              </Text>
              <View style={[styles.frequencyRow, { marginTop: spacing.xs }]}>
                {[
                  { id: 'daily' as FrequencyType, label: 'Her Gün' },
                  { id: 'weekdays' as FrequencyType, label: 'Hafta İçi' },
                ].map((f) => {
                  const isSelected = newFrequency === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setNewFrequency(f.id)}
                      style={[
                        styles.freqBtn,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                          borderColor: isSelected ? theme.primary : theme.cardBorder,
                          borderRadius: borderRadius.sm,
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={f.label}
                    >
                      <Text
                        style={[
                          typography.labelMedium,
                          { color: isSelected ? theme.onPrimary : theme.textPrimary },
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleCreateHabit}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.xl,
                    paddingVertical: spacing.md,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Alışkanlığı Kaydet"
              >
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
                <Text
                  style={[
                    typography.labelLarge,
                    { color: theme.onPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  Alışkanlığı Başlat
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
  overviewCard: {
    borderWidth: 1,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentagePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateStripCard: {
    borderWidth: 1,
  },
  dateStripScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  dayPill: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addHabitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  habitsContainer: {
    gap: 10,
  },
  habitCard: {
    borderWidth: 1,
  },
  habitCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitIconCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitMainInfo: {
    flex: 1,
    marginLeft: 12,
  },
  habitSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  miniDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotsList: {
    flexDirection: 'row',
    gap: 5,
  },
  historyDot: {
    width: 14,
    height: 14,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  detailModalCard: {
    maxHeight: '85%',
    borderWidth: 1,
  },
  addModalCard: {
    maxHeight: '85%',
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailIconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats4Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statGridItem: {
    flexBasis: '48%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  heatmapContainer: {},
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  heatmapCell: {
    width: 22,
    height: 22,
    borderWidth: 1,
  },
  deleteHabitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    borderWidth: 1,
  },
  iconPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconChoiceBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorChoiceBtn: {
    width: 34,
    height: 34,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
