import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BrandMark,
  Button,
  ErrorBanner,
  Field,
  HeroTitle,
  Input,
  Screen,
  Sub,
  TrustPill,
} from "../src/components/ui";
import {
  DEMO_OTP,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  api,
  deviceFingerprint,
  isDemoMode,
} from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, fonts } from "../src/theme";

type Method = "authenticator" | "sms" | "biometric";

export default function SignInScreen() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState(false);
  const [method, setMethod] = useState<Method>("authenticator");
  const [code, setCode] = useState(isDemoMode ? DEMO_OTP : "");
  const [totpSetup, setTotpSetup] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startLogin() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{
        challengeId: string;
        newDevice: boolean;
        totpSetup?: { secret: string; otpauthUrl: string };
        demoOtp?: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          deviceFingerprint: deviceFingerprint(),
          deviceName: "RESILIA Mobile",
          platform: "React Native",
          location: "Colombo",
        }),
      });
      setChallengeId(res.challengeId);
      setNewDevice(res.newDevice);
      if (res.totpSetup) setTotpSetup(res.totpSetup);
      if (isDemoMode && res.demoOtp) setCode(res.demoOtp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!challengeId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<{
        accessToken: string;
        refreshToken?: string;
        user: {
          id: string;
          username: string;
          fullName: string;
          nationalId?: string;
          email?: string;
          phone?: string;
          phoneLast4?: string;
          address?: string;
          role?: string;
          kycStatus?: string;
        };
      }>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({
          challengeId,
          code,
          method,
          deviceFingerprint: deviceFingerprint(),
        }),
      });
      await setSession(res.accessToken, res.user, res.refreshToken);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "MFA failed");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setUsername(DEMO_USERNAME);
    setPassword(DEMO_PASSWORD);
    setCode(DEMO_OTP);
  }

  const methods: { id: Method; label: string; hint: string; icon: string }[] = [
    { id: "authenticator", label: "Authenticator app", hint: "Recommended · 6-digit code", icon: "◉" },
    { id: "sms", label: "SMS OTP", hint: "Sent to registered mobile", icon: "◎" },
    { id: "biometric", label: "Biometric", hint: "Face ID / fingerprint", icon: "✦" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Screen>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BrandMark />
              <Text style={styles.brand}>RESILIA</Text>
            </View>
            <Link href="/help" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Help">
                <Text style={styles.help}>Help</Text>
              </Pressable>
            </Link>
          </View>

          {newDevice && challengeId ? (
            <TrustPill>⚠ New device detected · extra verification required</TrustPill>
          ) : null}
          <HeroTitle>Welcome back</HeroTitle>
          <Sub>
            Sign in with your password, then complete multi-factor authentication
            to access your accounts.
          </Sub>

          {!challengeId ? (
            <>
              <Field label="National ID / Username">
                <Input
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Enter username"
                  accessibilityLabel="Username"
                />
              </Field>
              <Field label="Password">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Enter password"
                  accessibilityLabel="Password"
                />
              </Field>
              <Link href="/forgot-password" asChild>
                <Pressable accessibilityRole="link" style={{ marginBottom: 10 }}>
                  <Text style={styles.forgot}>Forgot password?</Text>
                </Pressable>
              </Link>
              <ErrorBanner message={error} />
              <Button
                title="Continue to MFA"
                onPress={startLogin}
                loading={loading}
                disabled={!username || !password}
              />
              <Link href="/onboarding" asChild>
                <Pressable accessibilityRole="link" style={{ marginTop: 12 }}>
                  <Text style={styles.openAccount}>New to RESILIA? Open an account</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              {totpSetup ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.section}>Enrol authenticator</Text>
                  <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 13, color: "#5c5c72", marginBottom: 8 }}>
                    Add this secret in Google Authenticator / Authy before verifying.
                  </Text>
                  <Text selectable style={{ fontFamily: "Manrope_800ExtraBold", fontSize: 14, color: "#1a1a2e", letterSpacing: 1 }}>
                    {totpSetup.secret}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.section}>Choose MFA method</Text>
              {methods.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setMethod(m.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: method === m.id }}
                  accessibilityLabel={m.label}
                  style={[styles.mfa, method === m.id && styles.mfaActive]}
                >
                  <View style={styles.mfaIcon}>
                    <Text style={{ color: colors.white }}>{m.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mfaLabel}>{m.label}</Text>
                    <Text style={styles.mfaHint}>{m.hint}</Text>
                  </View>
                </Pressable>
              ))}
              <Field label="Authenticator code">
                <Input
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder="••••••"
                  accessibilityLabel="MFA code"
                  style={{
                    letterSpacing: 6,
                    textAlign: "center",
                    fontFamily: fonts.sansExtra,
                  }}
                />
              </Field>
              <ErrorBanner message={error} />
              <Button
                title="Verify & continue"
                onPress={verify}
                loading={loading}
                disabled={code.length < 4}
              />
              <Button
                title="← Back"
                variant="ghost"
                onPress={() => setChallengeId(null)}
              />
            </>
          )}

          {isDemoMode ? (
          <Pressable onPress={fillDemo} accessibilityLabel="Fill demo credentials">
            <Text style={styles.demoHint}>
              Judges: tap to fill demo · {DEMO_USERNAME} / OTP {DEMO_OTP}
            </Text>
          </Pressable>
          ) : null}
          <Text style={styles.footer}>
            Protected by HSM-backed identity · Session expires in 15 min
          </Text>
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: {
    fontFamily: fonts.sansExtra,
    color: colors.navy,
    letterSpacing: 0.5,
  },
  help: { fontFamily: fonts.sansBold, color: colors.crimson, fontSize: 13 },
  forgot: {
    fontFamily: fonts.sansBold,
    color: colors.crimson,
    fontSize: 13,
    textAlign: "right",
  },
  openAccount: {
    fontFamily: fonts.sansBold,
    color: colors.navy,
    fontSize: 13,
    textAlign: "center",
  },
  section: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    textTransform: "uppercase",
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  mfa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    marginBottom: 10,
  },
  mfaActive: {
    borderColor: colors.crimson,
    backgroundColor: colors.crimsonSoft,
  },
  mfaIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  mfaLabel: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 14 },
  mfaHint: { fontFamily: fonts.sans, color: colors.muted, fontSize: 12 },
  demoHint: {
    textAlign: "center",
    marginTop: 18,
    fontSize: 11,
    color: colors.muted,
    fontFamily: fonts.sans,
    lineHeight: 16,
  },
  footer: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 11,
    color: colors.muted,
    fontFamily: fonts.sans,
  },
});
