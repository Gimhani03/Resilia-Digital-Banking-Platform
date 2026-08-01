import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEMO_OTP,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  type AccountSummary,
  type BeneficiaryDto,
  type BillerDto,
  type TransactionDto,
  type UserProfile,
} from "@resilia/shared";
import * as Device from "expo-device";
import Constants from "expo-constants";

const API_PORT = 3001;

export const isDemoMode =
  String(process.env.EXPO_PUBLIC_DEMO_MODE || "false").toLowerCase() ===
  "true";

/**
 * A physical device can't reach the dev machine via "localhost", so fall back to
 * the LAN host Expo already used to serve the bundle.
 */
function resolveApiBase() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const isLoopback = (url: string) =>
    /\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:|\/|$)/.test(url);

  if (configured && !isLoopback(configured)) return configured;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants.expoConfig as { hostUri?: string } | undefined)?.hostUri ||
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;
  const lanHost = hostUri?.split(":")[0];

  if (lanHost && lanHost !== "localhost" && lanHost !== "127.0.0.1") {
    return `http://${lanHost}:${API_PORT}/api`;
  }
  return configured || `http://localhost:${API_PORT}/api`;
}

const API = resolveApiBase();

export function deviceFingerprint() {
  return `rn-${Device.modelName || "device"}-${Device.osName || "os"}`;
}

export function newIdempotencyKey() {
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type ApiOptions = RequestInit & {
  token?: string | null;
  skipAuthRefresh?: boolean;
  idempotencyKey?: string;
};

let onUnauthorized: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

const ACCESS_KEY = "resilia_access";
const REFRESH_KEY = "resilia_refresh";
const USER_KEY = "resilia_user";

async function secureSet(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureGet(key: string) {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch {
    /* fall through */
  }
  return AsyncStorage.getItem(key);
}

async function secureDelete(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
  await AsyncStorage.removeItem(key);
}

export async function saveSession(
  accessToken: string,
  user: unknown,
  refreshToken?: string | null,
) {
  await secureSet(ACCESS_KEY, accessToken);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) await secureSet(REFRESH_KEY, refreshToken);
}

export async function loadSession(): Promise<{
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
}> {
  const [token, refreshToken, userRaw] = await Promise.all([
    secureGet(ACCESS_KEY),
    secureGet(REFRESH_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);
  // migrate legacy key
  if (!token) {
    const legacy = await AsyncStorage.getItem("resilia_token");
    if (legacy) {
      await secureSet(ACCESS_KEY, legacy);
      await AsyncStorage.removeItem("resilia_token");
      return {
        token: legacy,
        refreshToken,
        user: userRaw ? (JSON.parse(userRaw) as UserProfile) : null,
      };
    }
  }
  return {
    token: token ?? null,
    refreshToken: refreshToken ?? null,
    user: userRaw ? (JSON.parse(userRaw) as UserProfile) : null,
  };
}

export async function clearSession() {
  await Promise.all([
    secureDelete(ACCESS_KEY),
    secureDelete(REFRESH_KEY),
    AsyncStorage.removeItem(USER_KEY),
    AsyncStorage.removeItem("resilia_token"),
  ]);
}

async function tryRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await secureGet(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      const userRaw = await AsyncStorage.getItem(USER_KEY);
      const user = userRaw ? JSON.parse(userRaw) : {};
      await saveSession(data.accessToken, user, data.refreshToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, skipAuthRefresh, idempotencyKey, ...rest } = options;
  const hdrs: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    ...(headers as Record<string, string>),
  };

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...rest, headers: hdrs });
  } catch {
    throw new Error(
      `Cannot reach the RESILIA API at ${API}. Check the API is running and that your device is on the same network.`,
    );
  }

  if (res.status === 401 && !skipAuthRefresh && token) {
    const next = await tryRefresh();
    if (next) {
      return api<T>(path, {
        ...options,
        token: next,
        skipAuthRefresh: true,
      });
    }
    await clearSession();
    onUnauthorized?.();
    throw new Error("Session expired. Please sign in again.");
  }

  if (res.status === 401) {
    await clearSession();
    onUnauthorized?.();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export { DEMO_OTP, DEMO_PASSWORD, DEMO_USERNAME };
export type { AccountSummary, BeneficiaryDto, BillerDto, TransactionDto, UserProfile };

export function formatLkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
  });
}

export async function requestStepUp(
  token: string | null | undefined,
  purpose: string,
): Promise<{ challengeId: string; demoOtp?: string }> {
  return api<{ challengeId: string; demoOtp?: string }>("/auth/mfa/step-up", {
    method: "POST",
    token,
    body: JSON.stringify({
      purpose,
      deviceFingerprint: deviceFingerprint(),
    }),
  });
}

export async function verifyStepUp(
  token: string | null | undefined,
  challengeId: string,
  code: string,
  method: "authenticator" | "sms" | "biometric" = "authenticator",
): Promise<{ verified: boolean; challengeId: string }> {
  return api<{ verified: boolean; challengeId: string }>("/auth/mfa/verify", {
    method: "POST",
    token,
    body: JSON.stringify({
      challengeId,
      code,
      method,
      deviceFingerprint: deviceFingerprint(),
    }),
  });
}

/** Demo/judge helper — only use when EXPO_PUBLIC_DEMO_MODE=true. */
export async function completeStepUpWithDemoOtp(
  token: string | null | undefined,
  purpose: string,
): Promise<{ challengeId: string }> {
  if (!isDemoMode) {
    throw new Error("Enter your authenticator code to continue");
  }
  const { challengeId } = await requestStepUp(token, purpose);
  await verifyStepUp(token, challengeId, DEMO_OTP);
  return { challengeId };
}
