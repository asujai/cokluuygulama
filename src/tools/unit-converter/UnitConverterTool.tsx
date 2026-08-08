import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme';

interface Unit {
  id: string;
  name: string;
  symbol: string;
  toBaseMultiplier: number; // multiplier to convert 1 unit to meters
}

const LENGTH_UNITS: Unit[] = [
  { id: 'm', name: 'Metre', symbol: 'm', toBaseMultiplier: 1 },
  { id: 'km', name: 'Kilometre', symbol: 'km', toBaseMultiplier: 1000 },
  { id: 'cm', name: 'Santimetre', symbol: 'cm', toBaseMultiplier: 0.01 },
  { id: 'mm', name: 'Milimetre', symbol: 'mm', toBaseMultiplier: 0.001 },
  { id: 'mi', name: 'Mil', symbol: 'mi', toBaseMultiplier: 1609.344 },
  { id: 'ft', name: 'Fit', symbol: 'ft', toBaseMultiplier: 0.3048 },
  { id: 'in', name: 'İnç', symbol: 'in', toBaseMultiplier: 0.0254 },
  { id: 'yd', name: 'Yarda', symbol: 'yd', toBaseMultiplier: 0.9144 },
];

function formatNumber(num: number): string {
  if (isNaN(num)) return '-';
  if (Math.abs(num) >= 1e9 || (Math.abs(num) < 1e-4 && num !== 0)) {
    return num.toExponential(4).replace('.', ',');
  }
  // Remove unnecessary trailing zeroes
  const rounded = parseFloat(num.toFixed(6));
  return rounded.toString().replace('.', ',');
}

