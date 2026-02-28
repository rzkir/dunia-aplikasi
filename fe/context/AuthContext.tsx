"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { API_BASE_URL } from "@/lib/config";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ApiAuthResponse = {
  token?: string;
  user?: Accounts | null;
  account?: Accounts | null;
  error?: { message?: string; code?: string };
};

const TOKEN_STORAGE_KEY = "da_auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Accounts | null>(null);
  const [account, setAccount] = useState<Accounts | null>(null);
  const [loading, setLoading] = useState(true);

  const apiBaseUrl = API_BASE_URL;

  const authHeaders = useCallback((): HeadersInit => {
    // Tidak lagi menggunakan Authorization header, JWT disimpan di HttpOnly cookie
    return {};
  }, []);

  const apiFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const url = apiBaseUrl
        ? `${apiBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`
        : path;
      const headers: HeadersInit = {
        ...(init?.headers || {}),
        ...authHeaders(),
        "Content-Type": "application/json",
      };

      const res = await fetch(url, {
        ...init,
        headers,
        credentials: "include",
      });
      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          json = null;
        }
      }
      return { res, json };
    },
    [apiBaseUrl, authHeaders],
  );

    // Fetch account data from database
  const fetchAccount = useCallback(
    async (userId: string) => {
      try {
        const { res, json } = await apiFetch(`/accounts/${userId}`, {
          method: "GET",
        });
        if (!res.ok) {
          setAccount(null);
          return;
        }

        if (json) {
          setAccount(json as Accounts);
        } else {
          console.warn("No account data found for user:", userId);
          setAccount(null);
        }
      } catch (error) {
        console.error("Error fetching account:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
        }
        setAccount(null);
      }
    },
    [apiFetch],
  );

    // Refresh account data
  const refreshAccount = useCallback(async () => {
    if (user?.id) {
      await fetchAccount(user.id);
    }
  }, [user?.id, fetchAccount]);

    // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      try {
        const { res, json } = await apiFetch("/auth/me", { method: "GET" });
        if (!mounted) return;

        if (res.ok && json) {
          const data = json as ApiAuthResponse;
          const nextUser = (data.user ?? null) as Accounts | null;
          setUser(nextUser);
          setAccount((data.account ?? null) as Accounts | null);

          if (nextUser?.id && !data.account) {
            fetchAccount(nextUser.id).catch(console.error);
          }
        } else {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          setUser(null);
          setAccount(null);
        }
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getSession();

    return () => {
      mounted = false;
    };
  }, [apiFetch, fetchAccount]);

    // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      const { res, json } = await apiFetch("/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const payload = (json || {}) as ApiAuthResponse;
      if (!res.ok) {
        return {
          error: {
            message: payload.error?.message || "Sign in failed",
            status: res.status,
            code: payload.error?.code,
          },
        };
      }

      const nextUser = (payload.user ?? null) as Accounts | null;
      setUser(nextUser);
      setAccount((payload.account ?? null) as Accounts | null);
      if (nextUser?.id && !payload.account) await fetchAccount(nextUser.id);

      return { error: null as AuthError | null };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  };

    // Sign up
  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    phone?: string,
    namaToko?: string,
  ) => {
    try {
      const { res, json } = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName, phone, namaToko }),
      });

      const payload = (json || {}) as ApiAuthResponse;
      if (!res.ok) {
        return {
          error: {
            message: payload.error?.message || "Sign up failed",
            status: res.status,
            code: payload.error?.code,
          },
        };
      }

      const nextUser = (payload.user ?? null) as Accounts | null;
      setUser(nextUser);
      setAccount((payload.account ?? null) as Accounts | null);
      if (nextUser?.id && !payload.account) await fetchAccount(nextUser.id);

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

    // Sign out
  const signOut = async () => {
    try {
      await apiFetch("/auth/signout", { method: "POST" });
      setUser(null);
      setAccount(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

    // Update account
  const updateAccount = async (updates: Partial<Accounts>) => {
    if (!user?.id) return { error: new Error("User not authenticated") };

    try {
      const { res, json } = await apiFetch(`/accounts/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      if (!res.ok) return { error: new Error("Failed to update account") };

      setAccount((json as Accounts) ?? null);
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

  const value: AuthContextType = {
    user,
    account,
    loading,
    signIn,
    signUp,
    signOut,
    updateAccount,
    refreshAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}