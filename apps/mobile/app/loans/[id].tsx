import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, Card, HeroTitle, Screen, Sub } from "../../src/components/ui";
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
  dti: number;
  instalment: number;
  aiRecommendation: string;
  fraudFlags: string[];
  createdAt: string;
  decidedAt?: string;
};

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Loan>(`/loans/mine/${id}`, { token })
      .then(setLoan)
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  }, [id, token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <HeroTitle>Application detail</HeroTitle>
          <Sub>Status, eligibility, and AI recommendation for this credit request.</Sub>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {loan && (
            <>
              <View style={styles.hero}>
                <Badge
                  tone={
                    loan.status === "REJECTED"
                      ? "danger"
                      : loan.status === "SUBMITTED"
                        ? "warn"
                        : "ok"
                  }
                >
                  {loan.status}
                </Badge>
                <Text style={styles.amount}>{formatLkr(loan.amount)}</Text>
                <Text style={styles.meta}>
                  {loan.product.replace("_", " ")} · {loan.tenureMonths} months
                </Text>
              </View>
              <Card>
                <Row label="Purpose" value={loan.purpose} />
                <Row label="Eligibility" value={`${loan.eligibilityScore}/100`} />
                <Row label="DTI" value={String(loan.dti)} />
                <Row label="Est. instalment" value={formatLkr(loan.instalment)} />
                <Row label="Submitted" value={new Date(loan.createdAt).toLocaleString()} />
                {loan.decidedAt && (
                  <Row label="Decided" value={new Date(loan.decidedAt).toLocaleString()} />
                )}
              </Card>
              <Card style={{ backgroundColor: colors.crimsonSoft }}>
                <Text style={styles.aiLabel}>AI recommendation</Text>
                <Text style={styles.aiBody}>{loan.aiRecommendation}</Text>
                {loan.fraudFlags?.length > 0 && (
                  <Text style={styles.flags}>Flags: {loan.fraudFlags.join(", ")}</Text>
                )}
              </Card>
            </>
          )}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  amount: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.white,
    marginTop: 10,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    textTransform: "capitalize",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { fontFamily: fonts.sans, color: colors.muted, fontSize: 13 },
  rowValue: {
    fontFamily: fonts.sansBold,
    color: colors.navy,
    fontSize: 13,
    maxWidth: "60%",
    textAlign: "right",
  },
  aiLabel: { fontFamily: fonts.sansBold, color: colors.crimsonDark, marginBottom: 6 },
  aiBody: { fontFamily: fonts.sans, color: colors.navy, lineHeight: 20 },
  flags: { fontFamily: fonts.sans, color: colors.crimson, marginTop: 8, fontSize: 12 },
  error: { color: colors.crimson, fontFamily: fonts.sans },
});
