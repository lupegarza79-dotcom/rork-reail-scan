import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { ScanResult, Settings, FilterType } from '@/types/scan';
import { translations } from '@/constants/translations';

const RATE_LIMIT_KEY = 'reail_rate_limits';
const MAX_SCANS_PER_HOUR = 20;
const MAX_REPORTS_PER_DAY = 5;

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

interface RateLimits {
  scanTimestamps: number[];
  reportTimestamps: number[];
}

function redactUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'redacted';
  }
}

function filterOldScans(scans: ScanResult[], autoDelete: '7' | '30' | 'never'): ScanResult[] {
  if (autoDelete === 'never') return scans;
  
  const days = autoDelete === '7' ? 7 : 30;
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  return scans.filter(scan => scan.timestamp > cutoffTime);
}

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimits>({ scanTimestamps: [], reportTimestamps: [] });
  const autoDeleteApplied = useRef(false);

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

  const rateLimitsQuery = useQuery({
    queryKey: ['rateLimits'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      return stored ? JSON.parse(stored) as RateLimits : { scanTimestamps: [], reportTimestamps: [] };
    },
  });

  useEffect(() => {
    if (rateLimitsQuery.data) {
      setRateLimits(rateLimitsQuery.data);
    }
  }, [rateLimitsQuery.data]);

  const settings = settingsQuery.data ?? defaultSettings;
  const scans = useMemo(() => scansQuery.data ?? [], [scansQuery.data]);

  useEffect(() => {
    if (!autoDeleteApplied.current && scans.length > 0 && settings.autoDelete !== 'never') {
      autoDeleteApplied.current = true;
      const filtered = filterOldScans(scans, settings.autoDelete);
      if (filtered.length !== scans.length) {
        console.log(`Auto-delete: Removed ${scans.length - filtered.length} old scans`);
        AsyncStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(filtered));
        queryClient.setQueryData(['scans'], filtered);
      }
    }
  }, [scans, settings.autoDelete, queryClient]);

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
      
      let scanToStore = { ...scan };
      if (settings.privacyMode) {
        scanToStore = {
          ...scan,
          url: redactUrl(scan.url),
        };
      }
      
      const updated = [scanToStore, ...scans];
      await AsyncStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['scans'], data);
    },
  });

  const { mutate: updateRateLimitsMutate } = useMutation({
    mutationFn: async (newLimits: RateLimits) => {
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newLimits));
      return newLimits;
    },
    onSuccess: (data) => {
      setRateLimits(data);
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

  const canScan = useCallback((): boolean => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentScans = rateLimits.scanTimestamps.filter(ts => ts > oneHourAgo);
    return recentScans.length < MAX_SCANS_PER_HOUR;
  }, [rateLimits.scanTimestamps]);

  const canReport = useCallback((): boolean => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentReports = rateLimits.reportTimestamps.filter(ts => ts > oneDayAgo);
    return recentReports.length < MAX_REPORTS_PER_DAY;
  }, [rateLimits.reportTimestamps]);

  const recordScan = useCallback(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentScans = rateLimits.scanTimestamps.filter(ts => ts > oneHourAgo);
    const newLimits = {
      ...rateLimits,
      scanTimestamps: [...recentScans, Date.now()],
    };
    updateRateLimitsMutate(newLimits);
  }, [rateLimits, updateRateLimitsMutate]);

  const recordReport = useCallback(() => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentReports = rateLimits.reportTimestamps.filter(ts => ts > oneDayAgo);
    const newLimits = {
      ...rateLimits,
      reportTimestamps: [...recentReports, Date.now()],
    };
    updateRateLimitsMutate(newLimits);
  }, [rateLimits, updateRateLimitsMutate]);

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
    canScan,
    canReport,
    recordScan,
    recordReport,
    isLoading: settingsQuery.isLoading || scansQuery.isLoading,
  };
});
