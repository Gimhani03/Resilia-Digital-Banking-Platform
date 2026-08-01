import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  HeroTitle,
  Input,
  LoadingBlock,
  Screen,
  Sub,
} from "../../src/components/ui";
import { api, formatLkr } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type CardT = {
  id: string;
  label: string;
  mask: string;
  type: string;
  frozen: boolean;
  dailyLimit: number;
  online: boolean;
  contactless: boolean;
  international: boolean;
  pinSet?: boolean;
  expiry?: string;
};

export default function CardsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<CardT[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [pinEdits, setPinEdits] = useState<Record<string, string>>({});
  const [limitEdits, setLimitEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const rows = await api<CardT[]>("/cards", { token });
      setCards(rows);
      const limits: Record<string, string> = {};
      rows.forEach((c) => {
        limits[c.id] = String(c.dailyLimit);
      });
      setLimitEdits(limits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function toggle(card: CardT, key: "online" | "contactless" | "international") {
    try {
      await api(`/cards/${card.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ [key]: !card[key] }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function freezeToggle(card: CardT) {
    try {
      await api(`/cards/${card.id}/${card.frozen ? "unfreeze" : "freeze"}`, {
        method: "POST",
        token,
      });
      setMsg(card.frozen ? "Card unfrozen" : "Card frozen");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function saveLimit(card: CardT) {
    try {
      await api(`/cards/${card.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ dailyLimit: Number(limitEdits[card.id] || card.dailyLimit) }),
      });
      setMsg("Daily limit updated");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Limit update failed");
    }
  }

  async function savePin(card: CardT) {
    try {
      await api(`/cards/${card.id}/pin`, {
        method: "POST",
        token,
        body: JSON.stringify({ pin: pinEdits[card.id] || "" }),
      });
      setMsg("PIN updated");
      setPinEdits((p) => ({ ...p, [card.id]: "" }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "PIN update failed");
    }
  }

  const debit = cards.find((c) => c.type === "DEBIT") || cards[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView>
        <Screen>
          <View style={styles.header}>
            <Text style={styles.title}>Cards</Text>
            <Pressable onPress={() => router.push("/security")}>
              <Text style={styles.link}>Security</Text>
            </Pressable>
          </View>
          <HeroTitle>Your cards</HeroTitle>
          <Sub>Controls, limits, PIN, freeze / unfreeze.</Sub>
          <ErrorBanner message={error} />
          {!!msg && (
            <Card style={{ backgroundColor: colors.okSoft }}>
              <Text style={{ fontFamily: fonts.sansBold, color: colors.ok }}>{msg}</Text>
            </Card>
          )}
          {loading && <LoadingBlock />}
          {!loading && cards.length === 0 && (
            <EmptyState title="No cards" body="Cards linked to your profile will show here." />
          )}

          {debit && (
            <View style={styles.plastic}>
              <Text style={styles.plasticLabel}>{debit.label}</Text>
              <Text style={styles.plasticMask}>{debit.mask}</Text>
              <View style={styles.plasticMeta}>
                <Text style={styles.plasticMetaText}>{debit.type}</Text>
                <Text style={styles.plasticMetaText}>
                  {debit.frozen ? "FROZEN" : "ACTIVE"}
                  {debit.expiry ? ` · ${debit.expiry}` : ""}
                </Text>
              </View>
            </View>
          )}

          {cards.map((c) => (
            <Card key={c.id}>
              <Text style={styles.cardTitle}>
                {c.label} · {c.mask}
              </Text>
              {(
                [
                  ["online", "Online payments"],
                  ["contactless", "Contactless"],
                  ["international", "International"],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Switch
                    value={c[key]}
                    onValueChange={() => toggle(c, key)}
                    trackColor={{ true: colors.crimson, false: colors.line }}
                  />
                </View>
              ))}
              <Field label="Daily limit (LKR)">
                <Input
                  value={limitEdits[c.id] || ""}
                  onChangeText={(v) => setLimitEdits((p) => ({ ...p, [c.id]: v }))}
                  keyboardType="number-pad"
                />
              </Field>
              <Button title="Save limit" variant="secondary" onPress={() => saveLimit(c)} />
              <Field label="Set 4-digit PIN">
                <Input
                  value={pinEdits[c.id] || ""}
                  onChangeText={(v) => setPinEdits((p) => ({ ...p, [c.id]: v }))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
              </Field>
              <Button title="Update PIN" variant="secondary" onPress={() => savePin(c)} />
              <Button
                title={c.frozen ? "Unfreeze card" : "Freeze card"}
                variant={c.frozen ? "primary" : "danger"}
                onPress={() => freezeToggle(c)}
              />
            </Card>
          ))}
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
    marginTop: 8,
    marginBottom: 8,
  },
  title: { fontFamily: fonts.sansExtra, color: colors.navy },
  link: { fontFamily: fonts.sansBold, color: colors.crimson, fontSize: 13 },
  plastic: {
    backgroundColor: colors.navy,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  plasticLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 32,
  },
  plasticMask: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.white,
    letterSpacing: 3,
    marginBottom: 8,
  },
  plasticMeta: { flexDirection: "row", justifyContent: "space-between" },
  plasticMetaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  cardTitle: { fontFamily: fonts.sansBold, color: colors.navy, marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.navy },
});
