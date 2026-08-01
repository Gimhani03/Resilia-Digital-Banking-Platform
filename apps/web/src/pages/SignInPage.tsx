import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AppHeader,
  BrandMark,
  Button,
  Content,
  Field,
  FooterNote,
  HeroTitle,
  Input,
  Sub,
  TrustPill,
} from "../components/ui";
import {
  DEMO_OTP,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  api,
  deviceFingerprint,
} from "../lib/api";
import { useAuth } from "../lib/auth";

type Method = "authenticator" | "sms" | "biometric";

export default function SignInPage() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [username, setUsername] = useState(DEMO_USERNAME);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState(false);
  const [method, setMethod] = useState<Method>("authenticator");
  const [code, setCode] = useState(DEMO_OTP);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startLogin() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{
        challengeId: string;
        newDevice: boolean;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          deviceFingerprint: deviceFingerprint(),
          deviceName: "Chrome · Demo browser",
          platform: "Web",
          location: "Colombo",
        }),
      });
      setChallengeId(res.challengeId);
      setNewDevice(res.newDevice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!challengeId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<{
        accessToken: string;
        user: {
          id: string;
          username: string;
          fullName: string;
          role?: string;
        };
      }>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({
          challengeId,
          code,
          method,
          deviceFingerprint: deviceFingerprint(),
        }),
      });
      if (res.user.role === "OFFICER") {
        nav("/ops/signin", { replace: true });
        return;
      }
      setSession(res.accessToken, res.user);
      nav("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "MFA failed");
    } finally {
      setLoading(false);
    }
  }

  const methods: { id: Method; label: string; hint: string; icon: string }[] = [
    { id: "authenticator", label: "Authenticator app", hint: "Recommended · 6-digit code", icon: "◉" },
    { id: "sms", label: "SMS OTP", hint: "Sent to ••78", icon: "◎" },
    { id: "biometric", label: "Biometric", hint: "Face ID / fingerprint", icon: "✦" },
  ];

  return (
    <>
      <AppHeader
        left={
          <div className="flex items-center gap-2.5 font-extrabold text-navy tracking-wide">
            <BrandMark />
            <span>RESILIA</span>
          </div>
        }
        right={
          <Link to="/onboarding" className="text-crimson text-[13px] font-bold">
            Help
          </Link>
        }
      />
      <Content>
        {(newDevice || !challengeId) && (
          <TrustPill>⚠ New device detected · extra verification required</TrustPill>
        )}
        <HeroTitle>Welcome back</HeroTitle>
        <Sub>
          Sign in with your password, then complete multi-factor authentication to
          access your accounts.
        </Sub>

        {!challengeId ? (
          <>
            <Field label="National ID / Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="text-crimson text-sm mb-3">{error}</p>}
            <Button disabled={loading} onClick={startLogin}>
              {loading ? "Checking…" : "Continue to MFA"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted mb-2 mt-2">
              Choose MFA method
            </p>
            <div className="grid gap-2.5 mb-5">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border-[1.5px] text-left ${
                    method === m.id
                      ? "border-crimson bg-crimson-soft"
                      : "border-line bg-white"
                  }`}
                >
                  <div className="w-[42px] h-[42px] rounded-xl bg-navy text-white grid place-items-center shrink-0">
                    {m.icon}
                  </div>
                  <div>
                    <strong className="block text-sm text-navy">{m.label}</strong>
                    <span className="text-xs text-muted">{m.hint}</span>
                  </div>
                </button>
              ))}
            </div>
            <Field label="Authenticator code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="tracking-[0.3em] font-extrabold text-center text-lg"
              />
            </Field>
            {error && <p className="text-crimson text-sm mb-3">{error}</p>}
            <Button disabled={loading} onClick={verify}>
              {loading ? "Verifying…" : "Verify & continue"}
            </Button>
            <Button variant="ghost" className="w-full mt-2" onClick={() => setChallengeId(null)}>
              ← Back
            </Button>
          </>
        )}
        <FooterNote>Protected by HSM-backed identity · Session expires in 15 min</FooterNote>
        <p className="text-center text-[11px] text-muted mt-2">
          Demo OTP <strong>{DEMO_OTP}</strong>
        </p>
      </Content>
    </>
  );
}
