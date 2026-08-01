import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  Screen,
  ScreenHeader,
  Sub,
} from "../../src/components/ui";
import { BANKS } from "@resilia/shared";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function NewBeneficiaryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState<string>(BANKS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError("");
    try {
      await api("/payments/payees", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          bankName,
          accountNumber,
          nickname,
        }),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save payee");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScreenHeader title="Add payee" onBack={() => router.back()} />
      <ScrollView>
        <Screen>
          <Sub>Save an other-bank beneficiary for instant transfers.</Sub>
          <ErrorBanner message={error} />
          <Field label="Account holder name">
            <Input value={name} onChangeText={setName} />
          </Field>
          <Field label="Bank">
            <Input value={bankName} onChangeText={setBankName} />
          </Field>
          <Text style={styles.hint}>Try: {BANKS.slice(0, 3).join(" · ")}</Text>
          <Field label="Account number">
            <Input
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
            />
          </Field>
          <Field label="Nickname (optional)">
            <Input value={nickname} onChangeText={setNickname} />
          </Field>
          <Button
            title={loading ? "Saving…" : "Save beneficiary"}
            onPress={save}
            loading={loading}
            disabled={!name || !accountNumber || accountNumber.length < 6}
          />
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: -8,
    marginBottom: 12,
  },
});