export const UnitConverterTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [inputValue, setInputValue] = useState('1');
  const [fromUnitId, setFromUnitId] = useState<string>('m');
  const [toUnitId, setToUnitId] = useState<string>('km');

  const fromUnit = useMemo(
    () => LENGTH_UNITS.find((u) => u.id === fromUnitId) || LENGTH_UNITS[0],
    [fromUnitId]
  );
  const toUnit = useMemo(
    () => LENGTH_UNITS.find((u) => u.id === toUnitId) || LENGTH_UNITS[1],
    [toUnitId]
  );

  // Parse input supporting Turkish comma and period
  const parsedState = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return { isValid: true, value: 0, isEmpty: true };
    }

    // Replace comma with dot
    const normalized = trimmed.replace(',', '.');

    // Check if it's a valid numeric string
    const num = Number(normalized);
    if (isNaN(num)) {
      return { isValid: false, value: 0, isEmpty: false };
    }

    return { isValid: true, value: num, isEmpty: false };
  }, [inputValue]);

  // Target converted value
  const convertedResult = useMemo(() => {
    if (!parsedState.isValid || parsedState.isEmpty) {
      return null;
    }
    const valueInMeters = parsedState.value * fromUnit.toBaseMultiplier;
    const valueInTarget = valueInMeters / toUnit.toBaseMultiplier;
    return valueInTarget;
  }, [parsedState, fromUnit, toUnit]);

  // All units overview
  const allConversions = useMemo(() => {
    if (!parsedState.isValid || parsedState.isEmpty) {
      return [];
    }
    const valueInMeters = parsedState.value * fromUnit.toBaseMultiplier;
    return LENGTH_UNITS.map((unit) => ({
      ...unit,
      convertedValue: valueInMeters / unit.toBaseMultiplier,
    }));
  }, [parsedState, fromUnit]);

  const handleSwap = () => {
    setFromUnitId(toUnitId);
    setToUnitId(fromUnitId);
  };

  const handleClear = () => {
    setInputValue('');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { padding: spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Input Section */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
          },
        ]}
      >
        <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
          Dönüştürülecek Değer
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: !parsedState.isValid ? theme.error : theme.inputBorder,
                borderRadius: borderRadius.md,
                color: theme.textPrimary,
                paddingHorizontal: spacing.md,
              },
            ]}
            keyboardType="numeric"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Örn: 10,5 veya 10.5"
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Dönüştürülecek sayı"
          />

          {inputValue.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              style={[
                styles.clearInputButton,
                { backgroundColor: theme.surfaceVariant, borderRadius: borderRadius.full },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Değeri temizle"
            >
              <Ionicons name="close" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {!parsedState.isValid && (
          <View style={[styles.errorBox, { backgroundColor: theme.errorContainer, borderRadius: borderRadius.xs, marginTop: spacing.xs }]}>
            <Ionicons name="alert-circle" size={16} color={theme.onErrorContainer} />
            <Text style={[typography.bodySmall, { color: theme.onErrorContainer, marginLeft: spacing.xs }]}>
              Lütfen geçerli bir sayısal değer girin (örn: 12,5 veya 12.5)
            </Text>
          </View>
        )}

        {/* Unit Selection Rows */}
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: spacing.xs }]}>
            Kaynak Birim
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitChipScroll}>
            {LENGTH_UNITS.map((unit) => {
              const isSelected = unit.id === fromUnitId;
              return (
                <TouchableOpacity
                  key={`from-${unit.id}`}
                  onPress={() => setFromUnitId(unit.id)}
                  style={[
                    styles.unitChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
                      borderRadius: borderRadius.full,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.md,
                      marginRight: spacing.xs,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Kaynak birim ${unit.name}`}
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: isSelected ? theme.onPrimary : theme.textPrimary },
                    ]}
                  >
                    {unit.name} ({unit.symbol})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Swap Button */}
        <View style={styles.swapContainer}>
          <TouchableOpacity
            onPress={handleSwap}
            style={[
              styles.swapButton,
              {
                backgroundColor: theme.primaryContainer,
                borderRadius: borderRadius.full,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Birimleri yer değiştir"
          >
            <Ionicons name="swap-vertical" size={22} color={theme.onPrimaryContainer} />
          </TouchableOpacity>
        </View>

        {/* Target Unit Row */}
        <View>
          <Text style={[typography.labelMedium, { color: theme.textSecondary, marginBottom: spacing.xs }]}>
            Hedef Birim
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitChipScroll}>
            {LENGTH_UNITS.map((unit) => {
              const isSelected = unit.id === toUnitId;
              return (
                <TouchableOpacity
                  key={`to-${unit.id}`}
                  onPress={() => setToUnitId(unit.id)}
                  style={[
                    styles.unitChip,
                    {
                      backgroundColor: isSelected ? theme.accent : theme.surfaceVariant,
                      borderRadius: borderRadius.full,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.md,
                      marginRight: spacing.xs,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Hedef birim ${unit.name}`}
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                    ]}
                  >
                    {unit.name} ({unit.symbol})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Main Result Card */}
      <View
        style={[
          styles.resultCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginTop: spacing.md,
          },
        ]}
      >
        <Text style={[typography.labelMedium, { color: theme.textSecondary }]}>
          Dönüşüm Sonucu
        </Text>
        <View style={styles.resultDisplayRow}>
          <Text
            style={[
              typography.titleLarge,
              {
                color: convertedResult !== null ? theme.primary : theme.textMuted,
                fontSize: 28,
                lineHeight: 36,
                marginTop: spacing.xs,
              },
            ]}
            numberOfLines={2}
          >
            {convertedResult !== null ? formatNumber(convertedResult) : '-'}
          </Text>
          <Text style={[typography.titleMedium, { color: theme.textSecondary, marginLeft: spacing.sm, marginTop: spacing.xs }]}>
            {toUnit.symbol}
          </Text>
        </View>

        {convertedResult !== null && (
          <Text style={[typography.bodySmall, { color: theme.textMuted, marginTop: spacing.xs }]}>
            1 {fromUnit.symbol} = {formatNumber(fromUnit.toBaseMultiplier / toUnit.toBaseMultiplier)} {toUnit.symbol}
          </Text>
        )}
      </View>

      {/* All Units Reference Table */}
      {allConversions.length > 0 && (
        <View
          style={[
            styles.tableCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typography.titleSmall, { color: theme.textPrimary, marginBottom: spacing.md }]}>
            Tüm Uzunluk Eşdeğerleri
          </Text>

          {allConversions.map((item) => (
            <View
              key={`overview-${item.id}`}
              style={[
                styles.tableRow,
                {
                  borderBottomColor: theme.divider,
                  paddingVertical: spacing.sm,
                },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: theme.textSecondary, flex: 1 }]}>
                {item.name} ({item.symbol})
              </Text>
              <Text style={[typography.bodyLarge, { color: theme.textPrimary, fontWeight: '600' }]}>
                {formatNumber(item.convertedValue)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
  },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    height: 48,
    fontSize: 18,
    fontWeight: '600',
  },
  clearInputButton: {
    position: 'absolute',
    right: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  unitChipScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  unitChip: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  swapButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    borderWidth: 1,
  },
  resultDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tableCard: {
    borderWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
});
