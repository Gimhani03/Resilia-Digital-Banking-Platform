import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  HeroTitle,
  Screen,
  Sub,
} from "../../src/components/ui";
import { api, formatLkr } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type Loan = {
  id: string;
  product: string;
  amount: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  eligibilityScore: number;
  instalment?: number;
  aiRecommendation: string;
  createdAt: string;
};

function toneFor(status: string): "ok" | "warn" | "danger" {
  if (status === "APPROVED" || status === "DISBURSED") return "ok";
  if (status === "REJECTED") return "danger";
  return "warn";
}

export default function LoansHubScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setLoans(await api<Loan[]>("/loans/mine", { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load loans");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <HeroTitle>Loans & credit</HeroTitle>
          <Sub>
            Track applications, review AI eligibility, and start a new personal,
            business, or working-capital request.
          </Sub>

          <Button title="Apply for credit" onPress={() => router.push("/loans/apply")} />

          <View style={styles.products}>
            {[
              ["PERSONAL", "Personal"],
              ["BUSINESS", "Business"],
              ["WORKING_CAPITAL", "Working capital"],
            ].map(([id, label]) => (
              <View key={id} style={styles.product}>
                <Text style={styles.productLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>Your applications</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {loading && <Text style={styles.muted}>Loading…</Text>}
          {!loading && loans.length === 0 && (
            <Card>
              <Text style={styles.emptyTitle}>No applications yet</Text>
              <Text style={styles.muted}>
                Start with an AI eligibility estimate — it takes under a minute.
              </Text>
            </Card>
          )}
          {loans.map((l) => (
            <Link key={l.id} href={`/loans/${l.id}`} asChild>
              <Pressable>
                <Card>
                  <View style={styles.row}>
                    <Text style={styles.loanTitle}>{l.product.replace("_", " ")}</Text>
                    <Badge tone={toneFor(l.status)}>{l.status}</Badge>
                  </View>
                  <Text style={styles.amount}>{formatLkr(l.amount)}</Text>
                  <Text style={styles.muted}>
                    {l.tenureMonths} months · score {l.eligibilityScore}
                    {l.instalment ? ` · EMI ${formatLkr(l.instalment)}` : ""}
                  </Text>
                  <Text style={styles.purpose}>{l.purpose}</Text>
                </Card>
              </Pressable>
            </Link>
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
  products: { flexDirection: "row", gap: 8, marginVertical: 14 },
  product: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  productLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.navy },
  section: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loanTitle: {
    fontFamily: fonts.sansBold,
    color: colors.navy,
    textTransform: "capitalize",
  },
  amount: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.navy,
    marginVertical: 4,
  },
  purpose: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 6 },
  emptyTitle: { fontFamily: fonts.sansBold, color: colors.navy, marginBottom: 4 },
  muted: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  error: { color: colors.crimson, marginBottom: 8, fontFamily: fonts.sans },
});
