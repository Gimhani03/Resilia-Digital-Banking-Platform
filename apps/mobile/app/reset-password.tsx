import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  ErrorBanner,
  Field,
  HeroTitle,
  Input,
  Screen,
  ScreenHeader,
  Sub,
} from "../src/components/ui";
import { DEMO_OTP, api } from "../src/lib/api";
import { colors, fonts } from "../src/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { username: usernameParam } = useLocalSearchParams<{ username?: string }>();
  const [username, setUsername] = useState(usernameParam || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ username, code, password }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <ScreenHeader title="New password" onBack={() => router.back()} />
          <HeroTitle>Set a new password</HeroTitle>
          <Sub>Use the reset code from email or SMS, then choose a strong password.</Sub>

          {done ? (
            <>
              <Text style={styles.ok}>Password updated. You can sign in now.</Text>
              <Button title="Back to sign in" onPress={() => router.replace("/signin")} />
            </>
          ) : (
            <>
              <Field label="Username">
                <Input
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  accessibilityLabel="Username"
                />
              </Field>
              <Field label="Reset code">
                <Input
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder="6-digit code"
                  accessibilityLabel="Reset code"
                />
              </Field>
              <Field label="New password">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  accessibilityLabel="New password"
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  accessibilityLabel="Confirm password"
                />
              </Field>
              <ErrorBanner message={error} />
              <Button
                title="Update password"
                onPress={submit}
                loading={loading}
                disabled={!username || !code || !password}
              />
              <Text style={styles.hint}>Demo reset code · {DEMO_OTP}</Text>
            </>
          )}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ok: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ok,
    marginBottom: 16,
    lineHeight: 21,
  },
  hint: {
    marginTop: 14,
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
  },
});
