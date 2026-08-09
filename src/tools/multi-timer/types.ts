export interface StopwatchLap {
  id: string;
  lapNumber: number;
  lapTimeMs: number;
  totalTimeMs: number;
  diffVsPrevMs: number;
}

export type StopwatchStatus = 'idle' | 'running' | 'paused';

export interface MultiTimerItem {
  id: string;
  title: string;
  totalSeconds: number;
  remainingSeconds: number;
  status: 'idle' | 'running' | 'paused' | 'finished';
  color: string;
  category?: string;
  createdAt: number;
}

export interface TimerPreset {
  id: string;
  title: string;
  seconds: number;
  color: string;
  icon: string;
}
