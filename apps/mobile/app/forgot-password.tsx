import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
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
import { api } from "../src/lib/api";
import { colors, fonts } from "../src/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <ScreenHeader title="Reset password" onBack={() => router.back()} />
          <HeroTitle>Forgot password?</HeroTitle>
          <Sub>
            Enter your username or National ID. We will send a reset code to your
            registered email and mobile.
          </Sub>
          {!sent ? (
            <>
              <Field label="National ID / Username">
                <Input
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholder="a.perera.2065"
                  accessibilityLabel="Username"
                />
              </Field>
              <ErrorBanner message={error} />
              <Button
                title="Send reset code"
                onPress={submit}
                loading={loading}
                disabled={!username}
              />
            </>
          ) : (
            <>
              <Text style={styles.ok}>
                If an account exists, a reset code has been sent. Enter it on the
                next screen.
              </Text>
              <Button
                title="Enter reset code"
                onPress={() =>
                  router.push({
                    pathname: "/reset-password",
                    params: { username },
                  })
                }
              />
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
    lineHeight: 21,
    marginBottom: 16,
  },
});
