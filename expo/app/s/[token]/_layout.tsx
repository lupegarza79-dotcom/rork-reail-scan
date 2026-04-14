import { Stack } from 'expo-router';

export default function ShareLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#050508' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="refund" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
