import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearSession,
  loadSession,
  saveSession,
  setUnauthorizedHandler,
} from "./api";

export type User = {
  id: string;
  username: string;
  fullName: string;
  nationalId?: string;
  email?: string;
  phone?: string;
  phoneLast4?: string;
  address?: string;
  role?: string;
  kycStatus?: string;
  totpEnabled?: boolean;
};

type AuthState = {
  ready: boolean;
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (
    token: string,
    user: User,
    refreshToken?: string | null,
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadSession().then(({ token: t, refreshToken: r, user: u }) => {
      setToken(t);
      setRefreshToken(r);
      setUser(u);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const setSession = useCallback(
    async (t: string, u: User, r?: string | null) => {
      await saveSession(t, u, r);
      setToken(t);
      if (r !== undefined) setRefreshToken(r);
      setUser(u);
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const me = await api<User>("/auth/me", { token });
    await saveSession(token, me, refreshToken);
    setUser(me);
  }, [token, refreshToken]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await api("/auth/logout", {
          method: "POST",
          token,
          body: JSON.stringify({ refreshToken }),
        }).catch(() => undefined);
      }
    } finally {
      await clearSession();
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  }, [token, refreshToken]);

  const value = useMemo(
    () => ({
      ready,
      token,
      refreshToken,
      user,
      setSession,
      refreshProfile,
      logout,
    }),
    [ready, token, refreshToken, user, setSession, refreshProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
