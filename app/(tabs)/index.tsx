import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Clipboard,
  Alert,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Image, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import Logo from '@/components/Logo';
import PlatformChip from '@/components/PlatformChip';
import ScanCard from '@/components/ScanCard';
import { useApp } from '@/contexts/AppContext';

const PLATFORMS = ['TikTok', 'Instagram', 'Facebook', 'YouTube', 'News', 'Shop'];

interface AnimatedButtonProps {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
}

function AnimatedButton({ onPress, style, children }: AnimatedButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, getLastScan, setCurrentScan } = useApp();
  const [linkInput, setLinkInput] = useState('');
  const lastScan = getLastScan();

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setLinkInput(text);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.log('Paste error:', error);
    }
  }, []);

  const handleScan = useCallback(() => {
    if (!linkInput.trim()) {
      Alert.alert('Enter a link', 'Please paste a link to scan.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push({ pathname: '/scanning', params: { url: linkInput.trim() } });
  }, [linkInput, router]);

  const handleShareToScan = useCallback(() => {
    router.push('/share-tutorial');
  }, [router]);

  const handleUploadScreenshot = useCallback(() => {
    Alert.alert('Upload Screenshot', 'Screenshot scanning will be available soon.');
  }, []);

  const handlePlatformChip = useCallback((platform: string) => {
    const sampleUrls: Record<string, string> = {
      TikTok: 'https://tiktok.com/@user/video/123',
      Instagram: 'https://instagram.com/p/example',
      Facebook: 'https://facebook.com/post/123',
      YouTube: 'https://youtube.com/watch?v=example',
      News: 'https://news-site.com/article/headline',
      Shop: 'https://shop.example.com/product/123',
    };
    setLinkInput(sampleUrls[platform] || '');
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, []);

  const handleViewLastScan = useCallback(() => {
    if (lastScan) {
      setCurrentScan(lastScan);
      router.push('/result');
    }
  }, [lastScan, setCurrentScan, router]);

  const handleSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Logo size="small" />
            <Text style={styles.headerTitle}>{t.scan}</Text>
            <TouchableOpacity onPress={handleSettings} style={styles.settingsButton}>
              <Settings size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <Text style={styles.headline}>{t.headline}</Text>
            <Text style={styles.subheadline}>{t.subheadline}</Text>
            <Text style={styles.tagline}>{t.tagline}</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t.placeholder}
              placeholderTextColor={Colors.textTertiary}
              value={linkInput}
              onChangeText={setLinkInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
              <Text style={styles.pasteText}>{t.paste}</Text>
            </TouchableOpacity>
          </View>

          <AnimatedButton onPress={handleScan} style={styles.scanButton}>
            <Text style={styles.scanButtonText}>✓ {t.scanNow}</Text>
          </AnimatedButton>

          <View style={styles.secondaryActions}>
            <AnimatedButton onPress={handleShareToScan} style={styles.secondaryButton}>
              <Share2 size={18} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>{t.shareToScan}</Text>
            </AnimatedButton>
            <AnimatedButton onPress={handleUploadScreenshot} style={styles.secondaryButton}>
              <Image size={18} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>{t.uploadScreenshot}</Text>
            </AnimatedButton>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContainer}
          >
            {PLATFORMS.map((platform) => (
              <PlatformChip
                key={platform}
                label={platform}
                onPress={() => handlePlatformChip(platform)}
              />
            ))}
          </ScrollView>

          {lastScan && (
            <View style={styles.lastScanSection}>
              <Text style={styles.sectionTitle}>{t.lastScan}</Text>
              <ScanCard
                scan={lastScan}
                onPress={handleViewLastScan}
                compact
              />
            </View>
          )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    padding: 8,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 36,
  },
  subheadline: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 15,
    color: Colors.text,
  },
  pasteButton: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  pasteText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primaryLight,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '50',
  },
  scanButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primaryLight,
  },
  chipsScroll: {
    marginBottom: 24,
    marginHorizontal: -20,
  },
  chipsContainer: {
    paddingHorizontal: 20,
  },
  lastScanSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
