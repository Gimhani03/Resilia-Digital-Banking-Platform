import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, Button, Card, HeroTitle, Screen, Sub } from "../src/components/ui";
import { api, formatLkr } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, fonts } from "../src/theme";

type Txn = {
  id: string;
  reference: string;
  counterparty: string;
  amount: number;
  fee: number;
  status: string;
};

export default function TransferReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [txn, setTxn] = useState<Txn | null>(null);

  useEffect(() => {
    if (id) api<Txn>(`/payments/${id}`, { token }).then(setTxn);
  }, [id, token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <View style={styles.center}>
            <View style={styles.check}>
              <Text style={styles.checkText}>✓</Text>
            </View>
            <HeroTitle>Transfer settled</HeroTitle>
            <Sub>Saga completed · balances updated · audit event chained</Sub>
          </View>
          <Card>
            <Row label="Amount" value={txn ? formatLkr(txn.amount) : "…"} />
            <Row label="Fee" value={txn ? formatLkr(txn.fee) : "…"} />
            <Row label="To" value={txn?.counterparty || "…"} />
            <Row label="Reference" value={txn?.reference || "…"} />
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <Badge>{txn?.status || "…"}</Badge>
            </View>
          </Card>
          <Button title="Back to home" onPress={() => router.replace("/(tabs)")} />
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", marginVertical: 24 },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.okSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  checkText: { color: colors.ok, fontSize: 28, fontFamily: fonts.sansBold },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  label: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  value: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.navy,
    maxWidth: "60%",
    textAlign: "right",
  },
});
