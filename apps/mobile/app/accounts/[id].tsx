import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  Screen,
  ScreenHeader,
} from "../../src/components/ui";
import { api, formatLkr, type AccountSummary, type TransactionDto } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type Detail = AccountSummary & { recent: TransactionDto[] };

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await api<Detail>(`/accounts/${id}`, { token });
      setData(d);
      setNickname(d.nickname || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function saveNickname() {
    try {
      const updated = await api<AccountSummary>(`/accounts/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ nickname }),
      });
      setData((prev) => (prev ? { ...prev, ...updated } : prev));
      setMsg("Nickname saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function toggleFreeze() {
    if (!data) return;
    try {
      const path = data.frozen ? "unfreeze" : "freeze";
      const updated = await api<AccountSummary>(`/accounts/${id}/${path}`, {
        method: "POST",
        token,
      });
      setData((prev) => (prev ? { ...prev, ...updated } : prev));
      setMsg(updated.frozen ? "Account frozen" : "Account unfrozen");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScreenHeader title="Account" onBack={() => router.back()} />
      <ScrollView>
        <Screen>
          <ErrorBanner message={error} />
          {!!msg && (
            <Card style={{ backgroundColor: colors.okSoft }}>
              <Text style={{ fontFamily: fonts.sansBold, color: colors.ok }}>{msg}</Text>
            </Card>
          )}
          {loading && <LoadingBlock />}
          {data && (
            <>
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroLabel}>
                    {data.nickname || data.label} · {data.mask}
                  </Text>
                  {data.frozen ? (
                    <Badge tone="danger">Frozen</Badge>
                  ) : (
                    <Badge>Active</Badge>
                  )}
                </View>
                <Text style={styles.heroAmt}>{formatLkr(data.available ?? data.balance)}</Text>
                <Text style={styles.heroMeta}>
                  Available · Ledger {formatLkr(data.balance)}
                  {(data.heldAmount || 0) > 0 ? ` · Held ${formatLkr(data.heldAmount)}` : ""}
                </Text>
              </View>

              <Field label="Nickname">
                <Input value={nickname} onChangeText={setNickname} placeholder="e.g. Salary pot" />
              </Field>
              <Button title="Save nickname" variant="secondary" onPress={saveNickname} />
              <Button
                title={data.frozen ? "Unfreeze account" : "Freeze account"}
                variant={data.frozen ? "primary" : "danger"}
                onPress={toggleFreeze}
              />
              <Button
                title="View statement"
                variant="ghost"
                onPress={() =>
                  router.push({ pathname: "/statements", params: { accountId: data.id } })
                }
              />

              <Text style={styles.section}>Recent activity</Text>
              {(data.recent || []).map((t) => (
                <Link key={t.id} href={`/history/${t.id}`} asChild>
                  <Pressable style={styles.txn}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txnName}>{t.counterparty}</Text>
                      <Text style={styles.txnMeta}>
                        {new Date(t.createdAt).toLocaleDateString()} · {t.status}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txnAmt,
                        t.direction === "IN" && { color: colors.ok },
                      ]}
                    >
                      {t.direction === "IN" ? "+" : "−"}
                      {t.amount.toLocaleString()}
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </>
          )}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { fontFamily: fonts.sans, color: "rgba(255,255,255,0.75)", fontSize: 12 },
  heroAmt: { fontFamily: fonts.display, fontSize: 32, color: colors.white, marginTop: 10 },
  heroMeta: { fontFamily: fonts.sans, color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 6 },
  section: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  txn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  txnName: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 13 },
  txnMeta: { fontFamily: fonts.sans, color: colors.muted, fontSize: 11 },
  txnAmt: { fontFamily: fonts.sansExtra, color: colors.navy, fontSize: 13 },
});
