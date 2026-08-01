import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BeneficiaryDto } from "@resilia/shared";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ListRow,
  LoadingBlock,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function TransferSelectScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [payees, setPayees] = useState<BeneficiaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      setPayees(await api<BeneficiaryDto[]>("/payments/payees", { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payees");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load]),
  );

  function goAmount(b: BeneficiaryDto) {
    router.push({
      pathname: "/transfer/amount",
      params: {
        payeeId: b.id,
        payeeName: b.nickname || b.name,
        payeeBank: b.bankName,
        payeeMask: b.accountMask,
      },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Screen>
          <ScreenHeader title="Transfer" onBack={() => router.back()} />
          <View style={styles.stepper}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.step, i === 1 && { backgroundColor: colors.crimson }]}
              />
            ))}
          </View>
          <Text style={styles.hero}>Who are you paying?</Text>
          <Text style={styles.sub}>Pick a saved beneficiary or add someone new.</Text>
          <ErrorBanner message={error} />

          <Button
            title="Add new beneficiary"
            variant="secondary"
            onPress={() => router.push("/beneficiaries/new")}
          />
          <Button
            title="Transfer between my accounts"
            variant="ghost"
            onPress={() => router.push("/transfer/internal")}
          />

          <SectionLabel>Saved payees</SectionLabel>
          {loading ? (
            <LoadingBlock />
          ) : payees.length === 0 ? (
            <EmptyState
              title="No payees yet"
              body="Add a beneficiary to start an external transfer."
              actionLabel="Add beneficiary"
              onAction={() => router.push("/beneficiaries/new")}
            />
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {payees.map((b, i) => (
                <ListRow
                  key={b.id}
                  title={b.nickname || b.name}
                  subtitle={`${b.bankName} · ${b.accountMask}`}
                  onPress={() => goAmount(b)}
                  last={i === payees.length - 1}
                  right={<Text style={styles.chevron}>→</Text>}
                />
              ))}
            </Card>
          )}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", gap: 6, marginBottom: 16 },
  step: { flex: 1, height: 5, borderRadius: 999, backgroundColor: colors.line },
  hero: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.navy,
    marginBottom: 6,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    marginBottom: 16,
    lineHeight: 20,
  },
  chevron: { color: colors.muted, fontFamily: fonts.sansBold },
});
