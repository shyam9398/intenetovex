import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "admin" | "driver";

interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  city?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole, name?: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, role: UserRole, name: string, city?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isDriverPhoneEmail = useCallback((value?: string) => Boolean(value && value.endsWith("@ambulance.local")), []);

  const phoneFromDriverEmail = useCallback((value?: string) => {
    if (!isDriverPhoneEmail(value)) return null;
    return value?.replace("@ambulance.local", "") ?? null;
  }, [isDriverPhoneEmail]);

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, timeoutMs = 5000): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Profile loading timed out")), timeoutMs);
      }),
    ]);
  }, []);

  const loadUserProfile = useCallback(async (supaUser: User) => {
    try {
      const [profileRes, rolesRes] = await withTimeout(Promise.all([
        supabase.from("profiles").select("name").eq("user_id", supaUser.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", supaUser.id),
      ]), 15000);

      if (profileRes.error) {
        console.warn("Profile load warning:", profileRes.error.message);
      }
      if (rolesRes.error) {
        console.warn("Role load warning:", rolesRes.error.message);
      }

      const roles = (rolesRes.data ?? []).map((r) => r.role as UserRole);
      const role: UserRole = roles.includes("admin") ? "admin" : "driver";
      const phoneIdentity = phoneFromDriverEmail(supaUser.email);
      const name = role === "driver"
        ? (phoneIdentity ?? profileRes.data?.name ?? "Driver")
        : (profileRes.data?.name ?? supaUser.email?.split("@")[0] ?? "User");

      setUser({ id: supaUser.id, name, email: supaUser.email, role });
    } catch (err) {
      console.error("Failed to load user profile:", err);
      const fallbackName = phoneFromDriverEmail(supaUser.email) ?? supaUser.email?.split("@")[0] ?? "User";
      setUser({ id: supaUser.id, name: fallbackName, email: supaUser.email, role: "driver" });
    }
  }, [phoneFromDriverEmail, withTimeout]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        setSession(nextSession);
        if (nextSession?.user) {
          await loadUserProfile(nextSession.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth state change handling failed:", error);
        if (!nextSession?.user) setUser(null);
      } finally {
        setLoading(false);
      }
    });

    void initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signup = useCallback(async (
    email: string, password: string, role: UserRole, name: string
  ): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Signup failed" };

    const userId = data.user.id;

    const [profileError, roleError] = await Promise.all([
      supabase.from("profiles").insert({ user_id: userId, name }).then(r => r.error),
      supabase.from("user_roles").insert({ user_id: userId, role }).then(r => r.error),
    ]);

    if (profileError || roleError) {
      return { error: profileError?.message ?? roleError?.message ?? "Failed to save profile" };
    }

    // Reload profile now that role is inserted (fixes race condition with onAuthStateChange)
    if (data.user) {
      await loadUserProfile(data.user);
    }

    return { error: null };
  }, [loadUserProfile]);

  const login = useCallback(async (
    email: string, password: string, _role: UserRole, _name?: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
