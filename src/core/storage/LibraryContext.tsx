import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { STORAGE_KEYS } from './keys';
import { storageRepository } from './storageRepository';
import { getToolById, isToolEnabled, ToolDefinition } from '../../registry';

const MAX_RECENTS = 8;

interface LibraryContextValue {
  favoriteIds: string[];
  favoriteTools: ToolDefinition[];
  recentIds: string[];
  recentTools: ToolDefinition[];
  isHydrated: boolean;
  toggleFavorite: (toolId: string) => Promise<void>;
  isFavorite: (toolId: string) => boolean;
  addRecent: (toolId: string) => Promise<void>;
  clearRecents: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

interface LibraryProviderProps {
  children: ReactNode;
}

export const LibraryProvider: React.FC<LibraryProviderProps> = ({ children }) => {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate state from AsyncStorage on startup
  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const [savedFavorites, savedRecents] = await Promise.all([
          storageRepository.get<string[]>(STORAGE_KEYS.FAVORITES, []),
          storageRepository.get<string[]>(STORAGE_KEYS.RECENTS, []),
        ]);

        if (isMounted) {
          // Filter out stale or disabled tool IDs
          const validFavorites = Array.isArray(savedFavorites)
            ? savedFavorites.filter((id) => isToolEnabled(id))
            : [];

          const validRecents = Array.isArray(savedRecents)
            ? savedRecents.filter((id) => isToolEnabled(id)).slice(0, MAX_RECENTS)
            : [];

          setFavoriteIds(validFavorites);
          setRecentIds(validRecents);
          setIsHydrated(true);
        }
      } catch (error) {
        console.warn('[LibraryProvider] Hydration error:', error);
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFavorite = useCallback(
    async (toolId: string) => {
      if (!isToolEnabled(toolId)) return;

      setFavoriteIds((prev) => {
        const isFav = prev.includes(toolId);
        const updated = isFav ? prev.filter((id) => id !== toolId) : [...prev, toolId];
        // Persist
        storageRepository.set(STORAGE_KEYS.FAVORITES, updated);
        return updated;
      });
    },
    []
  );

  const isFavorite = useCallback(
    (toolId: string): boolean => {
      return favoriteIds.includes(toolId);
    },
    [favoriteIds]
  );

  const addRecent = useCallback(
    async (toolId: string) => {
      if (!isToolEnabled(toolId)) return;

      setRecentIds((prev) => {
        // Remove existing instance if already present to deduplicate
        const filtered = prev.filter((id) => id !== toolId);
        // Put most recent first, max 8
        const updated = [toolId, ...filtered].slice(0, MAX_RECENTS);
        // Persist
        storageRepository.set(STORAGE_KEYS.RECENTS, updated);
        return updated;
      });
    },
    []
  );

  const clearRecents = useCallback(async () => {
    setRecentIds([]);
    await storageRepository.remove(STORAGE_KEYS.RECENTS);
  }, []);

  // Compute ToolDefinition lists for active/enabled favorites & recents
  const favoriteTools = useMemo(() => {
    return favoriteIds
      .map((id) => getToolById(id))
      .filter((tool): tool is ToolDefinition => tool !== undefined && tool.enabled);
  }, [favoriteIds]);

  const recentTools = useMemo(() => {
    return recentIds
      .map((id) => getToolById(id))
      .filter((tool): tool is ToolDefinition => tool !== undefined && tool.enabled);
  }, [recentIds]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      favoriteIds,
      favoriteTools,
      recentIds,
      recentTools,
      isHydrated,
      toggleFavorite,
      isFavorite,
      addRecent,
      clearRecents,
    }),
    [
      favoriteIds,
      favoriteTools,
      recentIds,
      recentTools,
      isHydrated,
      toggleFavorite,
      isFavorite,
      addRecent,
      clearRecents,
    ]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useLibrary = (): LibraryContextValue => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
