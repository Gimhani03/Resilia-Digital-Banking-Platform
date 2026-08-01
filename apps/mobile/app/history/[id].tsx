import { useCallback, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TransactionDto } from "@resilia/shared";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  Screen,
  ScreenHeader,
  StatusBadge,
} from "../../src/components/ui";
import { api, formatLkr } from "../../src/lib/api";
import { completeStepUp, newIdempotencyKey } from "../../src/lib/stepup";
import { DEMO_OTP, isDemoMode } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [txn, setTxn] = useState<TransactionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError("");
    try {
      setTxn(await api<TransactionDto>(`/payments/${id}`, { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transaction");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load]),
  );

  async function shareReceipt() {
    if (!txn) return;
    const message = [
      "RESILIA payment receipt",
      `Amount: ${formatLkr(txn.amount)}`,
      `To/From: ${txn.counterparty}`,
      `Reference: ${txn.reference}`,
      `Status: ${txn.status}`,
      `Date: ${new Date(txn.createdAt).toLocaleString()}`,
      txn.fee != null ? `Fee: ${formatLkr(txn.fee)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await Share.share({ message, title: "RESILIA receipt" });
    } catch {
      /* user cancelled */
    }
  }

  async function submitDispute() {
    if (!txn || !disputeReason.trim()) {
      setError("Enter a dispute reason");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/payments/disputes", {
        method: "POST",
        token,
        body: JSON.stringify({
          transactionId: txn.id,
          reason: disputeReason,
        }),
      });
      Alert.alert("Dispute raised", "We logged an immutable audit entry.");
      setDisputeOpen(false);
      setDisputeReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dispute failed");
    } finally {
      setBusy(false);
    }
  }

  async function releaseHeld() {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const { challengeId } = await completeStepUp(
        token,
        "RELEASE",
        isDemoMode ? DEMO_OTP : undefined,
      );
      const res = await api<TransactionDto>(`/payments/${id}/release`, {
        method: "POST",
        token,
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify({ mfaChallengeId: challengeId }),
      });
      router.replace({
        pathname: "/transfer-receipt",
        params: { id: res.id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Screen>
          <ScreenHeader title="Receipt" onBack={() => router.back()} />
          <ErrorBanner message={error} />
          {loading || !txn ? (
            <LoadingBlock />
          ) : (
            <>
              <View style={styles.hero}>
                <StatusBadge status={txn.status} />
                <Text
                  style={[
                    styles.amount,
                    txn.direction === "IN" && { color: colors.ok },
                  ]}
                >
                  {txn.direction === "IN" ? "+" : "−"}
                  {formatLkr(txn.amount)}
                </Text>
                <Text style={styles.counterparty}>{txn.counterparty}</Text>
              </View>

              <Card>
                <Row label="Reference" value={txn.reference} />
                <Row label="Category" value={txn.category} />
                <Row
                  label="Date"
                  value={new Date(txn.createdAt).toLocaleString()}
                />
                {txn.settledAt ? (
                  <Row
                    label="Settled"
                    value={new Date(txn.settledAt).toLocaleString()}
                  />
                ) : null}
                {txn.fee != null ? (
                  <Row label="Fee" value={formatLkr(txn.fee)} />
                ) : null}
                {txn.note ? <Row label="Note" value={txn.note} /> : null}
                {txn.riskScore != null ? (
                  <Row label="Risk score" value={`${txn.riskScore}/100`} />
                ) : null}
                {txn.riskReason ? (
                  <Row label="Risk reason" value={txn.riskReason} />
                ) : null}
              </Card>

              <Button title="Share receipt" variant="secondary" onPress={shareReceipt} />

              {txn.status === "HELD" ? (
                <>
                  <Button
                    title="Review hold"
                    onPress={() => router.push(`/held/${txn.id}`)}
                  />
                  <Button
                    title="Release with MFA"
                    variant="secondary"
                    onPress={releaseHeld}
                    loading={busy}
                  />
                </>
              ) : null}

              {txn.direction === "OUT" && txn.status === "SETTLED" ? (
                <>
                  {!disputeOpen ? (
                    <Button
                      title="Raise dispute"
                      variant="ghost"
                      onPress={() => setDisputeOpen(true)}
                    />
                  ) : (
                    <Card>
                      <Field label="Dispute reason">
                        <Input
                          value={disputeReason}
                          onChangeText={setDisputeReason}
                          placeholder="Unrecognized charge…"
                          accessibilityLabel="Dispute reason"
                        />
                      </Field>
                      <Button
                        title="Submit dispute"
                        onPress={submitDispute}
                        loading={busy}
                      />
                      <Button
                        title="Cancel"
                        variant="ghost"
                        onPress={() => setDisputeOpen(false)}
                      />
                    </Card>
                  )}
                </>
              ) : null}
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
  hero: { alignItems: "center", marginBottom: 18, gap: 8 },
  amount: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.navy,
  },
  counterparty: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.navy,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  rowValue: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.navy,
    flex: 1,
    textAlign: "right",
  },
});
