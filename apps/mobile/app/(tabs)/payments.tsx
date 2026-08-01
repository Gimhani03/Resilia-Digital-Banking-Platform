import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  HeroTitle,
  Screen,
  ScreenHeader,
  Sub,
} from "../../src/components/ui";
import { colors, fonts } from "../../src/theme";

const ACTIONS = [
  {
    href: "/bills",
    title: "Pay a bill",
    body: "CEB, water, telecom and more from the biller catalog",
  },
  {
    href: "/qr-pay",
    title: "Merchant QR",
    body: "Simulate a QR scan and pay with MFA",
  },
  {
    href: "/transfer",
    title: "Bank transfer",
    body: "Send to a saved beneficiary or new payee",
  },
  {
    href: "/beneficiaries",
    title: "Beneficiaries",
    body: "Manage your payee book",
  },
  {
    href: "/transfer/internal",
    title: "Between my accounts",
    body: "Move money across Savings and Current",
  },
  {
    href: "/statements",
    title: "Statements",
    body: "Date-range activity for any linked account",
  },
] as const;

export default function PaymentsHubScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView>
        <Screen>
          <Text style={styles.title}>Pay</Text>
          <HeroTitle>Move money</HeroTitle>
          <Sub>
            Bills, QR, transfers, and own-account moves — each financial action
            requires MFA step-up.
          </Sub>
          {ACTIONS.map((a) => (
            <Pressable key={a.href} onPress={() => router.push(a.href as any)}>
              <Card>
                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardBody}>{a.body}</Text>
              </Card>
            </Pressable>
          ))}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.sansExtra, color: colors.navy, marginTop: 8, marginBottom: 8 },
  cardTitle: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 15 },
  cardBody: { fontFamily: fonts.sans, color: colors.muted, fontSize: 12, marginTop: 4 },
});
