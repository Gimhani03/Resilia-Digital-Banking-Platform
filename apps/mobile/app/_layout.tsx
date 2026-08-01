import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { colors } from "../src/theme";

const PUBLIC_SEGMENTS = new Set([
  "signin",
  "onboarding",
  "forgot-password",
  "reset-password",
  "help",
]);

/**
 * Auth-only entry screens — bounce signed-in users away. Onboarding is absent
 * on purpose: signed-in customers can still open the e-KYC flow from Help to
 * enrol another account.
 */
const AUTH_ENTRY_SEGMENTS = new Set([
  "signin",
  "forgot-password",
  "reset-password",
]);

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const root = segments[0] as string | undefined;
    const inPublic = !!root && PUBLIC_SEGMENTS.has(root);
    const inAuthEntry = !!root && AUTH_ENTRY_SEGMENTS.has(root);
    if (!token && !inPublic) router.replace("/signin");
    if (token && inAuthEntry) router.replace("/(tabs)");
  }, [ready, token, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.crimson} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Fraunces_700Bold,
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.crimson} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Gate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.white },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="signin" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="help" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transfer/index" />
          <Stack.Screen name="transfer/amount" />
          <Stack.Screen name="transfer/confirm" />
          <Stack.Screen name="transfer/internal" />
          <Stack.Screen name="transfer-receipt" />
          <Stack.Screen name="beneficiaries/index" />
          <Stack.Screen name="beneficiaries/new" />
          <Stack.Screen name="accounts/index" />
          <Stack.Screen name="accounts/[id]" />
          <Stack.Screen name="bills/index" />
          <Stack.Screen name="bills/[code]" />
          <Stack.Screen name="qr-pay" />
          <Stack.Screen name="history/index" />
          <Stack.Screen name="history/[id]" />
          <Stack.Screen name="statements" />
          <Stack.Screen name="held/[id]" />
          <Stack.Screen name="security" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile-edit" />
          <Stack.Screen name="loans/index" />
          <Stack.Screen name="loans/apply" />
          <Stack.Screen name="loans/[id]" />
        </Stack>
      </Gate>
    </AuthProvider>
  );
}
