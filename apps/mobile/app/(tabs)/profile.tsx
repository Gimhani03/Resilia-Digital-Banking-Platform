import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  HeroTitle,
  Screen,
  SectionLabel,
  Sub,
} from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type Device = {
  id: string;
  name: string;
  platform: string;
  location: string;
  trusted: boolean;
  pending: boolean;
  lastSeen: string;
};

export default function ProfileScreen() {
  const { token, user, logout } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);

  const load = useCallback(async () => {
    setDevices(await api<Device[]>("/auth/devices", { token }));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load]),
  );

  async function decide(id: string, approve: boolean) {
    await api(`/auth/devices/${id}/decide`, {
      method: "POST",
      token,
      body: JSON.stringify({ approve }),
    });
    load();
  }

  async function signOut() {
    await logout();
    router.replace("/signin");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView>
        <Screen>
          <View style={styles.header}>
            <Text style={styles.title}>More</Text>
            <Pressable onPress={signOut}>
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
          </View>
          <HeroTitle>{user?.fullName}</HeroTitle>
          <Sub>Trusted devices, pending approvals, and MFA methods (FR-02 / FR-03).</Sub>

          <View style={styles.grid}>
            {[
              { href: "/notifications", label: "Notifications" },
              { href: "/security", label: "Freeze & dispute" },
              { href: "/history", label: "Transaction history" },
              { href: "/loans", label: "Loans" },
              { href: "/accounts", label: "Accounts" },
              { href: "/beneficiaries", label: "Beneficiaries" },
              { href: "/statements", label: "Statements" },
              { href: "/profile-edit", label: "Profile & password" },
              { href: "/help", label: "Help & support" },
            ].map((item) => (
              <Link key={item.href} href={item.href as any} asChild>
                <Pressable style={styles.gridItem}>
                  <Text style={styles.gridText}>{item.label}</Text>
                </Pressable>
              </Link>
            ))}
          </View>

          <SectionLabel>MFA methods</SectionLabel>
          <Card>
            <Text style={styles.mfaPrimary}>Authenticator app · Primary</Text>
            <Text style={styles.mfaBackup}>
              SMS OTP · Backup ·••{user?.phoneLast4 || "78"}
            </Text>
          </Card>

          <SectionLabel>Devices</SectionLabel>
          {devices.map((d) => (
            <Card key={d.id}>
              <View style={styles.deviceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName}>{d.name}</Text>
                  <Text style={styles.deviceMeta}>
                    {d.platform} · {d.location}
                  </Text>
                  <Text style={styles.deviceSeen}>
                    Last seen {new Date(d.lastSeen).toLocaleString()}
                  </Text>
                </View>
                {d.pending ? (
                  <Badge tone="warn">Pending</Badge>
                ) : d.trusted ? (
                  <Badge>Trusted</Badge>
                ) : (
                  <Badge tone="danger">Denied</Badge>
                )}
              </View>
              {d.pending && (
                <View style={{ gap: 8, marginTop: 10 }}>
                  <Button title="Approve" onPress={() => decide(d.id, true)} />
                  <Button
                    title="Deny"
                    variant="secondary"
                    onPress={() => decide(d.id, false)}
                  />
                </View>
              )}
            </Card>
          ))}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8,
  },
  title: { fontFamily: fonts.sansExtra, color: colors.navy },
  link: { fontFamily: fonts.sansBold, color: colors.crimson, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  gridItem: {
    width: "48%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  gridText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.navy },
  mfaPrimary: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 14 },
  mfaBackup: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 4 },
  deviceRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  deviceName: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 14 },
  deviceMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  deviceSeen: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 4 },
});
