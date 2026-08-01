import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Screen,
  ScreenHeader,
} from "../../src/components/ui";
import { api, type BeneficiaryDto } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function BeneficiariesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<BeneficiaryDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await api<BeneficiaryDto[]>("/payments/payees", { token }));
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

  async function remove(id: string) {
    try {
      await api(`/payments/payees/${id}`, { method: "DELETE", token });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScreenHeader
        title="Beneficiaries"
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => router.push("/beneficiaries/new")}>
            <Text style={styles.add}>Add</Text>
          </Pressable>
        }
      />
      <ScrollView>
        <Screen>
          <ErrorBanner message={error} />
          <Button title="Add payee" onPress={() => router.push("/beneficiaries/new")} />
          {loading && <LoadingBlock />}
          {!loading && rows.length === 0 && (
            <EmptyState
              title="No saved payees"
              body="Add a bank beneficiary to transfer faster next time."
              actionLabel="Add payee"
              onAction={() => router.push("/beneficiaries/new")}
            />
          )}
          {rows.map((b) => (
            <Card key={b.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{b.nickname || b.name}</Text>
                  <Text style={styles.meta}>
                    {b.bankName} · {b.accountMask}
                  </Text>
                </View>
                <Link
                  href={{
                    pathname: "/transfer",
                    params: {
                      beneficiaryId: b.id,
                      counterparty: `${b.name} · ${b.bankName} ${b.accountMask}`,
                    },
                  }}
                  asChild
                >
                  <Pressable>
                    <Text style={styles.pay}>Transfer</Text>
                  </Pressable>
                </Link>
              </View>
              <Button title="Remove" variant="ghost" onPress={() => remove(b.id)} />
            </Card>
          ))}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  add: { fontFamily: fonts.sansBold, color: colors.crimson, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 15 },
  meta: { fontFamily: fonts.sans, color: colors.muted, fontSize: 12, marginTop: 2 },
  pay: { fontFamily: fonts.sansBold, color: colors.crimson, fontSize: 13 },
});
