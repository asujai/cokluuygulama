export interface WheelSlice {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

export interface WheelPreset {
  id: string;
  title: string;
  slices: { label: string; color: string }[];
}

export interface CoinFlipStats {
  total: number;
  heads: number;
  tails: number;
  currentStreak: number;
  streakType: 'heads' | 'tails' | null;
}

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceRollResult {
  id: string;
  diceType: DiceType;
  count: number;
  values: number[];
  total: number;
  min: number;
  max: number;
  average: number;
  timestamp: number;
}
