import { ScrollView, StyleSheet, Text, View, Linking, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, HeroTitle, Screen, Sub, Button } from "../src/components/ui";
import { colors, fonts } from "../src/theme";

const FAQS = [
  {
    q: "How do I freeze my card?",
    a: "Open Cards or Security → Freeze. The freeze is instant and writes an immutable audit entry.",
  },
  {
    q: "Why was my payment held?",
    a: "RESILIA screens every payment in real time. High-risk patterns are held for your confirmation within 24 hours.",
  },
  {
    q: "How do I add a beneficiary?",
    a: "Go to Pay → Beneficiaries → Add payee. Saved payees speed up future transfers.",
  },
  {
    q: "What is the demo OTP?",
    a: "For hackathon judges: authenticator / SMS code is 482916.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView>
        <Screen>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <HeroTitle>Help & support</HeroTitle>
          <Sub>
            Self-serve answers, branch-assisted e-KYC guidance, and secure contact
            channels.
          </Sub>

          <Card style={{ backgroundColor: colors.navy }}>
            <Text style={styles.heroLabel}>24/7 Security desk</Text>
            <Text style={styles.heroTitle}>Suspicious activity?</Text>
            <Text style={styles.heroBody}>
              Freeze first, then call. Never share OTP codes with anyone claiming to be
              RESILIA staff.
            </Text>
            <Button
              title="Freeze & dispute"
              onPress={() => router.push("/security")}
            />
          </Card>

          {FAQS.map((f) => (
            <Card key={f.q}>
              <Text style={styles.q}>{f.q}</Text>
              <Text style={styles.a}>{f.a}</Text>
            </Card>
          ))}

          <Button
            title="Open a new account (e-KYC)"
            variant="secondary"
            onPress={() => router.push("/onboarding")}
          />
          <Button
            title="Call support · 1919"
            variant="ghost"
            onPress={() => Linking.openURL("tel:1919")}
          />
          <Text style={styles.version}>RESILIA Mobile · Phase 01 · Cybernauts</Text>
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
  heroLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.white,
    marginVertical: 6,
  },
  heroBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    marginBottom: 12,
  },
  q: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 14, marginBottom: 6 },
  a: { fontFamily: fonts.sans, color: colors.muted, fontSize: 13, lineHeight: 19 },
  version: {
    textAlign: "center",
    marginTop: 18,
    marginBottom: 24,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
  },
});
