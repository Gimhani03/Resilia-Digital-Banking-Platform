import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AccountSummary } from "@resilia/shared";
import {
  AccountPicker,
  Button,
  ErrorBanner,
  Field,
  Input,
  Screen,
  ScreenHeader,
  StickyFooter,
} from "../../src/components/ui";
import { api, formatLkr } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function TransferAmountScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    payeeId?: string;
    payeeName?: string;
    payeeBank?: string;
    payeeMask?: string;
  }>();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api<AccountSummary[]>("/accounts", { token })
        .then((a) => {
          setAccounts(a.filter((x) => !x.frozen));
          setAccountId((prev) => prev || a.find((x) => !x.frozen)?.id || "");
        })
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Failed to load accounts"),
        );
    }, [token]),
  );

  const account = accounts.find((a) => a.id === accountId);
  const amt = Number(amount) || 0;

  function continueNext() {
    if (!params.payeeId || !accountId || amt <= 0) {
      setError("Enter a valid amount and select an account");
      return;
    }
    if (account && amt > account.available) {
      setError("Amount exceeds available balance");
      return;
    }
    router.push({
      pathname: "/transfer/confirm",
      params: {
        payeeId: params.payeeId,
        payeeName: params.payeeName || "",
        payeeBank: params.payeeBank || "",
        payeeMask: params.payeeMask || "",
        accountId,
        amount: String(amt),
        note,
      },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Screen>
          <ScreenHeader title="Amount" onBack={() => router.back()} />
          <View style={styles.stepper}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.step,
                  i <= 2 && { backgroundColor: colors.crimson },
                ]}
              />
            ))}
          </View>

          <View style={styles.payee}>
            <Text style={styles.payeeLabel}>To</Text>
            <Text style={styles.payeeName}>{params.payeeName}</Text>
            <Text style={styles.payeeMeta}>
              {params.payeeBank} · {params.payeeMask}
            </Text>
          </View>

          <Field label="Amount (LKR)">
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              accessibilityLabel="Transfer amount"
              style={{ fontFamily: fonts.display, fontSize: 28 }}
            />
          </Field>

          <Text style={styles.fromLabel}>From account</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Select source account"
            style={styles.fromBtn}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.fromTitle}>
                {account?.nickname || account?.label || "Select account"}
              </Text>
              <Text style={styles.fromMeta}>
                {account
                  ? `${account.mask} · Available ${formatLkr(account.available)}`
                  : "Tap to choose"}
              </Text>
            </View>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>

          <Field label="Note (optional)">
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Rent · gift · invoice"
              accessibilityLabel="Transfer note"
            />
          </Field>
          <ErrorBanner message={error} />
        </Screen>
      </ScrollView>
      <StickyFooter>
        <Button
          title="Review transfer"
          onPress={continueNext}
          disabled={!accountId || amt <= 0}
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
  stepper: { flexDirection: "row", gap: 6, marginBottom: 16 },
  step: { flex: 1, height: 5, borderRadius: 999, backgroundColor: colors.line },
  payee: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  payeeLabel: {
    fontFamily: fonts.sansExtra,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  payeeName: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.navy,
    marginTop: 4,
  },
  payeeMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  fromLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.navy,
    marginBottom: 7,
  },
  fromBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  fromTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.navy },
  fromMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  chevron: { fontFamily: fonts.sansBold, color: colors.muted, fontSize: 16 },
});
