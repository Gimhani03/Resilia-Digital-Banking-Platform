import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import {
  Card,
  Field,
  Input,
} from "../components/ui";
import {
  DEMO_OTP,
  isDemoMode,
  newIdempotencyKey,
  requestStepUp,
  verifyStepUp,
} from "./api";
import { colors, fonts } from "../theme";

/** Map UI purposes onto API-allowed step-up purposes. */
export function normalizePurpose(
  purpose: string,
): "TRANSFER" | "BILL" | "RELEASE" | "FREEZE" | "DISPUTE" {
  if (purpose === "QR_PAY" || purpose === "BILL_PAY") return "BILL";
  if (purpose === "RELEASE_HOLD") return "RELEASE";
  if (
    purpose === "TRANSFER" ||
    purpose === "BILL" ||
    purpose === "RELEASE" ||
    purpose === "FREEZE" ||
    purpose === "DISPUTE"
  ) {
    return purpose;
  }
  return "TRANSFER";
}

export async function completeStepUp(
  token: string | null | undefined,
  purpose: string,
  code?: string,
): Promise<{ challengeId: string }> {
  const p = normalizePurpose(purpose);
  const { challengeId, demoOtp } = await requestStepUp(token, p);
  const otp = code || (isDemoMode ? demoOtp || DEMO_OTP : "");
  if (!otp || otp.length < 4) {
    throw new Error("Authenticator code required");
  }
  await verifyStepUp(token, challengeId, otp);
  return { challengeId };
}

export { newIdempotencyKey };

type StepUpPanelProps = {
  visible: boolean;
  code: string;
  onChangeCode: (v: string) => void;
  title?: string;
};

export function StepUpPanel({
  visible,
  code,
  onChangeCode,
  title = "Step-up MFA",
}: StepUpPanelProps) {
  if (!visible) return null;
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>
        Enter the 6-digit code from your authenticator app.
      </Text>
      <Field label="Authenticator code">
        <Input
          value={code}
          onChangeText={onChangeCode}
          keyboardType="number-pad"
          accessibilityLabel="MFA code"
          style={{
            letterSpacing: 6,
            textAlign: "center",
            fontFamily: fonts.sansExtra,
          }}
        />
      </Field>
      {isDemoMode ? (
        <Text style={styles.demo}>Demo OTP · {DEMO_OTP}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.navy,
    marginBottom: 6,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
  },
  demo: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
});

/** Hook-friendly defaults for MFA code field. */
export function useStepUpCode(initial = isDemoMode ? DEMO_OTP : "") {
  return useState(initial);
}
