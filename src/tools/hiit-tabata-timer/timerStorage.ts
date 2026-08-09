import { storageRepository } from '../../core/storage/storageRepository';
import { WorkoutPreset } from './types';

const STORAGE_KEY_PRESETS = '@gundelik/hiit_presets_v1';

export const DEFAULT_WORKOUT_PRESETS: WorkoutPreset[] = [
  {
    id: 'preset_tabata',
    name: 'Klasik Tabata',
    description: '20 sn çalışma, 10 sn dinlenme • 8 set',
    prepTime: 10,
    workTime: 20,
    restTime: 10,
    sets: 8,
    rounds: 1,
    restBetweenRounds: 0,
    isCustom: false,
  },
  {
    id: 'preset_hiit',
    name: 'HIIT Kardiyo',
    description: '40 sn çalışma, 20 sn dinlenme • 5 set x 3 tur',
    prepTime: 10,
    workTime: 40,
    restTime: 20,
    sets: 5,
    rounds: 3,
    restBetweenRounds: 60,
    isCustom: false,
  },
  {
    id: 'preset_quick',
    name: 'Hızlı Antrenman',
    description: '30 sn çalışma, 15 sn dinlenme • 4 set x 2 tur',
    prepTime: 5,
    workTime: 30,
    restTime: 15,
    sets: 4,
    rounds: 2,
    restBetweenRounds: 30,
    isCustom: false,
  },
  {
    id: 'preset_mobility',
    name: 'Esnetme & Mobilite',
    description: '45 sn hareket, 15 sn geçiş • 6 set',
    prepTime: 10,
    workTime: 45,
    restTime: 15,
    sets: 6,
    rounds: 1,
    restBetweenRounds: 0,
    isCustom: false,
  },
];

/**
 * Loads workout presets (defaults + saved custom).
 */
export async function getWorkoutPresets(): Promise<WorkoutPreset[]> {
  const customPresets = await storageRepository.get<WorkoutPreset[]>(
    STORAGE_KEY_PRESETS,
    []
  );
  return [...DEFAULT_WORKOUT_PRESETS, ...customPresets];
}

/**
 * Saves a new custom workout preset.
 */
export async function saveCustomPreset(preset: WorkoutPreset): Promise<WorkoutPreset[]> {
  const customPresets = await storageRepository.get<WorkoutPreset[]>(
    STORAGE_KEY_PRESETS,
    []
  );
  const updated = [
    ...customPresets.filter((p) => p.id !== preset.id),
    { ...preset, isCustom: true },
  ];
  await storageRepository.set(STORAGE_KEY_PRESETS, updated);
  return [...DEFAULT_WORKOUT_PRESETS, ...updated];
}

/**
 * Deletes a custom preset.
 */
export async function deleteCustomPreset(id: string): Promise<WorkoutPreset[]> {
  const customPresets = await storageRepository.get<WorkoutPreset[]>(
    STORAGE_KEY_PRESETS,
    []
  );
  const updated = customPresets.filter((p) => p.id !== id);
  await storageRepository.set(STORAGE_KEY_PRESETS, updated);
  return [...DEFAULT_WORKOUT_PRESETS, ...updated];
}
