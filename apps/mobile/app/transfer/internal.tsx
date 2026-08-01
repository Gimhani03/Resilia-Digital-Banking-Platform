import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AccountPicker,
  Button,
  ErrorBanner,
  Field,
  Input,
  Screen,
  ScreenHeader,
  Sub,
} from "../../src/components/ui";
import {
  api,
  formatLkr,
  type AccountSummary,
  type TransactionDto,
} from "../../src/lib/api";
import {
  completeStepUp,
  newIdempotencyKey,
  StepUpPanel,
  useStepUpCode,
} from "../../src/lib/stepup";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function InternalTransferScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("5000");
  const [note, setNote] = useState("Own account move");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [code, setCode] = useStepUpCode();

  useEffect(() => {
    api<AccountSummary[]>("/accounts", { token }).then((a) => {
      setAccounts(a);
      setFromAccountId(a[0]?.id || "");
      setToAccountId(a[1]?.id || a[0]?.id || "");
    });
  }, [token]);

  async function submit() {
    if (!mfaOpen) {
      setMfaOpen(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { challengeId } = await completeStepUp(token, "TRANSFER", code);
      const res = await api<TransactionDto>("/payments/internal-transfer", {
        method: "POST",
        token,
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: Number(amount),
          note,
          mfaChallengeId: challengeId,
        }),
      });
      router.replace({ pathname: "/transfer-receipt", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  const from = accounts.find((a) => a.id === fromAccountId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScreenHeader title="Between accounts" onBack={() => router.back()} />
      <ScrollView>
        <Screen>
          <Sub>Move funds between your RESILIA accounts instantly.</Sub>
          <ErrorBanner message={error} />
          <StepUpPanel visible={mfaOpen} code={code} onChangeCode={setCode} />
          <Text style={styles.label}>From</Text>
          <AccountPicker
            accounts={accounts}
            value={fromAccountId}
            onChange={setFromAccountId}
          />
          <Text style={styles.label}>To</Text>
          <AccountPicker
            accounts={accounts.filter((a) => a.id !== fromAccountId)}
            value={toAccountId}
            onChange={setToAccountId}
          />
          <Field label="Amount (LKR)">
            <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </Field>
          <Field label="Note">
            <Input value={note} onChangeText={setNote} />
          </Field>
          {from && (
            <Text style={styles.meta}>
              Available {formatLkr(from.available ?? from.balance)}
            </Text>
          )}
          <Button
            title="Transfer with MFA"
            onPress={submit}
            loading={loading}
            disabled={!fromAccountId || !toAccountId || fromAccountId === toAccountId}
          />
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.sansExtra,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  meta: { fontFamily: fonts.sans, color: colors.muted, marginBottom: 12 },
});
