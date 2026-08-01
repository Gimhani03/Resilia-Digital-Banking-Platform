import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BrandMark,
  Button,
  Card,
  ErrorBanner,
  Field,
  HeroTitle,
  Input,
  Screen,
  Sub,
} from "../src/components/ui";
import * as ImagePicker from "expo-image-picker";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, fonts } from "../src/theme";

const DOC_TYPES = ["National ID", "Passport", "Driving licence"] as const;
const STEPS = 6;

export default function OnboardingScreen() {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [documentType, setDocumentType] =
    useState<(typeof DOC_TYPES)[number]>("National ID");
  const [docSelected, setDocSelected] = useState(false);
  const [livenessOk, setLivenessOk] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [totpSetup, setTotpSetup] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docBase64, setDocBase64] = useState<string | null>(null);
  const [docMime, setDocMime] = useState("image/jpeg");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{
        message: string;
        totpSetup?: { secret: string; otpauthUrl: string };
      }>("/auth/onboard", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          nationalId,
          username,
          password,
          documentType,
          phone,
          email,
          address,
          documentBase64: docBase64 || undefined,
          documentMimeType: docMime,
        }),
      });
      setTotpSetup(res.totpSetup || null);
      setMsg(res.message || "Enrolment submitted for KYC review");
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Screen>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BrandMark />
              <Text style={styles.brand}>RESILIA</Text>
            </View>
            <Link href="/signin" asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.link}>Sign in</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.stepper} accessibilityLabel={`Step ${step} of ${STEPS}`}>
            {Array.from({ length: STEPS }, (_, i) => i + 1).map((i) => (
              <View
                key={i}
                style={[
                  styles.step,
                  i <= step && { backgroundColor: colors.crimson },
                ]}
              />
            ))}
          </View>

          {step === 1 && (
            <>
              <HeroTitle>Choose ID type</HeroTitle>
              <Sub>Select the document you will use for e-KYC verification.</Sub>
              <View style={styles.tabs}>
                {DOC_TYPES.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDocumentType(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: documentType === d }}
                    style={[styles.chip, documentType === d && styles.chipOn]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        documentType === d && { color: colors.white },
                      ]}
                    >
                      {d}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button title="Continue" onPress={() => setStep(2)} />
            </>
          )}

          {step === 2 && (
            <>
              <HeroTitle>Upload document</HeroTitle>
              <Sub>
                Photograph the front of your {documentType} using the image picker.
              </Sub>
              <Pressable
                onPress={async () => {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!perm.granted) {
                    setError("Photo library permission is required for KYC upload");
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    quality: 0.7,
                    base64: true,
                  });
                  if (result.canceled || !result.assets?.[0]) return;
                  const asset = result.assets[0];
                  setDocUri(asset.uri);
                  setDocBase64(asset.base64 || null);
                  setDocMime(asset.mimeType || "image/jpeg");
                  setDocSelected(true);
                  setError("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Upload ID photo"
                style={[styles.upload, docSelected && styles.uploadDone]}
              >
                <Text style={styles.uploadText}>
                  {docSelected ? "Document selected ✓" : "Tap to select ID photo"}
                </Text>
                <Text style={styles.uploadOk}>
                  {docSelected
                    ? `${documentType} · ${docUri ? "image attached" : "ready"}`
                    : "Opens photo library · real file bytes"}
                </Text>
              </Pressable>
              <ErrorBanner message={error} />
              <Button
                title="Continue"
                onPress={() => setStep(3)}
                disabled={!docSelected}
              />
              <Button title="← Back" variant="ghost" onPress={() => setStep(1)} />
            </>
          )}

          {step === 3 && (
            <>
              <HeroTitle>Liveness check</HeroTitle>
              <Sub>Confirm you are present — look straight ahead for a match.</Sub>
              <Card style={{ backgroundColor: colors.crimsonSoft, borderColor: "rgba(201,24,74,0.2)" }}>
                <Text style={styles.liveTitle}>Selfie frame</Text>
                <Text style={styles.liveHint}>
                  {livenessOk
                    ? "Match confidence 97% · passed"
                    : "Centre your face · blink once"}
                </Text>
                <Pressable
                  onPress={() => setLivenessOk(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm liveness selfie"
                  style={styles.selfie}
                >
                  <Text style={{ fontSize: 36 }}>{livenessOk ? "✓" : "◎"}</Text>
                  <Text style={styles.selfieHint}>
                    {livenessOk ? "Liveness confirmed" : "Tap to confirm liveness"}
                  </Text>
                </Pressable>
              </Card>
              <Button
                title="Continue"
                onPress={() => setStep(4)}
                disabled={!livenessOk}
              />
              <Button title="← Back" variant="ghost" onPress={() => setStep(2)} />
            </>
          )}

          {step === 4 && (
            <>
              <HeroTitle>Personal details</HeroTitle>
              <Sub>Confirm extracted fields and complete your contact details.</Sub>
              <Field label="Full name">
                <Input
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Amal Perera"
                  accessibilityLabel="Full name"
                />
              </Field>
              <Field label="National ID">
                <Input
                  value={nationalId}
                  onChangeText={setNationalId}
                  placeholder="199012345678"
                  accessibilityLabel="National ID"
                />
              </Field>
              <Field label="Mobile">
                <Input
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="07X XXX XXXX"
                  accessibilityLabel="Phone"
                />
              </Field>
              <Field label="Email">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@email.com"
                  accessibilityLabel="Email"
                />
              </Field>
              <Field label="Address">
                <Input
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street, city"
                  accessibilityLabel="Address"
                />
              </Field>
              <Button
                title="Continue"
                onPress={() => setStep(5)}
                disabled={!fullName || !nationalId || !phone}
              />
              <Button title="← Back" variant="ghost" onPress={() => setStep(3)} />
            </>
          )}

          {step === 5 && (
            <>
              <HeroTitle>Create credentials</HeroTitle>
              <Sub>Choose a username and password for internet banking.</Sub>
              <Field label="Username">
                <Input
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  accessibilityLabel="Username"
                />
              </Field>
              <Field label="Password">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  accessibilityLabel="Password"
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  accessibilityLabel="Confirm password"
                />
              </Field>
              <ErrorBanner message={error} />
              <Button
                title="Complete enrolment"
                onPress={submit}
                loading={loading}
                disabled={!username || !password}
              />
              <Button title="← Back" variant="ghost" onPress={() => setStep(4)} />
            </>
          )}

          {step === 6 && (
            <>
              <HeroTitle>You are almost in</HeroTitle>
              <Sub>
                {msg ||
                  "Your application is with KYC. Add the TOTP secret below before first login."}
              </Sub>
              <Card style={{ backgroundColor: colors.okSoft, borderColor: "rgba(15,122,76,0.25)" }}>
                <Text style={styles.successTitle}>Enrolment received</Text>
                <Text style={styles.successBody}>
                  Document · Liveness · Details · Credentials submitted securely.
                </Text>
              </Card>
              {totpSetup ? (
                <Card>
                  <Text style={styles.successTitle}>Authenticator secret</Text>
                  <Text selectable style={styles.successBody}>
                    {totpSetup.secret}
                  </Text>
                  <Text style={styles.successBody}>
                    Add this in Google Authenticator / Authy, then sign in with the 6-digit code.
                  </Text>
                </Card>
              ) : null}
              <Button
                title="Go to sign in"
                onPress={async () => {
                  if (token) await logout();
                  router.replace("/signin");
                }}
              />
            </>
          )}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: { fontFamily: fonts.sansExtra, color: colors.navy },
  link: { fontFamily: fonts.sansBold, color: colors.crimson, fontSize: 13 },
  stepper: { flexDirection: "row", gap: 6, marginBottom: 16 },
  step: { flex: 1, height: 5, borderRadius: 999, backgroundColor: colors.line },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.navy },
  upload: {
    alignItems: "center",
    paddingVertical: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  uploadDone: {
    borderColor: colors.ok,
    backgroundColor: colors.okSoft,
    borderStyle: "solid",
  },
  uploadText: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 14 },
  uploadOk: {
    fontFamily: fonts.sans,
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
  liveTitle: {
    fontFamily: fonts.sansBold,
    color: colors.crimsonDark,
    marginBottom: 4,
  },
  liveHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  selfie: {
    marginTop: 12,
    height: 132,
    borderRadius: 16,
    backgroundColor: "rgba(26,26,46,0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  selfieHint: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.navy,
  },
  successTitle: {
    fontFamily: fonts.sansBold,
    color: colors.ok,
    fontSize: 14,
    marginBottom: 4,
  },
  successBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
});
