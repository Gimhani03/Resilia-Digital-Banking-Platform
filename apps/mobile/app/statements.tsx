import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AccountSummary, TransactionDto } from "@resilia/shared";
import {
  AccountPicker,
  AmountText,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  ListRow,
  LoadingBlock,
  Screen,
  ScreenHeader,
  StatusBadge,
} from "../src/components/ui";
import { api, formatLkr } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, fonts } from "../src/theme";

type StatementResponse =
  | TransactionDto[]
  | { rows: TransactionDto[]; openingBalance?: number; closingBalance?: number };

export default function StatementsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { accountId: accountIdParam } = useLocalSearchParams<{
    accountId?: string;
  }>();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountId, setAccountId] = useState(accountIdParam || "");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<TransactionDto[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api<AccountSummary[]>("/accounts", { token })
        .then((a) => {
          setAccounts(a);
          setAccountId((prev) => prev || accountIdParam || a[0]?.id || "");
        })
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Failed to load accounts"),
        )
        .finally(() => setBootLoading(false));
    }, [token, accountIdParam]),
  );

  const account = accounts.find((a) => a.id === accountId);

  async function loadStatement() {
    if (!accountId) {
      setError("Select an account");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        accountId,
        from,
        to,
      });
      const res = await api<StatementResponse>(
        `/payments/statement?${params.toString()}`,
        { token },
      );
      const items = Array.isArray(res) ? res : res.rows || [];
      setRows(items);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Screen>
          <ScreenHeader title="Statements" onBack={() => router.back()} />
          <Text style={styles.lead}>
            Pick an account and date range to list statement rows.
          </Text>

          {bootLoading ? (
            <LoadingBlock />
          ) : (
            <>
              <Text style={styles.label}>Account</Text>
              <Pressable
                style={styles.picker}
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.pickerTitle}>
                  {account?.nickname || account?.label || "Select account"}
                </Text>
                <Text style={styles.pickerMeta}>
                  {account ? `${account.mask} · ${formatLkr(account.available)}` : ""}
                </Text>
              </Pressable>

              <Field label="From (YYYY-MM-DD)">
                <Input
                  value={from}
                  onChangeText={setFrom}
                  autoCapitalize="none"
                  accessibilityLabel="From date"
                />
              </Field>
              <Field label="To (YYYY-MM-DD)">
                <Input
                  value={to}
                  onChangeText={setTo}
                  autoCapitalize="none"
                  accessibilityLabel="To date"
                />
              </Field>
              <Button title="Load statement" onPress={loadStatement} loading={loading} />
              <ErrorBanner message={error} />

              {fetched && !loading ? (
                rows.length === 0 ? (
                  <EmptyState
                    title="No rows in range"
                    body="Try a wider date range for this account."
                  />
                ) : (
                  <Card style={{ paddingVertical: 4, marginTop: 8 }}>
                    {rows.map((t, i) => (
                      <ListRow
                        key={t.id}
                        title={t.counterparty}
                        subtitle={`${new Date(t.createdAt).toLocaleDateString()} · ${t.reference}`}
                        onPress={() => router.push(`/history/${t.id}`)}
                        last={i === rows.length - 1}
                        right={
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <AmountText
                              amount={t.amount}
                              direction={t.direction}
                              size="sm"
                            />
                            <StatusBadge status={t.status} />
                          </View>
                        }
                      />
                    ))}
                  </Card>
                )
              ) : null}
            </>
          )}
        </Screen>
      </ScrollView>
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
  lead: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    marginBottom: 14,
    lineHeight: 20,
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
