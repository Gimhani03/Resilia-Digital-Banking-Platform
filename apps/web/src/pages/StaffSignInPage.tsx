import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, deviceFingerprint } from "../lib/api";
import { useAuth } from "../lib/auth";

const DEMO_STAFF_USERNAME = "s.jayasuriya";
const DEMO_STAFF_PASSWORD = "OpsConsole2065!";
const DEMO_OTP = "482916";

export default function StaffSignInPage() {
  const navigate = useNavigate();
  const { token, user, setSession } = useAuth();
  const [username, setUsername] = useState(DEMO_STAFF_USERNAME);
  const [password, setPassword] = useState(DEMO_STAFF_PASSWORD);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState(DEMO_OTP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token && user?.role === "OFFICER") navigate("/ops", { replace: true });
  }, [token, user, navigate]);

  if (token && user?.role === "OFFICER") {
    return <Navigate to="/ops" replace />;
  }

  async function startLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{ challengeId: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          deviceFingerprint: deviceFingerprint(),
          deviceName: "RESILIA Operations Workstation",
          platform: "Web Ops",
          location: "Operations Centre",
        }),
      });
      setChallengeId(result.challengeId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Staff sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeId) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<{
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
          method: "authenticator",
          deviceFingerprint: deviceFingerprint(),
        }),
      });

      if (result.user.role !== "OFFICER") {
        throw new Error("This portal is restricted to authorised staff.");
      }
      setSession(result.accessToken, result.user);
      navigate("/ops", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "MFA verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="staff-login">
      <section className="staff-login__story">
        <a href="/" className="staff-login__brand" aria-label="RESILIA home">
          <span className="staff-login__mark">R</span>
          <span>
            <strong>RESILIA</strong>
            <small>SECURITY OPERATIONS</small>
          </span>
        </a>

        <div className="staff-login__message">
          <p className="staff-login__eyebrow">RESTRICTED SYSTEM · STAFF ONLY</p>
          <h1>Operational clarity when every second matters.</h1>
          <p>
            Monitor payment risk, decide credit applications, and verify the
            integrity of every critical action from one protected workspace.
          </p>
        </div>

        <div className="staff-login__status">
          <span><i /> Core banking online</span>
          <span>Encrypted session</span>
          <span>Audit monitored</span>
        </div>
      </section>

      <section className="staff-login__access">
        <div className="staff-login__panel">
          <div className="staff-login__lock" aria-hidden="true">⌁</div>
          <p className="staff-login__eyebrow">IDENTITY GATEWAY</p>
          <h2>{challengeId ? "Verify your identity" : "Staff access"}</h2>
          <p className="staff-login__intro">
            {challengeId
              ? "Enter the six-digit code from your registered authenticator."
              : "Use your assigned operations credentials. Customer accounts cannot enter this portal."}
          </p>

          {!challengeId ? (
            <form onSubmit={startLogin}>
              <label>
                Staff ID
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && <div className="staff-login__error">{error}</div>}
              <button type="submit" disabled={loading}>
                {loading ? "Checking credentials…" : "Continue securely"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyMfa}>
              <label>
                Authenticator code
                <input
                  className="staff-login__otp"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
              </label>
              {error && <div className="staff-login__error">{error}</div>}
              <button type="submit" disabled={loading || code.length < 6}>
                {loading ? "Verifying…" : "Enter operations console"}
              </button>
              <button
                type="button"
                className="staff-login__back"
                onClick={() => {
                  setChallengeId(null);
                  setError("");
                }}
              >
                Back to credentials
              </button>
            </form>
          )}

          <div className="staff-login__notice">
            Access is logged. Unauthorised use may trigger account suspension
            and security review.
          </div>
        </div>
      </section>
    </main>
  );
}
