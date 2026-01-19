import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <AlertCircle size={64} color={Colors.textTertiary} />
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.subtitle}>This screen does not exist.</Text>
        <Link href="/" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Go to Home</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
