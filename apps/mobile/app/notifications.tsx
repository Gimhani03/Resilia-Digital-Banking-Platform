import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  HeroTitle,
  LoadingBlock,
  Screen,
  Sub,
} from "../src/components/ui";
import { api, relativeTime } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, fonts } from "../src/theme";

type N = {
  id: string;
  channel: string;
  title: string;
  body: string;
  kind: string;
  href?: string;
  read: boolean;
  createdAt: string;
};

const TABS = ["All", "security", "payment", "loan"] as const;

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<N[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await api<N[]>("/notifications", { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(
    () => (tab === "All" ? rows : rows.filter((n) => n.kind === tab)),
    [rows, tab],
  );

  async function mark(id: string) {
    await api(`/notifications/${id}/read`, { method: "POST", token });
    load();
  }

  async function markAll() {
    await api("/notifications/read-all", { method: "POST", token });
    load();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <View style={styles.header}>
            <HeroTitle>Notifications</HeroTitle>
            <Button title="Mark all read" variant="ghost" onPress={markAll} />
          </View>
          <Sub>
            Security, payment, and loan alerts via push / SMS / email (FR-10).
          </Sub>
          <ErrorBanner message={error} />
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.chip, tab === t && styles.chipOn]}
              >
                <Text style={[styles.chipText, tab === t && { color: colors.white }]}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
          {loading && <LoadingBlock />}
          {!loading && filtered.length === 0 && (
            <EmptyState title="Inbox clear" body="No notifications in this filter." />
          )}
          {filtered.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                if (!n.read) mark(n.id);
                if (n.href) router.push(n.href as any);
              }}
            >
              <Card
                style={{
                  opacity: n.read ? 0.7 : 1,
                  borderColor: n.read ? colors.line : "rgba(201,24,74,0.3)",
                }}
              >
                <View style={styles.meta}>
                  <Text style={styles.kind}>{n.kind}</Text>
                  <Text style={styles.channel}>
                    {n.channel} · {relativeTime(n.createdAt)}
                  </Text>
                </View>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
              </Card>
            </Pressable>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.navy },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  kind: {
    fontFamily: fonts.sansExtra,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
  },
  channel: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  title: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.navy },
  body: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 4 },
});
