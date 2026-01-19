import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Image, Share2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
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
  const { t, getLastScan, setCurrentScan, canScan } = useApp();
  const [linkInput, setLinkInput] = useState('');
  const lastScan = getLastScan();

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
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
    if (!canScan()) {
      Alert.alert('Rate Limit', t.rateLimitScans || 'You have reached the scan limit. Please try again later.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push({ pathname: '/scanning', params: { url: linkInput.trim() } });
  }, [linkInput, router, canScan, t]);

  const handleShareToScan = useCallback(() => {
    router.push('/share-tutorial');
  }, [router]);

  const handleUploadScreenshot = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload screenshots.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (!canScan()) {
          Alert.alert('Rate Limit', t.rateLimitScans || 'You have reached the scan limit. Please try again later.');
          return;
        }
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        router.push({ pathname: '/scanning', params: { mediaUri: result.assets[0].uri } });
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, [router, canScan, t]);

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

  const { height: screenHeight } = Dimensions.get('window');
  const isSmallScreen = screenHeight < 700;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              <View style={styles.header}>
                <Logo size="small" />
                <Text style={styles.headerTitle}>{t.scan}</Text>
                <TouchableOpacity onPress={handleSettings} style={styles.settingsButton}>
                  <Settings size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.hero}>
                <Text style={[styles.headline, isSmallScreen && styles.headlineSmall]}>{t.headline}</Text>
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
                  testID="link-input"
                />
                <TouchableOpacity style={styles.pasteButton} onPress={handlePaste} testID="paste-button">
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

              <View style={styles.chipsRow}>
                {PLATFORMS.map((platform) => (
                  <PlatformChip
                    key={platform}
                    label={platform}
                    onPress={() => handlePlatformChip(platform)}
                  />
                ))}
              </View>

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
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  headlineSmall: {
    fontSize: 22,
    lineHeight: 28,
  },
  subheadline: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 10,
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
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 54,
    fontSize: 15,
    color: Colors.text,
  },
  pasteButton: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primaryLight,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '40',
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
    gap: 10,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    height: 48,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primaryLight,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  lastScanSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
