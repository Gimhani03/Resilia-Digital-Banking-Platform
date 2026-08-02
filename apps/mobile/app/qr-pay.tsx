import { useCallback, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { AccountSummary } from "@resilia/shared";
import {
  AccountPicker,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Screen,
  ScreenHeader,
  StickyFooter,
} from "../src/components/ui";
import { api, formatLkr, isDemoMode } from "../src/lib/api";
import {
  StepUpPanel,
  completeStepUp,
  newIdempotencyKey,
  useStepUpCode,
} from "../src/lib/stepup";
import { useAuth } from "../src/lib/auth";
import {
  buildEmvQr,
  calculateQrTip,
  formatQrAmount,
  parseEmvQr,
  parseSimpleQr,
  type EmvQrData,
} from "../src/lib/emvqr";
import { colors, fonts } from "../src/theme";

const DEMO_QR = [
  {
    id: "keells",
    label: "Keells Super · Bambalapitiya",
    payload: buildEmvQr({
      merchantName: "KEELLS SUPER",
      merchantCity: "BAMBALAPITIYA",
      merchantId: "MID-KEELLS-BAM",
      amount: 1250,
      reference: "INV-8821",
      dynamic: true,
    }),
  },
  {
    id: "pickme",
    label: "PickMe Foods",
    payload: buildEmvQr({
      merchantName: "PICKME FOODS",
      merchantCity: "COLOMBO",
      merchantId: "MID-PICKME-COL",
      amount: 890,
      reference: "ORD-44102",
      dynamic: true,
    }),
  },
  {
    id: "dialog",
    label: "Dialog WiFi hotspot",
    payload: buildEmvQr({
      merchantName: "DIALOG WIFI",
      merchantCity: "COLOMBO",
      merchantId: "MID-DIALOG-WIFI",
      amount: 500,
      reference: "TOPUP",
      dynamic: true,
    }),
  },
];

export default function QrPayScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [payload, setPayload] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState("");
  const [qrInfo, setQrInfo] = useState<EmvQrData | null>(null);
  const [amountFromQr, setAmountFromQr] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountId, setAccountId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaOpen, setMfaOpen] = useState(false);
  const [code, setCode] = useStepUpCode();

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api<AccountSummary[]>("/accounts", { token }).then((a) => {
        const open = a.filter((x) => !x.frozen);
        setAccounts(open);
        setAccountId(open[0]?.id || "");
      });
    }, [token]),
  );

  const account = accounts.find((a) => a.id === accountId);
  const baseAmount = Number(amount) || 0;
  const tipAmount = calculateQrTip(qrInfo, baseAmount, Number(tip) || 0);
  const amt = baseAmount + tipAmount;

  function applyPayload(raw: string, label?: string) {
    const clean = raw.trim();
    try {
      const parsed = parseEmvQr(clean);
      const simple = parsed ? null : parseSimpleQr(clean);

      if (parsed && !parsed.crcValid) {
        setError("Invalid merchant QR checksum. Payment blocked for your safety.");
        return;
      }

      const qrAmount = parsed?.amount ?? simple?.amount;
      setQrInfo(parsed);
      setAmountFromQr(qrAmount != null);
      setPayload(clean);
      setMerchant(
        parsed
          ? [parsed.merchantName, parsed.merchantCity].filter(Boolean).join(" · ")
          : simple?.merchant
            ? [simple.merchant, simple.reference].filter(Boolean).join(" · ")
            : label || `Merchant · ${clean.slice(0, 18)}`,
      );
      setAmount(formatQrAmount(qrAmount));
      setTip("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid merchant QR");
      return;
    }
    setScanned(true);
    setCameraOn(false);
    setError("");
  }

  function selectDemo(item: (typeof DEMO_QR)[number]) {
    applyPayload(item.payload, item.label);
  }

  function confirmManual() {
    if (!payload.trim()) {
      setError("Enter a QR payload or scan a code");
      return;
    }
    applyPayload(payload.trim(), merchant || undefined);
  }

  async function enableCamera() {
    setError("");
    let res = permission;
    if (!res?.granted) res = await requestPermission();
    if (!res?.granted) {
      setBlocked(!res?.canAskAgain);
      setError(
        res?.canAskAgain === false
          ? "Camera access is blocked in system settings — enable it, or paste a payload below."
          : "Camera permission denied — paste a payload instead (fallback).",
      );
      return;
    }
    setBlocked(false);
    setCameraOn(true);
  }

  async function pay() {
    if (!accountId || amt <= 0 || !payload) {
      setError("Complete merchant and amount");
      return;
    }
    if (qrInfo && qrInfo.currency !== "LKR") {
      setError(`This account can only pay LKR QR codes, not ${qrInfo.currency}.`);
      return;
    }
    if (!mfaOpen) {
      setMfaOpen(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { challengeId } = await completeStepUp(token, "BILL", code);
      const res = await api<{ id: string; status: string }>("/payments/bill", {
        method: "POST",
        token,
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify({
          accountId,
          biller: qrInfo?.merchantId || merchant || payload,
          amount: amt,
          method: "QR",
          accountRef:
            qrInfo?.reference ||
            qrInfo?.billNumber ||
            qrInfo?.merchantId ||
            payload,
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
      setError(e instanceof Error ? e.message : "QR payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Screen>
          <ScreenHeader title="QR pay" onBack={() => router.back()} />
          <Text style={styles.lead}>
            Scan a merchant QR with the camera, or paste a payload as fallback.
          </Text>

          {!scanned ? (
            <>
              {cameraOn ? (
                <>
                  <View style={styles.cameraWrap}>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={
                        scanned
                          ? undefined
                          : ({ data }) => {
                              if (data) applyPayload(data);
                            }
                      }
                    />
                    <View pointerEvents="none" style={styles.reticle} />
                  </View>
                  <Button
                    title="Close camera"
                    variant="ghost"
                    onPress={() => setCameraOn(false)}
                  />
                </>
              ) : (
                <View style={styles.scanFrame}>
                  <Text style={styles.scanTitle}>Scan merchant QR</Text>
                  <Text style={styles.scanHint}>
                    Camera opens when permitted · otherwise paste below
                  </Text>
                  <Button title="Open camera" onPress={enableCamera} />
                  {blocked ? (
                    <Button
                      title="Open settings"
                      variant="ghost"
                      onPress={() => Linking.openSettings()}
                    />
                  ) : null}
                </View>
              )}
              <Field label="QR payload (fallback)">
                <Input
                  value={payload}
                  onChangeText={setPayload}
                  placeholder="QR|MERCHANT|BRANCH|REF"
                  autoCapitalize="characters"
                  accessibilityLabel="QR payload"
                />
              </Field>
              {isDemoMode ? (
                <>
                  <Text style={styles.section}>Demo merchants</Text>
                  {DEMO_QR.map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() => selectDemo(d)}
                      style={styles.demoRow}
                      accessibilityRole="button"
                      accessibilityLabel={d.label}
                    >
                      <Text style={styles.demoTitle}>{d.label}</Text>
                      <Text style={styles.demoPayload}>{d.payload}</Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
              <ErrorBanner message={error} />
              <Button title="Use payload" onPress={confirmManual} />
            </>
          ) : (
            <>
              <Card
                style={{
                  backgroundColor: colors.crimsonSoft,
                  borderColor: "rgba(201,24,74,0.2)",
                }}
              >
                <Text style={styles.merchant}>{merchant}</Text>
                {qrInfo ? (
                  <>
                    <Text style={styles.standard}>
                      ✓ EMVCo / LankaQR-compatible payload
                    </Text>
                    <View style={styles.qrDetails}>
                      <Text style={styles.qrDetail}>
                        Currency: {qrInfo.currency}
                      </Text>
                      <Text style={styles.qrDetail}>
                        Type: {qrInfo.initiationMethod.toUpperCase()}
                      </Text>
                      {qrInfo.merchantId ? (
                        <Text style={styles.qrDetail}>
                          Merchant ID: {qrInfo.merchantId}
                        </Text>
                      ) : null}
                      {qrInfo.reference || qrInfo.billNumber ? (
                        <Text style={styles.qrDetail}>
                          Reference: {qrInfo.reference || qrInfo.billNumber}
                        </Text>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <Text style={styles.payload}>{payload}</Text>
                )}
              </Card>
              <Field label={`Amount (${qrInfo?.currency || "LKR"})`}>
                <Input
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  editable={!amountFromQr}
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 24,
                    opacity: amountFromQr ? 0.7 : 1,
                  }}
                  accessibilityLabel="Amount"
                />
              </Field>
              {amountFromQr ? (
                <Text style={styles.lockedHint}>
                  Amount supplied by the merchant QR and cannot be edited.
                </Text>
              ) : qrInfo?.initiationMethod === "static" ? (
                <Text style={styles.lockedHint}>
                  Static merchant QR — enter the amount you want to pay.
                </Text>
              ) : null}
              {qrInfo?.tip.type === "prompt" ? (
                <Field label="Tip (optional)">
                  <Input
                    value={tip}
                    onChangeText={setTip}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    accessibilityLabel="Tip"
                  />
                </Field>
              ) : null}
              {qrInfo?.tip.type === "fixed" ||
              qrInfo?.tip.type === "percentage" ? (
                <Text style={styles.tipLine}>
                  Merchant convenience fee: {formatLkr(tipAmount)}
                  {qrInfo.tip.type === "percentage"
                    ? ` (${qrInfo.tip.value}%)`
                    : ""}
                </Text>
              ) : null}
              {tipAmount > 0 ? (
                <Text style={styles.total}>Total: {formatLkr(amt)}</Text>
              ) : null}
              <Text style={styles.label}>Pay from</Text>
              <Pressable
                style={styles.picker}
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.pickerTitle}>
                  {account?.nickname || account?.label || "Select account"}
                </Text>
                <Text style={styles.pickerMeta}>
                  {account
                    ? `${account.mask} · ${formatLkr(account.available)}`
                    : ""}
                </Text>
              </Pressable>
              <StepUpPanel
                visible={mfaOpen}
                code={code}
                onChangeCode={setCode}
              />
              <ErrorBanner message={error} />
              <Button
                title="Rescan"
                variant="ghost"
                onPress={() => {
                  setScanned(false);
                  setMfaOpen(false);
                  setQrInfo(null);
                  setAmountFromQr(false);
                  setPayload("");
                  setMerchant("");
                  setAmount("");
                  setTip("");
                }}
              />
            </>
          )}
        </Screen>
      </ScrollView>
      {scanned ? (
        <StickyFooter>
          <Button
            title={mfaOpen ? "Authorize payment" : "Pay with MFA"}
            onPress={pay}
            loading={loading}
            disabled={
              !accountId ||
              amt <= 0 ||
              (qrInfo !== null && qrInfo.currency !== "LKR") ||
              (mfaOpen && code.length < 4)
            }
          />
        </StickyFooter>
      ) : null}
      <AccountPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        accounts={accounts}
        selectedId={accountId}
        onSelect={(a) => setAccountId(a.id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    marginBottom: 14,
    lineHeight: 20,
  },
  cameraWrap: {
    height: 280,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#000",
  },
  reticle: {
    position: "absolute",
    top: 50,
    left: 50,
    right: 50,
    bottom: 50,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
  },
  scanFrame: {
    minHeight: 160,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.navy,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    padding: 16,
    gap: 10,
  },
  scanTitle: {
    fontFamily: fonts.sansExtra,
    fontSize: 16,
    color: colors.navy,
    marginBottom: 6,
  },
  scanHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
  section: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  demoRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  demoTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.navy },
  demoPayload: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  merchant: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.crimsonDark,
    marginBottom: 4,
  },
  payload: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  standard: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.crimsonDark,
    marginTop: 4,
  },
  qrDetails: { gap: 3, marginTop: 10 },
  qrDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.navy },
  lockedHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: -8,
    marginBottom: 14,
  },
  tipLine: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.navy,
    marginBottom: 12,
  },
  total: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.crimsonDark,
    marginBottom: 14,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.navy,
    marginBottom: 7,
  },
  picker: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  pickerTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.navy },
  pickerMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
});
