import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AccountSummary, BillerDto } from "@resilia/shared";
import {
  AccountPicker,
  Button,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  Screen,
  ScreenHeader,
  StickyFooter,
} from "../../src/components/ui";
import { api, formatLkr } from "../../src/lib/api";
import {
  completeStepUp,
  newIdempotencyKey,
  StepUpPanel,
  useStepUpCode,
} from "../../src/lib/stepup";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function BillPayScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [biller, setBiller] = useState<BillerDto | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountId, setAccountId] = useState("");
  const [consumerRef, setConsumerRef] = useState("");
  const [amount, setAmount] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaCode, setMfaCode] = useStepUpCode();

  useFocusEffect(
    useCallback(() => {
      if (!token || !code) return;
      setLoading(true);
      Promise.all([
        api<BillerDto[]>(`/payments/billers`, { token }),
        api<AccountSummary[]>("/accounts", { token }),
      ])
        .then(([billers, accs]) => {
          const found =
            billers.find((b) => b.code === code) ||
            ({
              id: code,
              code,
              name: code,
              category: "Utilities",
              accountHint: "Account / reference",
              minAmount: 100,
              maxAmount: 500000,
            } as BillerDto);
          setBiller(found);
          const open = accs.filter((a) => !a.frozen);
          setAccounts(open);
          setAccountId(open[0]?.id || "");
        })
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Failed to load biller"),
        )
        .finally(() => setLoading(false));
    }, [token, code]),
  );

  const account = accounts.find((a) => a.id === accountId);
  const amt = Number(amount) || 0;

  async function pay() {
    if (!biller || !accountId || amt <= 0) {
      setError("Enter amount and reference");
      return;
    }
    if (amt < biller.minAmount || amt > biller.maxAmount) {
      setError(
        `Amount must be between ${formatLkr(biller.minAmount)} and ${formatLkr(biller.maxAmount)}`,
      );
      return;
    }
    if (!mfaOpen) {
      setMfaOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { challengeId } = await completeStepUp(token, "BILL", mfaCode);
      const res = await api<{ id: string; status: string }>("/payments/bill", {
        method: "POST",
        token,
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify({
          accountId,
          billerCode: biller.code,
          biller: biller.name,
          accountRef: consumerRef,
          amount: amt,
          method: "BILL",
          mfaChallengeId: challengeId,
        }),
      });
      if (res.status === "HELD") router.replace(`/held/${res.id}`);
      else
        router.replace({
          pathname: "/transfer-receipt",
          params: { id: res.id },
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Screen>
          <ScreenHeader title="Bill payment" onBack={() => router.back()} />
          {loading || !biller ? (
            <LoadingBlock />
          ) : (
            <>
              <Text style={styles.name}>{biller.name}</Text>
              <Text style={styles.meta}>
                {biller.category} · Min {formatLkr(biller.minAmount)}
              </Text>
              <Field label={biller.accountHint || "Account / reference"}>
                <Input
                  value={consumerRef}
                  onChangeText={setConsumerRef}
                  accessibilityLabel="Consumer reference"
                />
              </Field>
              <Field label="Amount (LKR)">
                <Input
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  style={{ fontFamily: fonts.display, fontSize: 24 }}
                  accessibilityLabel="Bill amount"
                />
              </Field>
              <Text style={styles.label}>Pay from</Text>
              <Pressable
                style={styles.picker}
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.pickerTitle}>
                  {account?.nickname || account?.label || "Select account"}
                </Text>
                <Text style={styles.pickerMeta}>
                  {account
                    ? `${account.mask} · ${formatLkr(account.available)}`
                    : ""}
                </Text>
              </Pressable>
              <ErrorBanner message={error} />
          <StepUpPanel visible={mfaOpen} code={mfaCode} onChangeCode={setMfaCode} />
            </>
          )}
        </Screen>
      </ScrollView>
      <StickyFooter>
        <Button
          title="Pay with MFA"
          onPress={pay}
          loading={busy}
          disabled={!biller || !accountId || amt <= 0}
        />
      </StickyFooter>
      <AccountPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        accounts={accounts}
        selectedId={accountId}
        onSelect={(a) => setAccountId(a.id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  name: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.navy,
    marginBottom: 4,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 16,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.navy,
    marginBottom: 7,
  },
  picker: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  pickerTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.navy },
  pickerMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
});
