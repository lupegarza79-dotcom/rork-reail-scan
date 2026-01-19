import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { FilterType, ScanResult } from '@/types/scan';
import ScanCard from '@/components/ScanCard';

const FILTERS: { key: FilterType; labelKey: 'all' | 'verified' | 'unverified' | 'highRisk' }[] = [
  { key: 'all', labelKey: 'all' },
  { key: 'verified', labelKey: 'verified' },
  { key: 'unverified', labelKey: 'unverified' },
  { key: 'high_risk', labelKey: 'highRisk' },
];

export default function HistoryScreen() {
  const router = useRouter();
  const { t, getFilteredScans, setCurrentScan, clearHistory } = useApp();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredScans = useMemo(() => {
    const scans = getFilteredScans(activeFilter);
    if (!searchQuery.trim()) return scans;
    return scans.filter(scan => 
      scan.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.url.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [getFilteredScans, activeFilter, searchQuery]);

  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, []);

  const handleViewScan = useCallback((scan: ScanResult) => {
    setCurrentScan(scan);
    router.push('/result');
  }, [setCurrentScan, router]);

  const handleShareScan = useCallback(async (scan: ScanResult) => {
    try {
      const badgeText = scan.badge === 'VERIFIED' ? '✅' : scan.badge === 'UNVERIFIED' ? '⚠️' : '❌';
      const message = `${badgeText} REAiL Scan Result\n\nDomain: ${scan.domain}\nTrust Score: ${scan.score}/100\n\nVerified by REAiL Scan`;
      await Share.share({ message });
    } catch (error) {
      console.log('Share error:', error);
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      t.clearHistory,
      'Are you sure you want to clear all scan history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            clearHistory();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        },
      ]
    );
  }, [clearHistory, t]);

  const getFilterLabel = (labelKey: 'all' | 'verified' | 'unverified' | 'highRisk') => {
    const labels = {
      all: t.all,
      verified: '✓',
      unverified: '⚠',
      highRisk: '✕',
    };
    return labels[labelKey];
  };

  const renderItem = useCallback(({ item }: { item: ScanResult }) => (
    <View style={styles.cardWrapper}>
      <ScanCard
        scan={item}
        onPress={() => handleViewScan(item)}
        onShare={() => handleShareScan(item)}
      />
    </View>
  ), [handleViewScan, handleShareScan]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{t.noScansYet}</Text>
      <Text style={styles.emptySubtitle}>{t.startScanning}</Text>
    </View>
  ), [t]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.myScans}</Text>
          {filteredScans.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton}>
              <Trash2 size={20} color={Colors.highRisk} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search scans..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filtersContainer}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                activeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange(filter.key)}
            >
              <Text style={[
                styles.filterText,
                activeFilter === filter.key && styles.filterTextActive,
              ]}>
                {getFilterLabel(filter.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredScans}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  clearButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: Colors.text,
    marginLeft: 10,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
