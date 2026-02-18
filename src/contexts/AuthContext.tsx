import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "admin" | "driver";

interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole, name?: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, role: UserRole, name: string) => Promise<{ error: string | null }>;
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

  const loadUserProfile = async (supaUser: User) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("name").eq("user_id", supaUser.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", supaUser.id).single(),
      ]);
      const name = profileRes.data?.name ?? supaUser.email?.split("@")[0] ?? "User";
      const role = (roleRes.data?.role as UserRole) ?? "driver";
      setUser({ id: supaUser.id, name, email: supaUser.email, role });
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    return { error: null };
  }, []);

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
