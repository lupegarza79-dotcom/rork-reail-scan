import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function ShareLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="refund"
        options={{
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
