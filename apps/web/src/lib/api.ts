import { DEMO_OTP, DEMO_PASSWORD, DEMO_USERNAME } from "@resilia/shared";

const API = "/api";

export function deviceFingerprint() {
  const key = "resilia_device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = `web-${crypto.randomUUID()}`;
    localStorage.setItem(key, fp);
  }
  return fp;
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

export { DEMO_OTP, DEMO_PASSWORD, DEMO_USERNAME };

export function formatLkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
