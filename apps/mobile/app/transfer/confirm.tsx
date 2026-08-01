import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  ErrorBanner,
  Screen,
  ScreenHeader,
  StickyFooter,
} from "../../src/components/ui";
import { api, isDemoMode } from "../../src/lib/api";
import {
  StepUpPanel,
  completeStepUp,
  newIdempotencyKey,
  useStepUpCode,
} from "../../src/lib/stepup";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type Txn = {
  id: string;
  status: string;
  amount: number;
  fee?: number;
};

export default function TransferConfirmScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    payeeId: string;
    payeeName: string;
    payeeBank: string;
    payeeMask: string;
    accountId: string;
    amount: string;
    note?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaOpen, setMfaOpen] = useState(false);
  const [code, setCode] = useStepUpCode();
  const [forceHold, setForceHold] = useState(false);

  const amt = Number(params.amount) || 0;
  const fee = useMemo(() => (amt >= 100000 ? 50 : 25), [amt]);
  const likelyHold = amt >= 200000 || forceHold;

  async function startConfirm() {
    setMfaOpen(true);
    setError("");
  }

  async function verifyAndSend() {
    setLoading(true);
    setError("");
    try {
      const { challengeId } = await completeStepUp(token, "TRANSFER", code);
      const res = await api<Txn>("/payments/transfer", {
        method: "POST",
        token,
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify({
          accountId: params.accountId,
          beneficiaryId: params.payeeId || undefined,
          counterparty: `${params.payeeName} · ${params.payeeBank} ${params.payeeMask}`,
          amount: amt,
          note: params.note || undefined,
          forceHold: isDemoMode ? forceHold : false,
          mfaChallengeId: challengeId,
        }),
      });
      if (res.status === "HELD") router.replace(`/held/${res.id}`);
      else
        router.replace({
          pathname: "/transfer-receipt",
          params: { id: res.id },
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Screen>
          <ScreenHeader
            title="Confirm"
            onBack={() => router.back()}
            right={
              isDemoMode ? (
                <Pressable
                  onLongPress={() => setForceHold((v) => !v)}
                  accessibilityLabel="Demo hold toggle"
                  hitSlop={16}
                  style={{ minWidth: 48, alignItems: "flex-end" }}
                >
                  <Text style={styles.demoHold}>
                    {forceHold ? "HOLD ON" : " "}
                  </Text>
                </Pressable>
              ) : null
            }
          />
          <View style={styles.stepper}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.step, { backgroundColor: colors.crimson }]}
              />
            ))}
          </View>

          <Text style={styles.amount}>{`LKR ${amt.toLocaleString()}`}</Text>
          <Text style={styles.to}>
            to {params.payeeName}
            {"\n"}
            <Text style={styles.toMeta}>
              {params.payeeBank} · {params.payeeMask}
            </Text>
          </Text>

          <View style={styles.summary}>
            <Row label="Transfer fee" value={`LKR ${fee}`} />
            <Row label="Settlement" value="Instant · ledger posted" />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Fraud screening</Text>
              <Badge tone={likelyHold ? "warn" : "ok"}>
                {likelyHold ? "Likely hold" : "Pre-check OK"}
              </Badge>
            </View>
            <Row label="Total debit" value={`LKR ${amt + fee}`} />
          </View>

          <StepUpPanel
            visible={mfaOpen}
            code={code}
            onChangeCode={setCode}
          />
          <ErrorBanner message={error} />
        </Screen>
      </ScrollView>
      <StickyFooter>
        {mfaOpen ? (
          <Button
            title="Authorize transfer"
            onPress={verifyAndSend}
            loading={loading}
            disabled={code.length < 4}
          />
        ) : (
          <Button title="Confirm with MFA" onPress={startConfirm} />
        )}
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => router.back()}
        />
      </StickyFooter>
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
  stepper: { flexDirection: "row", gap: 6, marginBottom: 18 },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  amount: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.navy,
    textAlign: "center",
  },
  to: {
    textAlign: "center",
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.navy,
    marginTop: 8,
    marginBottom: 20,
  },
  toMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  summary: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  rowValue: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.navy },
  demoHold: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.crimson,
  },
});
