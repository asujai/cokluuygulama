import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../core/theme';
import { WheelSlice, CoinFlipStats, DiceType, DiceRollResult } from './types';
import {
  WHEEL_PRESETS,
  playWheelTickSound,
  playCoinFlipSound,
  playDiceRollSound,
  playCelebrationFanfare,
  triggerLightHaptic,
  triggerMediumHaptic,
  triggerSuccessHaptic,
  generateRandomNumbers,
  shuffleArray,
  divideIntoTeams,
  rollDice,
} from './randomAlgorithms';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(SCREEN_WIDTH - 64, 280);

export const RandomPickerTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography, isDark } = useTheme();

  // Active Tab: 'wheel' | 'list' | 'numbers' | 'coin' | 'dice'
  const [activeTab, setActiveTab] = useState<'wheel' | 'list' | 'numbers' | 'coin' | 'dice'>('wheel');

  // ==========================================
  // TAB 1: DECISION WHEEL STATE
  // ==========================================
  const [slices, setSlices] = useState<WheelSlice[]>(
    WHEEL_PRESETS[0].slices.map((s, idx) => ({
      id: `slice-${idx}`,
      label: s.label,
      color: s.color,
      enabled: true,
    }))
  );
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerSlice, setWinnerSlice] = useState<WheelSlice | null>(null);
  const [winnerModalVisible, setWinnerModalVisible] = useState(false);
  const [newSliceLabel, setNewSliceLabel] = useState('');
  const spinIntervalRef = useRef<any>(null);

  const activeSlices = useMemo(() => slices.filter((s) => s.enabled), [slices]);

  const handleSpinWheel = () => {
    if (isSpinning || activeSlices.length < 2) return;
    setIsSpinning(true);
    triggerMediumHaptic();

    // Pick winning slice randomly
    const winningIdx = Math.floor(Math.random() * activeSlices.length);
    const sliceAngle = 360 / activeSlices.length;

    // Target angle points needle (at top 0°) to winning slice
    // Adding 5-8 full rotations (1800° - 2880°) for dramatic spin
    const fullSpins = (5 + Math.floor(Math.random() * 4)) * 360;
    const targetOffset = 360 - (winningIdx * sliceAngle + sliceAngle / 2);
    const finalAngle = wheelRotation + fullSpins + targetOffset;

    let currentAngle = wheelRotation;
    const startTime = Date.now();
    const duration = 3200; // 3.2 seconds

    let lastTickAngle = currentAngle;

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    spinIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease out cubic physics: 1 - Math.pow(1 - progress, 3)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      currentAngle = wheelRotation + (finalAngle - wheelRotation) * easeOut;

      setWheelRotation(currentAngle % 360);

      // Play tick sound when passing slice boundaries
      if (Math.abs(currentAngle - lastTickAngle) >= sliceAngle) {
        playWheelTickSound();
        lastTickAngle = currentAngle;
      }

      if (progress >= 1) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
        setIsSpinning(false);
        setWheelRotation(finalAngle % 360);
        const winner = activeSlices[winningIdx];
        setWinnerSlice(winner);
        setWinnerModalVisible(true);
        playCelebrationFanfare();
        triggerSuccessHaptic();
      }
    }, 20);
  };

  const handleLoadWheelPreset = (presetId: string) => {
    const preset = WHEEL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    triggerLightHaptic();
    setSlices(
      preset.slices.map((s, idx) => ({
        id: `preset-${Date.now()}-${idx}`,
        label: s.label,
        color: s.color,
        enabled: true,
      }))
    );
  };

  const handleAddCustomSlice = () => {
    if (!newSliceLabel.trim()) return;
    triggerLightHaptic();
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#EC4899', '#8B5CF6'];
    const newSlice: WheelSlice = {
      id: Date.now().toString(),
      label: newSliceLabel.trim(),
      color: colors[slices.length % colors.length],
      enabled: true,
    };
    setSlices([...slices, newSlice]);
    setNewSliceLabel('');
  };

  const handleRemoveSlice = (id: string) => {
    triggerLightHaptic();
    setSlices(slices.filter((s) => s.id !== id));
  };

  // ==========================================
  // TAB 2: LIST PICKER & RAFFLE STATE
  // ==========================================
  const [listText, setListText] = useState(
    'Ahmet\nAyşe\nMehmet\nFatma\nCan\nZeynep\nBurak\nElif'
  );
  const [listMode, setListMode] = useState<'pick' | 'teams'>('pick');
  const [winnerCount, setWinnerCount] = useState('1');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [teamCount, setTeamCount] = useState('2');
  const [drawnWinners, setDrawnWinners] = useState<string[]>([]);
  const [drawnTeams, setDrawnTeams] = useState<{ teamNumber: number; members: string[] }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const parsedItems = useMemo(() => {
    return listText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [listText]);

  const handleDrawRaffle = () => {
    if (parsedItems.length === 0 || isDrawing) return;
    setIsDrawing(true);
    triggerMediumHaptic();

    if (listMode === 'pick') {
      const count = parseInt(winnerCount, 10) || 1;
      let pool = [...parsedItems];
      let selected: string[] = [];

      if (!allowDuplicates) {
        pool = shuffleArray(pool);
        selected = pool.slice(0, Math.min(count, pool.length));
      } else {
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          selected.push(pool[idx]);
        }
      }

      setTimeout(() => {
        setDrawnWinners(selected);
        setIsDrawing(false);
        playCelebrationFanfare();
        triggerSuccessHaptic();
      }, 500);
    } else {
      const numTeams = parseInt(teamCount, 10) || 2;
      const teams = divideIntoTeams(parsedItems, numTeams);
      setTimeout(() => {
        setDrawnTeams(teams);
        setIsDrawing(false);
        playCelebrationFanfare();
        triggerSuccessHaptic();
      }, 500);
    }
  };

  const handleShuffleList = () => {
    triggerLightHaptic();
    const shuffled = shuffleArray(parsedItems);
    setListText(shuffled.join('\n'));
  };

  // ==========================================
  // TAB 3: RANDOM NUMBER GENERATOR STATE
  // ==========================================
  const [numMin, setNumMin] = useState('1');
  const [numMax, setNumMax] = useState('100');
  const [numQuantity, setNumQuantity] = useState('6');
  const [numUnique, setNumUnique] = useState(true);
  const [numSorted, setNumSorted] = useState(true);
  const [generatedNumbers, setGeneratedNumbers] = useState<number[]>([7, 14, 21, 35, 42, 49]);
  const [numberHistory, setNumberHistory] = useState<number[][]>([]);

  const handleGenerateNumbers = () => {
    triggerMediumHaptic();
    const min = parseInt(numMin, 10) || 1;
    const max = parseInt(numMax, 10) || 100;
    const qty = parseInt(numQuantity, 10) || 1;

    const res = generateRandomNumbers(min, max, qty, numUnique, numSorted);
    setGeneratedNumbers(res);
    setNumberHistory([res, ...numberHistory.slice(0, 4)]);
    playDiceRollSound();
  };

  const handleLoadLotteryPreset = (name: string) => {
    triggerLightHaptic();
    if (name === 'sayisal') {
      setNumMin('1');
      setNumMax('49');
      setNumQuantity('6');
      setNumUnique(true);
      setNumSorted(true);
    } else if (name === 'super') {
      setNumMin('1');
      setNumMax('60');
      setNumQuantity('6');
      setNumUnique(true);
      setNumSorted(true);
    } else if (name === 'onnumara') {
      setNumMin('1');
      setNumMax('80');
      setNumQuantity('10');
      setNumUnique(true);
      setNumSorted(true);
    } else if (name === 'sanstopu') {
      setNumMin('1');
      setNumMax('34');
      setNumQuantity('5');
      setNumUnique(true);
      setNumSorted(true);
    } else if (name === 'd100') {
      setNumMin('1');
      setNumMax('100');
      setNumQuantity('1');
      setNumUnique(false);
      setNumSorted(false);
    }
  };

  const handleCopyNumbers = async () => {
    triggerLightHaptic();
    await Clipboard.setStringAsync(generatedNumbers.join(', '));
  };

  // ==========================================
  // TAB 4: COIN FLIP STATE
  // ==========================================
  const [coinCount, setCoinCount] = useState(1);
  const [coinResults, setCoinResults] = useState<('heads' | 'tails')[]>(['heads']);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const [coinStats, setCoinStats] = useState<CoinFlipStats>({
    total: 1,
    heads: 1,
    tails: 0,
    currentStreak: 1,
    streakType: 'heads',
  });

  const handleFlipCoins = () => {
    if (isFlippingCoin) return;
    setIsFlippingCoin(true);
    playCoinFlipSound();
    triggerMediumHaptic();

    setTimeout(() => {
      const results: ('heads' | 'tails')[] = [];
      let newHeads = coinStats.heads;
      let newTails = coinStats.tails;

      for (let i = 0; i < coinCount; i++) {
        const isHead = Math.random() >= 0.5;
        if (isHead) {
          results.push('heads');
          newHeads++;
        } else {
          results.push('tails');
          newTails++;
        }
      }

      // Compute streak for single coin
      let streak = coinStats.currentStreak;
      let streakType = coinStats.streakType;

      if (coinCount === 1) {
        if (results[0] === streakType) {
          streak++;
        } else {
          streak = 1;
          streakType = results[0];
        }
      }

      setCoinResults(results);
      setCoinStats({
        total: coinStats.total + coinCount,
        heads: newHeads,
        tails: newTails,
        currentStreak: streak,
        streakType,
      });

      setIsFlippingCoin(false);
      triggerSuccessHaptic();
    }, 450);
  };

  const handleResetCoinStats = () => {
    triggerLightHaptic();
    setCoinStats({
      total: 0,
      heads: 0,
      tails: 0,
      currentStreak: 0,
      streakType: null,
    });
  };

  // ==========================================
  // TAB 5: DICE ROLLER STATE
  // ==========================================
  const [selectedDiceType, setSelectedDiceType] = useState<DiceType>('d6');
  const [diceCount, setDiceCount] = useState(2);
  const [diceValues, setDiceValues] = useState<number[]>([3, 5]);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [diceHistory, setDiceHistory] = useState<DiceRollResult[]>([]);

  const diceSum = useMemo(() => {
    return diceValues.reduce((acc, v) => acc + v, 0);
  }, [diceValues]);

  const handleRollDice = () => {
    if (isRollingDice) return;
    setIsRollingDice(true);
    playDiceRollSound();
    triggerMediumHaptic();

    setTimeout(() => {
      const vals = rollDice(selectedDiceType, diceCount);
      const total = vals.reduce((acc, v) => acc + v, 0);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const average = Number((total / vals.length).toFixed(1));

      setDiceValues(vals);
      setIsRollingDice(false);
      triggerSuccessHaptic();

      const record: DiceRollResult = {
        id: Date.now().toString(),
        diceType: selectedDiceType,
        count: diceCount,
        values: vals,
        total,
        min,
        max,
        average,
        timestamp: Date.now(),
      };
      setDiceHistory([record, ...diceHistory.slice(0, 4)]);
    }, 400);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={[typography.titleLarge, { color: theme.textPrimary }]}>
          Rastgele Seçici & Karar Çarkı
        </Text>
        <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
          Karar çarkı, kura çekici, sayı üreteci, yazı-tura ve zar atma
        </Text>
      </View>

      {/* 5 Tab Navigation Switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollRow}
      >
        {[
          { key: 'wheel', title: 'Karar Çarkı', icon: 'aperture-outline' },
          { key: 'list', title: 'Kura & Liste', icon: 'list-outline' },
          { key: 'numbers', title: 'Sayı Üret', icon: 'grid-outline' },
          { key: 'coin', title: 'Yazı-Tura', icon: 'cash-outline' },
          { key: 'dice', title: 'Zar At', icon: 'dice-outline' },
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
              triggerLightHaptic();
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
      {/* TAB 1: DECISION WHEEL                                   */}
      {/* ======================================================= */}
      {activeTab === 'wheel' && (
        <View>
          {/* Wheel Presets */}
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
            HAZIR ŞABLONLAR
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {WHEEL_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetChip,
                  { backgroundColor: theme.surface, borderColor: theme.cardBorder },
                ]}
                onPress={() => handleLoadWheelPreset(preset.id)}
              >
                <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
                  {preset.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Graphical Animated Decision Wheel */}
          <View style={[styles.wheelContainer, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            {/* Top Fixed Needle Pointer */}
            <View style={styles.wheelTopPointer}>
              <View style={styles.pointerTriangle} />
            </View>

            {/* Rotating Disc */}
            <View
              style={[
                styles.wheelDisc,
                {
                  width: WHEEL_SIZE,
                  height: WHEEL_SIZE,
                  borderRadius: WHEEL_SIZE / 2,
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  transform: [{ rotate: `${wheelRotation}deg` }],
                },
              ]}
            >
              {activeSlices.map((slice, index) => {
                const angle = 360 / activeSlices.length;
                const rot = index * angle;

                return (
                  <View
                    key={slice.id}
                    style={[
                      styles.sliceContainer,
                      {
                        transform: [{ rotate: `${rot}deg` }],
                      },
                    ]}
                  >
                    <View style={[styles.sliceSectorLine, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]} />
                    <Text
                      style={[
                        styles.sliceText,
                        {
                          color: slice.color,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {slice.label}
                    </Text>
                  </View>
                );
              })}

              {/* Center Hub */}
              <View style={[styles.wheelCenterHub, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                <Ionicons name="sparkles" size={20} color={theme.primary} />
              </View>
            </View>

            {/* Big Spin Button */}
            <TouchableOpacity
              style={[
                styles.spinButton,
                {
                  backgroundColor: isSpinning ? theme.textMuted : theme.primary,
                },
              ]}
              disabled={isSpinning}
              onPress={handleSpinWheel}
            >
              <Ionicons name="reload" size={20} color="#FFFFFF" />
              <Text style={[typography.titleSmall, { color: '#FFFFFF', marginLeft: 6 }]}>
                {isSpinning ? 'Çark Dönüyor...' : 'ÇARKI ÇEVİR! 🎯'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Slices Manager */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: 12 }]}>
              Çark Dilimleri ({activeSlices.length})
            </Text>

            {/* Add Custom Slice Input */}
            <View style={styles.addSliceRow}>
              <TextInput
                style={[
                  styles.sliceInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Yeni seçenek ekle..."
                placeholderTextColor={theme.textMuted}
                value={newSliceLabel}
                onChangeText={setNewSliceLabel}
              />
              <TouchableOpacity
                style={[styles.addSliceBtn, { backgroundColor: theme.primary }]}
                onPress={handleAddCustomSlice}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Slices list chips */}
            <View style={styles.slicesListWrap}>
              {slices.map((s) => (
                <View
                  key={s.id}
                  style={[
                    styles.sliceTag,
                    {
                      backgroundColor: theme.surfaceVariant,
                      borderLeftColor: s.color,
                      borderLeftWidth: 4,
                    },
                  ]}
                >
                  <Text style={[typography.bodyMedium, { color: theme.textPrimary, flex: 1 }]}>
                    {s.label}
                  </Text>
                  {slices.length > 2 && (
                    <TouchableOpacity onPress={() => handleRemoveSlice(s.id)}>
                      <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ======================================================= */}
      {/* TAB 2: LIST PICKER & RAFFLE                             */}
      {/* ======================================================= */}
      {activeTab === 'list' && (
        <View>
          {/* Mode Switch: Kazanan Belirle | Takımlara Ayır */}
          <View style={[styles.modeSwitch, { backgroundColor: theme.surfaceVariant }]}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                listMode === 'pick' && { backgroundColor: theme.surface, elevation: 2 },
              ]}
              onPress={() => setListMode('pick')}
            >
              <Text
                style={[
                  typography.labelMedium,
                  { color: listMode === 'pick' ? theme.primary : theme.textSecondary },
                ]}
              >
                Kazanan Kura Çek
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeBtn,
                listMode === 'teams' && { backgroundColor: theme.surface, elevation: 2 },
              ]}
              onPress={() => setListMode('teams')}
            >
              <Text
                style={[
                  typography.labelMedium,
                  { color: listMode === 'teams' ? theme.primary : theme.textSecondary },
                ]}
              >
                Gruplara & Takımlara Ayır
              </Text>
            </TouchableOpacity>
          </View>

          {/* List Input Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                Aday Listesi ({parsedItems.length} Eleman)
              </Text>
              <TouchableOpacity style={styles.shuffleBtn} onPress={handleShuffleList}>
                <Ionicons name="shuffle-outline" size={16} color={theme.primary} />
                <Text style={[typography.labelSmall, { color: theme.primary, marginLeft: 4 }]}>
                  Karıştır
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[typography.bodySmall, { color: theme.textSecondary, marginBottom: 8 }]}>
              Her satıra bir isim veya seçenek yazın:
            </Text>
            <TextInput
              style={[
                styles.listTextArea,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.inputBorder,
                  color: theme.textPrimary,
                },
              ]}
              multiline
              numberOfLines={6}
              value={listText}
              onChangeText={setListText}
            />
          </View>

          {/* Options & Settings */}
          {listMode === 'pick' ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <View style={styles.optionInputRow}>
                <Text style={[typography.bodyMedium, { color: theme.textPrimary, flex: 1 }]}>
                  Kaç Kazanan Seçilsin?
                </Text>
                <TextInput
                  style={[
                    styles.smallBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={winnerCount}
                  onChangeText={setWinnerCount}
                  maxLength={2}
                />
              </View>

              <TouchableOpacity
                style={[styles.toggleRow, { marginTop: 12 }]}
                onPress={() => setAllowDuplicates(!allowDuplicates)}
              >
                <Ionicons
                  name={allowDuplicates ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={allowDuplicates ? theme.primary : theme.textMuted}
                />
                <Text style={[typography.bodyMedium, { color: theme.textPrimary, marginLeft: 8 }]}>
                  Aynı isim birden fazla kez kazanabilir (Tekrarlı)
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <View style={styles.optionInputRow}>
                <Text style={[typography.bodyMedium, { color: theme.textPrimary, flex: 1 }]}>
                  Kaç Takım / Grup Oluşturulsun?
                </Text>
                <TextInput
                  style={[
                    styles.smallBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={teamCount}
                  onChangeText={setTeamCount}
                  maxLength={2}
                />
              </View>
            </View>
          )}

          {/* Big Draw Button */}
          <TouchableOpacity
            style={[styles.mainActionBtn, { backgroundColor: theme.primary }]}
            onPress={handleDrawRaffle}
          >
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            <Text style={[typography.titleMedium, { color: '#FFFFFF', marginLeft: 8 }]}>
              {listMode === 'pick' ? 'KURA ÇEK! 🎁' : 'TAKIMLARI OLUŞTUR! 👥'}
            </Text>
          </TouchableOpacity>

          {/* Drawn Winners Results */}
          {drawnWinners.length > 0 && listMode === 'pick' && (
            <View style={[styles.card, { backgroundColor: isDark ? '#14532D' : '#DCFCE7', borderColor: '#16A34A' }]}>
              <Text style={[typography.titleMedium, { color: '#16A34A', fontWeight: '700', marginBottom: 10 }]}>
                🎉 KAZANANLAR
              </Text>
              {drawnWinners.map((w, idx) => (
                <View key={idx} style={styles.winnerItemRow}>
                  <View style={styles.winnerMedal}>
                    <Text style={{ fontWeight: '800', color: '#16A34A' }}>#{idx + 1}</Text>
                  </View>
                  <Text style={[typography.titleMedium, { color: '#15803D', fontWeight: '700', marginLeft: 10 }]}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Drawn Teams Results */}
          {drawnTeams.length > 0 && listMode === 'teams' && (
            <View style={styles.teamsGrid}>
              {drawnTeams.map((team) => (
                <View
                  key={team.teamNumber}
                  style={[styles.teamCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
                >
                  <Text style={[typography.titleSmall, { color: theme.primary, marginBottom: 6 }]}>
                    Takım {team.teamNumber} ({team.members.length} Kişi)
                  </Text>
                  {team.members.map((m, mIdx) => (
                    <Text key={mIdx} style={[typography.bodyMedium, { color: theme.textPrimary, paddingVertical: 2 }]}>
                      • {m}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ======================================================= */}
      {/* TAB 3: RANDOM NUMBER GENERATOR                          */}
      {/* ======================================================= */}
      {activeTab === 'numbers' && (
        <View>
          {/* Lottery Presets */}
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
            ŞANS OYUNLARI & LOTO ŞABLONLARI
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {[
              { id: 'sayisal', label: 'Sayısal Loto (6/49)' },
              { id: 'super', label: 'Süper Loto (6/60)' },
              { id: 'sanstopu', label: 'Şans Topu (5/34)' },
              { id: 'onnumara', label: 'On Numara (10/80)' },
              { id: 'd100', label: '1 - 100' },
            ].map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.presetChip,
                  { backgroundColor: theme.surface, borderColor: theme.cardBorder },
                ]}
                onPress={() => handleLoadLotteryPreset(p.id)}
              >
                <Text style={[typography.labelMedium, { color: theme.textPrimary }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Number Inputs Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.numInputsRow}>
              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Min Değer</Text>
                <TextInput
                  style={[
                    styles.inputBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={numMin}
                  onChangeText={setNumMin}
                />
              </View>

              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Max Değer</Text>
                <TextInput
                  style={[
                    styles.inputBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={numMax}
                  onChangeText={setNumMax}
                />
              </View>

              <View style={styles.inputCol}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>Adet</Text>
                <TextInput
                  style={[
                    styles.inputBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={numQuantity}
                  onChangeText={setNumQuantity}
                />
              </View>
            </View>

            {/* Checkboxes */}
            <View style={styles.numCheckboxesRow}>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setNumUnique(!numUnique)}
              >
                <Ionicons
                  name={numUnique ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={numUnique ? theme.primary : theme.textMuted}
                />
                <Text style={[typography.bodySmall, { color: theme.textPrimary, marginLeft: 6 }]}>
                  Benzersiz (Tekrarsız)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setNumSorted(!numSorted)}
              >
                <Ionicons
                  name={numSorted ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={numSorted ? theme.primary : theme.textMuted}
                />
                <Text style={[typography.bodySmall, { color: theme.textPrimary, marginLeft: 6 }]}>
                  Küçükten Büyüğe Sırala
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.mainActionBtn, { backgroundColor: theme.primary }]}
            onPress={handleGenerateNumbers}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={[typography.titleMedium, { color: '#FFFFFF', marginLeft: 8 }]}>
              SAYILARI ÜRET 🎲
            </Text>
          </TouchableOpacity>

          {/* Generated Number Balls */}
          <View style={[styles.ballsResultCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                Üretilen Sayılar ({generatedNumbers.length})
              </Text>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyNumbers}>
                <Ionicons name="copy-outline" size={16} color={theme.primary} />
                <Text style={[typography.labelSmall, { color: theme.primary, marginLeft: 4 }]}>
                  Kopyala
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.ballsWrap}>
              {generatedNumbers.map((n, idx) => (
                <View key={idx} style={[styles.numberBall, { backgroundColor: theme.primary }]}>
                  <Text style={styles.numberBallText}>{n}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ======================================================= */}
      {/* TAB 4: COIN FLIP (YAZI-TURA)                             */}
      {/* ======================================================= */}
      {activeTab === 'coin' && (
        <View>
          {/* Coin Flip Area */}
          <View style={[styles.coinWrapper, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.coinsRow}>
              {coinResults.map((side, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.coinDisc,
                    isFlippingCoin && styles.coinFlippingAnim,
                  ]}
                >
                  <View style={styles.coinInnerBorder}>
                    <Text style={styles.coinSideLabel}>
                      {side === 'heads' ? 'YAZI' : 'TURA'}
                    </Text>
                    <Text style={{ fontSize: 18, marginTop: 2 }}>
                      {side === 'heads' ? '₺1' : '🇹🇷'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Flip Controls */}
            <View style={styles.coinCountPicker}>
              <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>Madeni Para Adedi:</Text>
              <View style={styles.coinCountChips}>
                {[1, 2, 3, 5].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.coinCountChip,
                      {
                        backgroundColor: coinCount === c ? theme.primary : theme.surfaceVariant,
                      },
                    ]}
                    onPress={() => setCoinCount(c)}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        { color: coinCount === c ? '#FFFFFF' : theme.textPrimary },
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.spinButton, { backgroundColor: '#F59E0B' }]}
              disabled={isFlippingCoin}
              onPress={handleFlipCoins}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={[typography.titleSmall, { color: '#FFFFFF', marginLeft: 8 }]}>
                {isFlippingCoin ? 'Para Havada...' : 'PARAYI FIRLAT! 🪙'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Flip Statistics Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[typography.titleSmall, { color: theme.textPrimary }]}>
                İstatistikler & Seri Takibi
              </Text>
              <TouchableOpacity onPress={handleResetCoinStats}>
                <Text style={[typography.labelSmall, { color: theme.error }]}>Sıfırla</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>YAZI</Text>
                <Text style={[typography.titleMedium, { color: theme.primary, marginTop: 4 }]}>
                  {coinStats.heads} (%{coinStats.total > 0 ? Math.round((coinStats.heads / coinStats.total) * 100) : 0})
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>TURA</Text>
                <Text style={[typography.titleMedium, { color: '#F59E0B', marginTop: 4 }]}>
                  {coinStats.tails} (%{coinStats.total > 0 ? Math.round((coinStats.tails / coinStats.total) * 100) : 0})
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>TOPLAM ATIŞ</Text>
                <Text style={[typography.titleMedium, { color: theme.textPrimary, marginTop: 4 }]}>
                  {coinStats.total}
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[typography.labelSmall, { color: theme.textSecondary }]}>GÜNCEL SERİ</Text>
                <Text style={[typography.titleMedium, { color: '#10B981', marginTop: 4 }]}>
                  {coinStats.currentStreak}x {coinStats.streakType === 'heads' ? 'Yazı' : 'Tura'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ======================================================= */}
      {/* TAB 5: DICE ROLLER (ZAR ATMA)                           */}
      {/* ======================================================= */}
      {activeTab === 'dice' && (
        <View>
          {/* Dice Selection Bar (D4, D6, D8, D10, D12, D20, D100) */}
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: 8 }]}>
            ZAR TÜRÜNÜ SEÇİN
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as DiceType[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: selectedDiceType === d ? theme.primary : theme.surface,
                    borderColor: selectedDiceType === d ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => setSelectedDiceType(d)}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    { color: selectedDiceType === d ? '#FFFFFF' : theme.textPrimary },
                  ]}
                >
                  {d.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Dice Display Board */}
          <View style={[styles.diceBoard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.diceWrap}>
              {diceValues.map((val, idx) => (
                <View key={idx} style={[styles.diceCube, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                  <Text style={[styles.diceValueText, { color: theme.primary }]}>{val}</Text>
                </View>
              ))}
            </View>

            {/* Total Sum Display */}
            <Text style={[typography.titleLarge, { color: theme.textPrimary, marginVertical: 8 }]}>
              Toplam Skor: <Text style={{ color: theme.primary }}>{diceSum}</Text>
            </Text>

            {/* Dice Count Picker */}
            <View style={styles.coinCountPicker}>
              <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>Zar Sayısı:</Text>
              <View style={styles.coinCountChips}>
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.coinCountChip,
                      {
                        backgroundColor: diceCount === c ? theme.primary : theme.surfaceVariant,
                      },
                    ]}
                    onPress={() => setDiceCount(c)}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        { color: diceCount === c ? '#FFFFFF' : theme.textPrimary },
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Roll Dice Button */}
            <TouchableOpacity
              style={[styles.spinButton, { backgroundColor: '#6366F1' }]}
              disabled={isRollingDice}
              onPress={handleRollDice}
            >
              <Ionicons name="dice" size={22} color="#FFFFFF" />
              <Text style={[typography.titleSmall, { color: '#FFFFFF', marginLeft: 8 }]}>
                {isRollingDice ? 'Zarlar Yuvarlanıyor...' : 'ZARLARI AT! 🎲'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Roll History */}
          {diceHistory.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: 8 }]}>
                Son Zar Geçmişi
              </Text>
              {diceHistory.map((h) => (
                <View key={h.id} style={styles.historyRow}>
                  <Text style={[typography.bodyMedium, { color: theme.textPrimary }]}>
                    {h.count}x {h.diceType.toUpperCase()} ({h.values.join(' + ')})
                  </Text>
                  <Text style={[typography.titleSmall, { color: theme.primary }]}>= {h.total}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ======================================================= */}
      {/* CELEBRATION WINNER MODAL                                */}
      {/* ======================================================= */}
      <Modal visible={winnerModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.winnerModalCard, { backgroundColor: theme.surface }]}>
            <Text style={{ fontSize: 44, marginBottom: 8 }}>🎉</Text>
            <Text style={[typography.titleLarge, { color: theme.textPrimary, fontWeight: '800' }]}>
              KAZANAN SEÇİLDİ!
            </Text>
            <View style={[styles.winnerHighlightBox, { backgroundColor: winnerSlice?.color || theme.primary }]}>
              <Text style={styles.winnerHighlightText}>{winnerSlice?.label}</Text>
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, width: '100%' }]}
              onPress={() => setWinnerModalVisible(false)}
            >
              <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Harika! (Tamam)</Text>
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
  tabScrollRow: {
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
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  wheelContainer: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  wheelTopPointer: {
    position: 'absolute',
    top: 6,
    zIndex: 10,
    alignItems: 'center',
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
    transform: [{ rotate: '180deg' }],
  },
  wheelDisc: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    overflow: 'hidden',
  },
  sliceContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  sliceSectorLine: {
    position: 'absolute',
    width: 1,
    height: '50%',
    top: '50%',
  },
  sliceText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 20,
  },
  wheelCenterHub: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  spinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 18,
  },
  addSliceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sliceInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  addSliceBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slicesListWrap: {
    gap: 8,
  },
  sliceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  modeSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  listTextArea: {
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: 'top',
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallBox: {
    width: 60,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    marginBottom: 14,
  },
  winnerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  winnerMedal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamsGrid: {
    gap: 10,
  },
  teamCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  numInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputCol: {
    flex: 1,
  },
  inputBox: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  numCheckboxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  ballsResultCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ballsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginVertical: 10,
  },
  numberBall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  numberBallText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  coinWrapper: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
  },
  coinsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  coinDisc: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  coinFlippingAnim: {
    transform: [{ scaleX: 0.2 }, { scaleY: 1.1 }],
  },
  coinInnerBorder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinSideLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350F',
  },
  coinCountPicker: {
    alignItems: 'center',
    marginVertical: 12,
  },
  coinCountChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  coinCountChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 10,
  },
  diceBoard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
  },
  diceWrap: {
    flexDirection: 'row',
    gap: 14,
    marginVertical: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  diceCube: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  diceValueText: {
    fontSize: 28,
    fontWeight: '800',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  winnerModalCard: {
    width: '100%',
    maxWidth: 340,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  winnerHighlightBox: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  winnerHighlightText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalSubmitBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
