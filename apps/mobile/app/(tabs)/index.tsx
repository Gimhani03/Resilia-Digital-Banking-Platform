import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AccountSummary, TransactionDto } from "@resilia/shared";
import {
  AmountText,
  BrandMark,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Screen,
  SectionLabel,
  StatusBadge,
} from "../../src/components/ui";
import {
  api,
  formatLkr,
  greetingForHour,
  initials,
  relativeTime,
} from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type Dash = {
  primary: AccountSummary;
  recent: TransactionDto[];
  securityAlerts: { id: string; title: string; body: string }[];
};

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Dash | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const d = await api<Dash>("/accounts/dashboard", { token });
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const actions = [
    { href: "/transfer", icon: "↗", label: "Transfer" },
    { href: "/bills", icon: "▦", label: "Pay bills" },
    { href: "/beneficiaries", icon: "◎", label: "Beneficiaries" },
    { href: "/accounts", icon: "⌂", label: "Accounts" },
  ] as const;

  const available = data?.primary?.available ?? data?.primary?.balance;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.crimson}
          />
        }
      >
        <Screen>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greetingForHour()}</Text>
              <Text style={styles.name}>{user?.fullName || "Customer"}</Text>
            </View>
            <Link href="/(tabs)/profile" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Open profile">
                <BrandMark text={initials(user?.fullName || "AP")} />
              </Pressable>
            </Link>
          </View>

          <ErrorBanner message={error} />

          {loading && !data ? (
            <LoadingBlock label="Loading accounts…" />
          ) : (
            <>
              <Pressable
                onPress={() =>
                  data?.primary?.id && router.push(`/accounts/${data.primary.id}`)
                }
                accessibilityRole="button"
                accessibilityLabel="View primary account"
                style={styles.balanceCard}
              >
                <Text style={styles.balanceLabel}>
                  Available · {data?.primary?.nickname || data?.primary?.label}{" "}
                  {data?.primary?.mask}
                </Text>
                <Text style={styles.balanceAmt}>
                  {available != null ? formatLkr(available) : "—"}
                </Text>
                <View style={styles.balanceMeta}>
                  <Text style={styles.balanceMetaText}>
                    Ledger {data?.primary ? formatLkr(data.primary.balance) : "—"}
                  </Text>
                  <Text style={styles.balanceMetaText}>Region A · Healthy</Text>
                </View>
              </Pressable>

              {(data?.securityAlerts?.length ?? 0) > 0 && (
                <Card style={styles.alertCard}>
                  <View style={styles.alertDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>
                      {data!.securityAlerts[0].title || "Security alert"}
                    </Text>
                    <Link href="/(tabs)/profile" asChild>
                      <Pressable>
                        <Text style={styles.alertBody}>
                          {data!.securityAlerts[0].body} Review devices →
                        </Text>
                      </Pressable>
                    </Link>
                  </View>
                </Card>
              )}

              <View style={styles.actions}>
                {actions.map((a) => (
                  <Link key={a.href} href={a.href} asChild>
                    <Pressable
                      style={styles.qa}
                      accessibilityRole="button"
                      accessibilityLabel={a.label}
                    >
                      <View style={styles.qaIcon}>
                        <Text style={{ color: colors.white }}>{a.icon}</Text>
                      </View>
                      <Text style={styles.qaLabel}>{a.label}</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>

              <View style={styles.rowBetween}>
                <SectionLabel>Recent activity</SectionLabel>
                <Link href="/history" asChild>
                  <Pressable accessibilityRole="link">
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </Link>
              </View>

              {!data?.recent?.length ? (
                <EmptyState
                  title="No recent activity"
                  body="Transfers and bill payments will show up here."
                  actionLabel="Make a transfer"
                  onAction={() => router.push("/transfer")}
                />
              ) : (
                <Card style={{ paddingVertical: 4 }}>
                  {data.recent.map((t, idx) => (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push(`/history/${t.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.counterparty} ${t.amount}`}
                      style={[
                        styles.txn,
                        idx === data.recent.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={styles.txnIcon}>
                        <Text style={styles.txnIconText}>
                          {t.counterparty.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txnName} numberOfLines={1}>
                          {t.counterparty}
                        </Text>
                        <Text style={styles.txnMeta}>
                          {relativeTime(t.createdAt)} · {t.category}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <AmountText
                          amount={t.amount}
                          direction={t.direction}
                          size="sm"
                        />
                        {t.status === "HELD" ? <StatusBadge status={t.status} /> : null}
                      </View>
                    </Pressable>
                  ))}
                </Card>
              )}
            </>
          )}
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
    marginBottom: 16,
    marginTop: 8,
  },
  greeting: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.muted },
  name: { fontFamily: fonts.sansExtra, fontSize: 16, color: colors.navy },
  balanceCard: {
    backgroundColor: colors.navy,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  balanceLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 6,
  },
  balanceAmt: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.white,
    marginBottom: 14,
  },
  balanceMeta: { flexDirection: "row", justifyContent: "space-between" },
  balanceMetaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  alertCard: {
    backgroundColor: colors.crimsonSoft,
    borderColor: "rgba(201,24,74,0.25)",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.crimson,
    marginTop: 5,
  },
  alertTitle: {
    fontFamily: fonts.sansBold,
    color: colors.crimsonDark,
    fontSize: 13,
    marginBottom: 4,
  },
  alertBody: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  actions: { flexDirection: "row", gap: 8, marginBottom: 18 },
  qa: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  qaIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  qaLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.navy },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAll: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.crimson },
  txn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  txnIconText: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    color: colors.navy,
  },
  txnName: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.navy },
  txnMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
});
