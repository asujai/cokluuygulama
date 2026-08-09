export type TimerPhase = 'idle' | 'prep' | 'work' | 'rest' | 'roundRest' | 'completed';

export type TimerStatus = 'stopped' | 'running' | 'paused';

export interface WorkoutPreset {
  id: string;
  name: string;
  description?: string;
  prepTime: number; // in seconds
  workTime: number; // in seconds
  restTime: number; // in seconds
  sets: number;
  rounds: number;
  restBetweenRounds: number; // in seconds
  isCustom?: boolean;
}

export interface TimerStep {
  phase: TimerPhase;
  duration: number; // in seconds
  round: number;
  set: number;
  totalRounds: number;
  totalSets: number;
}

export interface PhaseThemeInfo {
  title: string;
  badge: string;
  backgroundColor: string;
  textColor: string;
  icon: string;
}
