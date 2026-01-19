import { useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { ScanResult, Settings, FilterType } from '@/types/scan';
import { translations } from '@/constants/translations';

const STORAGE_KEYS = {
  SCANS: 'reail_scans',
  SETTINGS: 'reail_settings',
};

const defaultSettings: Settings = {
  language: 'en',
  privacyMode: true,
  saveHistory: true,
  autoDelete: 'never',
  advancedScan: false,
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) as Settings : defaultSettings;
    },
  });

  const scansQuery = useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCANS);
      return stored ? JSON.parse(stored) as ScanResult[] : [];
    },
  });

  const settings = settingsQuery.data ?? defaultSettings;
  const scans = useMemo(() => scansQuery.data ?? [], [scansQuery.data]);

  const t = useMemo(() => translations[settings.language], [settings.language]);

  const { mutate: updateSettingsMutate } = useMutation({
    mutationFn: async (newSettings: Partial<Settings>) => {
      const updated = { ...settings, ...newSettings };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
    },
  });

  const { mutate: addScanMutate } = useMutation({
    mutationFn: async (scan: ScanResult) => {
      if (!settings.saveHistory) return scans;
      const updated = [scan, ...scans];
      await AsyncStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['scans'], data);
    },
  });

  const { mutate: clearHistoryMutate } = useMutation({
    mutationFn: async () => {
      await AsyncStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify([]));
      return [];
    },
    onSuccess: () => {
      queryClient.setQueryData(['scans'], []);
    },
  });

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    updateSettingsMutate(newSettings);
  }, [updateSettingsMutate]);

  const addScan = useCallback((scan: ScanResult) => {
    addScanMutate(scan);
  }, [addScanMutate]);

  const clearHistory = useCallback(() => {
    clearHistoryMutate();
  }, [clearHistoryMutate]);

  const getLastScan = useCallback(() => {
    return scans.length > 0 ? scans[0] : null;
  }, [scans]);

  const getFilteredScans = useCallback((filter: FilterType) => {
    if (filter === 'all') return scans;
    const badgeMap: Record<FilterType, string> = {
      all: '',
      verified: 'VERIFIED',
      unverified: 'UNVERIFIED',
      high_risk: 'HIGH_RISK',
    };
    return scans.filter(scan => scan.badge === badgeMap[filter]);
  }, [scans]);

  return {
    settings,
    scans,
    t,
    currentScan,
    setCurrentScan,
    updateSettings,
    addScan,
    clearHistory,
    getLastScan,
    getFilteredScans,
    isLoading: settingsQuery.isLoading || scansQuery.isLoading,
  };
});
