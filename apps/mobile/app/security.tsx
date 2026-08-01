import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  HeroTitle,
  Input,
  LoadingBlock,
  Screen,
  Sub,
} from "../src/components/ui";
import { api, formatLkr, type AccountSummary } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, fonts } from "../src/theme";

type CardT = { id: string; label: string; mask: string; frozen: boolean };
type Dispute = {
  id: string;
  transactionId?: string;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
};

export default function SecurityScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [cards, setCards] = useState<CardT[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [reason, setReason] = useState("Unrecognized merchant charge");
  const [txnId, setTxnId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [a, c, d] = await Promise.all([
        api<AccountSummary[]>("/accounts", { token }),
        api<CardT[]>("/cards", { token }),
        api<Dispute[]>("/payments/disputes", { token }).catch(() => []),
      ]);
      setAccounts(a);
      setCards(c);
      setDisputes(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function freezeCard(id: string, frozen: boolean) {
    await api(`/cards/${id}/${frozen ? "unfreeze" : "freeze"}`, {
      method: "POST",
      token,
    });
    setMsg(frozen ? "Card unfrozen" : "Card frozen · audit log updated");
    refresh();
  }

  async function freezeAccount(id: string, frozen: boolean) {
    await api(`/accounts/${id}/${frozen ? "unfreeze" : "freeze"}`, {
      method: "POST",
      token,
    });
    setMsg(frozen ? "Account unfrozen" : "Account frozen · audit log updated");
    refresh();
  }

  async function dispute() {
    try {
      await api("/payments/disputes", {
        method: "POST",
        token,
        body: JSON.stringify({
          reason,
          ...(txnId ? { transactionId: txnId } : {}),
        }),
      });
      setMsg("Dispute raised · immutable audit entry written");
      setTxnId("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dispute failed");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <HeroTitle>Freeze & dispute</HeroTitle>
          <Sub>
            Instantly freeze or unfreeze a card or account, and track open disputes
            (FR-15).
          </Sub>
          <ErrorBanner message={error} />
          {!!msg && (
            <Card style={{ backgroundColor: colors.okSoft, borderColor: "rgba(15,122,76,0.2)" }}>
              <Text style={{ fontFamily: fonts.sansBold, color: colors.ok, fontSize: 13 }}>
                {msg}
              </Text>
            </Card>
          )}
          {loading && <LoadingBlock />}

          <Card>
            <Text style={styles.blockTitle}>Cards</Text>
            {cards.map((c) => (
              <View key={c.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.label}</Text>
                  <Text style={styles.rowMeta}>
                    {c.mask} · {c.frozen ? "Frozen" : "Active"}
                  </Text>
                </View>
                <Button
                  title={c.frozen ? "Unfreeze" : "Freeze"}
                  variant="secondary"
                  onPress={() => freezeCard(c.id, c.frozen)}
                />
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.blockTitle}>Accounts</Text>
            {accounts.map((a) => (
              <View key={a.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {a.nickname || a.label} {a.mask}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Available {formatLkr(a.available ?? a.balance)}
                    {a.frozen ? " · Frozen" : ""}
                  </Text>
                </View>
                <Button
                  title={a.frozen ? "Unfreeze" : "Freeze"}
                  variant="secondary"
                  onPress={() => freezeAccount(a.id, a.frozen)}
                />
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.blockTitle}>Raise dispute</Text>
            <Field label="Transaction ID (optional)">
              <Input
                value={txnId}
                onChangeText={setTxnId}
                placeholder="Paste from history detail"
                autoCapitalize="none"
              />
            </Field>
            <Field label="Reason">
              <Input value={reason} onChangeText={setReason} />
            </Field>
            <Button title="Submit dispute" onPress={dispute} />
          </Card>

          <Text style={styles.blockTitle}>Your disputes</Text>
          {disputes.length === 0 && (
            <Text style={styles.rowMeta}>No disputes yet.</Text>
          )}
          {disputes.map((d) => (
            <Card key={d.id}>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{d.reason}</Text>
                <Badge
                  tone={
                    d.status === "OPEN"
                      ? "warn"
                      : d.status === "RESOLVED"
                        ? "ok"
                        : "danger"
                  }
                >
                  {d.status}
                </Badge>
              </View>
              <Text style={styles.rowMeta}>
                {new Date(d.createdAt).toLocaleString()}
                {d.transactionId ? ` · txn ${d.transactionId.slice(-6)}` : ""}
              </Text>
              {!!d.resolution && (
                <Text style={[styles.rowMeta, { marginTop: 6, color: colors.navy }]}>
                  Officer: {d.resolution}
                </Text>
              )}
            </Card>
          ))}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    fontFamily: fonts.sansBold,
    color: colors.crimson,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 8,
  },
  blockTitle: {
    fontFamily: fonts.sansBold,
    color: colors.navy,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 8,
  },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.navy, flex: 1 },
  rowMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
});
