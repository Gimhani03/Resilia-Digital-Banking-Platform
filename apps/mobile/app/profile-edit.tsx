import { useEffect, useState } from "react";
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
} from "../src/components/ui";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, fonts } from "../src/theme";

type Profile = {
  id: string;
  username: string;
  fullName: string;
  nationalId: string;
  email: string;
  phone: string;
  address: string;
  phoneLast4: string;
  kycStatus: string;
};

export default function ProfileEditScreen() {
  const { token, user, setSession } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Profile>("/auth/me", { token })
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName || "");
        setEmail(p.email || "");
        setPhone(p.phone || "");
        setAddress(p.address || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [token]);

  async function saveProfile() {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const updated = await api<Profile>("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ fullName, email, phone, address }),
      });
      if (token && user) {
        await setSession(token, { ...user, fullName: updated.fullName, phoneLast4: updated.phoneLast4 });
      }
      setProfile(updated);
      setMsg("Profile updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      await api("/auth/change-password", {
        method: "POST",
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setMsg("Password changed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password change failed");
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
          <HeroTitle>Profile & security</HeroTitle>
          <Sub>
            Update contact details and password. KYC status:{" "}
            {profile?.kycStatus || "…"}.
          </Sub>

          {!!msg && (
            <Card style={{ backgroundColor: colors.okSoft }}>
              <Text style={{ fontFamily: fonts.sansBold, color: colors.ok }}>{msg}</Text>
            </Card>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Card>
            <Text style={styles.block}>Identity</Text>
            <Text style={styles.meta}>Username · {profile?.username}</Text>
            <Text style={styles.meta}>NIC · {profile?.nationalId}</Text>
          </Card>

          <Field label="Full name">
            <Input value={fullName} onChangeText={setFullName} />
          </Field>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </Field>
          <Field label="Address">
            <Input value={address} onChangeText={setAddress} />
          </Field>
          <Button
            title={loading ? "Saving…" : "Save profile"}
            onPress={saveProfile}
            disabled={loading}
          />

          <View style={{ height: 18 }} />
          <Text style={styles.block}>Change password</Text>
          <Field label="Current password">
            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
          </Field>
          <Field label="New password">
            <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          </Field>
          <Button
            title="Update password"
            variant="secondary"
            onPress={changePassword}
            disabled={loading || newPassword.length < 8}
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
  block: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  meta: { fontFamily: fonts.sans, fontSize: 13, color: colors.navy, marginBottom: 4 },
  error: { color: colors.crimson, marginBottom: 8, fontFamily: fonts.sans },
});
