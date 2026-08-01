import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  HeroTitle,
  Screen,
  Sub,
} from "../../src/components/ui";
import { api, formatLkr } from "../../src/lib/api";
import {
  completeStepUp,
  newIdempotencyKey,
  StepUpPanel,
  useStepUpCode,
} from "../../src/lib/stepup";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type Txn = {
  id: string;
  reference: string;
  counterparty: string;
  amount: number;
  status: string;
  riskScore?: number;
  riskReason?: string;
};

export default function HeldScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [txn, setTxn] = useState<Txn | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaOpen, setMfaOpen] = useState(false);
  const [code, setCode] = useStepUpCode();

  useEffect(() => {
    if (id) {
      api<Txn>(`/payments/${id}`, { token })
        .then(setTxn)
        .catch((e) => setError(e instanceof Error ? e.message : "Not found"));
    }
  }, [id, token]);

  async function release() {
    if (!mfaOpen) {
      setMfaOpen(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { challengeId } = await completeStepUp(token, "RELEASE", code);
      const res = await api<Txn>(`/payments/${id}/release`, {
        method: "POST",
        token,
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify({ mfaChallengeId: challengeId }),
      });
      router.replace({ pathname: "/transfer-receipt", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release failed");
    } finally {
      setLoading(false);
    }
  }

  async function reject(freezeCard: boolean) {
    setLoading(true);
    setError("");
    try {
      await api(`/payments/${id}/reject`, {
        method: "POST",
        token,
        body: JSON.stringify({ freezeCard }),
      });
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
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
          <Badge tone="warn">● Held pending review</Badge>
          <HeroTitle>Payment on hold</HeroTitle>
          <Sub>
            Fraud & Risk froze this transaction before settlement. Release with MFA
            or reject and freeze the card (FR-09).
          </Sub>
          <StepUpPanel visible={mfaOpen} code={code} onChangeCode={setCode} />
      <ErrorBanner message={error} />
          <Card>
            <Text style={styles.amount}>
              {txn ? formatLkr(txn.amount) : "…"}
            </Text>
            <Text style={styles.payee}>{txn?.counterparty}</Text>
            <Text style={styles.ref}>{txn?.reference}</Text>
            <Text style={styles.risk}>
              Risk score {txn?.riskScore ?? "—"}/100
            </Text>
            <Text style={styles.reason}>{txn?.riskReason}</Text>
          </Card>
          <Button title="Release with MFA" onPress={release} loading={loading} />
          <Button
            title="Reject & freeze card"
            variant="secondary"
            onPress={() => reject(true)}
            disabled={loading}
          />
          <Button
            title="Reject only"
            variant="ghost"
            onPress={() => reject(false)}
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
  amount: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.navy,
    marginBottom: 6,
  },
  payee: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.navy },
  ref: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 4 },
  risk: {
    fontFamily: fonts.sansExtra,
    fontSize: 13,
    color: colors.warn,
    marginTop: 14,
  },
  reason: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 4 },
});
