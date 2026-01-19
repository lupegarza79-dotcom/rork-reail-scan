import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Globe, 
  Shield, 
  Clock, 
  Zap, 
  HelpCircle, 
  FileText,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

const AUTO_DELETE_OPTIONS = [
  { value: '7' as const, labelKey: 'days7' as const },
  { value: '30' as const, labelKey: 'days30' as const },
  { value: 'never' as const, labelKey: 'never' as const },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { t, settings, updateSettings } = useApp();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const toggleLanguage = useCallback(() => {
    const newLang = settings.language === 'en' ? 'es' : 'en';
    updateSettings({ language: newLang });
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, [settings.language, updateSettings]);

  const togglePrivacyMode = useCallback(() => {
    updateSettings({ privacyMode: !settings.privacyMode });
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, [settings.privacyMode, updateSettings]);

  const toggleSaveHistory = useCallback(() => {
    updateSettings({ saveHistory: !settings.saveHistory });
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, [settings.saveHistory, updateSettings]);

  const toggleAdvancedScan = useCallback(() => {
    updateSettings({ advancedScan: !settings.advancedScan });
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, [settings.advancedScan, updateSettings]);

  const handleAutoDeleteChange = useCallback((value: '7' | '30' | 'never') => {
    updateSettings({ autoDelete: value });
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, [updateSettings]);

  const handleHowItWorks = useCallback(() => {
    Linking.openURL('https://reail.app/how-it-works');
  }, []);

  const handleLegal = useCallback(() => {
    Linking.openURL('https://reail.app/legal');
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.settings}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.language}</Text>
            <TouchableOpacity style={styles.settingRow} onPress={toggleLanguage}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Globe size={20} color={Colors.accent} />
                </View>
                <Text style={styles.settingLabel}>{t.language}</Text>
              </View>
              <View style={styles.languageToggle}>
                <Text style={[
                  styles.langOption,
                  settings.language === 'en' && styles.langOptionActive,
                ]}>EN</Text>
                <Text style={styles.langDivider}>|</Text>
                <Text style={[
                  styles.langOption,
                  settings.language === 'es' && styles.langOptionActive,
                ]}>ES</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Shield size={20} color={Colors.verified} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>{t.privacyMode}</Text>
                  <Text style={styles.settingDescription}>Do not store scan URLs</Text>
                </View>
              </View>
              <Switch
                value={settings.privacyMode}
                onValueChange={togglePrivacyMode}
                trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
                thumbColor={Colors.text}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Clock size={20} color={Colors.unverified} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>{t.saveHistoryLabel}</Text>
                  <Text style={styles.settingDescription}>Keep scan records</Text>
                </View>
              </View>
              <Switch
                value={settings.saveHistory}
                onValueChange={toggleSaveHistory}
                trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
                thumbColor={Colors.text}
              />
            </View>

            <View style={styles.settingRowColumn}>
              <Text style={styles.settingLabel}>{t.autoDelete}</Text>
              <View style={styles.autoDeleteOptions}>
                {AUTO_DELETE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.autoDeleteOption,
                      settings.autoDelete === option.value && styles.autoDeleteOptionActive,
                    ]}
                    onPress={() => handleAutoDeleteChange(option.value)}
                  >
                    <Text style={[
                      styles.autoDeleteText,
                      settings.autoDelete === option.value && styles.autoDeleteTextActive,
                    ]}>
                      {t[option.labelKey]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scanning</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Zap size={20} color={Colors.accentSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>{t.advancedScan}</Text>
                  <Text style={styles.settingDescription}>Deep analysis takes longer</Text>
                </View>
              </View>
              <Switch
                value={settings.advancedScan}
                onValueChange={toggleAdvancedScan}
                trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
                thumbColor={Colors.text}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Info</Text>
            
            <TouchableOpacity style={styles.settingRow} onPress={handleHowItWorks}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <HelpCircle size={20} color={Colors.textSecondary} />
                </View>
                <Text style={styles.settingLabel}>{t.howItWorks}</Text>
              </View>
              <ChevronRight size={20} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={handleLegal}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <FileText size={20} color={Colors.textSecondary} />
                </View>
                <Text style={styles.settingLabel}>{t.legal}</Text>
              </View>
              <ChevronRight size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.versionText}>REAiL Scan v1.0.0</Text>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  settingRowColumn: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langOption: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    paddingHorizontal: 4,
  },
  langOptionActive: {
    color: Colors.primary,
  },
  langDivider: {
    color: Colors.textTertiary,
    marginHorizontal: 4,
  },
  autoDeleteOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  autoDeleteOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
  },
  autoDeleteOptionActive: {
    backgroundColor: Colors.primary,
  },
  autoDeleteText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  autoDeleteTextActive: {
    color: Colors.text,
  },
  versionText: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 20,
  },
});
