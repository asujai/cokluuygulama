import { CategoryDefinition } from './types';

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'text',
    name: 'Metin',
    description: 'Metin analiz, sayım ve biçimlendirme araçları',
    icon: 'document-text-outline',
    order: 1,
    enabled: true,
    accentColor: '#2563EB',
  },
  {
    id: 'conversion',
    name: 'Dönüştürme',
    description: 'Birim, ölçü ve format dönüştürme araçları',
    icon: 'swap-horizontal-outline',
    order: 2,
    enabled: true,
    accentColor: '#059669',
  },
  {
    id: 'privacy',
    name: 'Gizlilik',
    description: 'Güçlü şifre üretici ve güvenlik araçları',
    icon: 'shield-checkmark-outline',
    order: 3,
    enabled: true,
    accentColor: '#7C3AED',
  },
  {
    id: 'calc',
    name: 'Hesaplama',
    description: 'Matematiksel ve pratik hesap araçları',
    icon: 'calculator-outline',
    order: 4,
    enabled: true,
    accentColor: '#D97706',
  },
  {
    id: 'daily',
    name: 'Günlük Araçlar',
    description: 'Pratik ve hızlı günlük yaşam yardımcıları',
    icon: 'grid-outline',
    order: 5,
    enabled: true,
    accentColor: '#0891B2',
  },
  {
    id: 'document',
    name: 'PDF & Dosya',
    description: 'Belge ve dosya yönetim yardımcıları',
    icon: 'folder-open-outline',
    order: 6,
    enabled: true,
    accentColor: '#EA580C',
  },
  {
    id: 'visual',
    name: 'Görsel',
    description: 'Görsel işleme ve boyutlandırma araçları',
    icon: 'image-outline',
    order: 7,
    enabled: true,
    accentColor: '#E11D48',
  },
];

export function getAllCategories(): CategoryDefinition[] {
  return CATEGORIES;
}

export function getAllEnabledCategories(): CategoryDefinition[] {
  return CATEGORIES.filter((category) => category.enabled).sort(
    (a, b) => a.order - b.order
  );
}

export function getCategoryById(id: string): CategoryDefinition | undefined {
  return CATEGORIES.find((cat) => cat.id === id && cat.enabled);
}

export function getCategoryName(id: string): string {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.name : id;
}
