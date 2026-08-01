import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  Field,
  HeroTitle,
  Input,
  Screen,
  Sub,
} from "../../src/components/ui";
import { api, formatLkr } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type Product = "PERSONAL" | "BUSINESS" | "WORKING_CAPITAL";

type Estimate = {
  eligibilityScore: number;
  dti: number;
  instalment: number;
  aiRecommendation: string;
};

export default function LoanApplyScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [product, setProduct] = useState<Product>("PERSONAL");
  const [amount, setAmount] = useState("350000");
  const [tenureMonths, setTenureMonths] = useState("24");
  const [income, setIncome] = useState("185000");
  const [purpose, setPurpose] = useState("Home renovation");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const amt = Number(amount) || 0;
  const tenure = Number(tenureMonths) || 1;
  const monthlyIncome = Number(income) || 1;

  async function runEstimate() {
    setError("");
    try {
      const res = await api<Estimate>("/loans/estimate", {
        method: "POST",
        token,
        body: JSON.stringify({ amount: amt, tenureMonths: tenure, monthlyIncome }),
      });
      setEstimate(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Estimate failed");
    }
  }

  async function apply() {
    setLoading(true);
    setError("");
    try {
      if (!estimate) await runEstimate();
      const res = await api<{ id: string }>("/loans/apply", {
        method: "POST",
        token,
        body: JSON.stringify({
          product,
          amount: amt,
          tenureMonths: tenure,
          purpose,
          monthlyIncome,
        }),
      });
      router.replace(`/loans/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Application failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <HeroTitle>Apply for credit</HeroTitle>
          <Sub>Guided form with real-time AI eligibility estimate (FR-07).</Sub>

          <View style={styles.tabs}>
            {(
              [
                ["PERSONAL", "Personal"],
                ["BUSINESS", "Business"],
                ["WORKING_CAPITAL", "Working capital"],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => setProduct(id)}
                style={[styles.chip, product === id && styles.chipOn]}
              >
                <Text style={[styles.chipText, product === id && { color: colors.white }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field label="Amount (LKR)">
            <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </Field>
          <Field label="Tenure (months)">
            <Input
              value={tenureMonths}
              onChangeText={setTenureMonths}
              keyboardType="number-pad"
            />
          </Field>
          <Field label="Monthly income (LKR)">
            <Input value={income} onChangeText={setIncome} keyboardType="decimal-pad" />
          </Field>
          <Field label="Purpose">
            <Input value={purpose} onChangeText={setPurpose} />
          </Field>

          <Button title="Refresh AI estimate" variant="secondary" onPress={runEstimate} />

          <View style={styles.ai}>
            <Text style={styles.aiLabel}>Eligibility score</Text>
            <Text style={styles.aiScore}>{estimate?.eligibilityScore ?? "—"}</Text>
            <View style={styles.progress}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${estimate?.eligibilityScore ?? 0}%` },
                ]}
              />
            </View>
            <Text style={styles.aiHint}>
              {estimate
                ? `${estimate.aiRecommendation} · DTI ${estimate.dti} · EMI ${formatLkr(estimate.instalment)}`
                : `Indicative for ${formatLkr(amt)} over ${tenure} months`}
            </Text>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button
            title={loading ? "Submitting…" : "Submit application"}
            onPress={apply}
            disabled={loading}
          />
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
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.navy },
  ai: {
    marginTop: 14,
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(201,24,74,0.2)",
    backgroundColor: colors.crimsonSoft,
  },
  aiLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.muted },
  aiScore: {
    fontFamily: fonts.display,
    fontSize: 42,
    color: colors.crimson,
    lineHeight: 48,
  },
  progress: {
    height: 8,
    backgroundColor: colors.line,
    borderRadius: 999,
    overflow: "hidden",
    marginVertical: 10,
  },
  progressFill: { height: "100%", backgroundColor: colors.crimson },
  aiHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  error: { color: colors.crimson, marginBottom: 8, fontFamily: fonts.sans },
});
