export type PrompterPosition = 'top' | 'center' | 'full';

export interface PrompterConfig {
  fontSize: number; // 18 - 48
  scrollSpeed: number; // 1 - 5 (1x - 5x)
  opacity: number; // 0.2 - 1.0
  position: PrompterPosition;
  mirrorMode: boolean; // Horizontal flip for glass teleprompters
  voiceFollow: boolean; // Voice-follow auto-scroll mode
  countdownSeconds: number; // 3, 5, etc.
}

export interface SampleSpeech {
  id: string;
  title: string;
  category: string;
  durationEst: string;
  script: string;
}

export interface PrompterState {
  isPrompterActive: boolean;
  isCountingDown: boolean;
  countdownValue: number;
  isRecording: boolean;
  isScrolling: boolean;
  recordingDurationSec: number;
  recordedVideoUri: string | null;
  activeWordIndex: number;
}
