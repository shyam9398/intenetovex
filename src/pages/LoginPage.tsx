import React, { useState } from "react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Ambulance, ShieldCheck, Loader2 } from "lucide-react";

type AuthMode = "login" | "signup";

const LoginPage: React.FC = () => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("driver");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "signup") {
      if (!name.trim()) { setError("Name is required"); setLoading(false); return; }
      if (!email.trim()) { setError("Email is required"); setLoading(false); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
      const { error } = await signup(email.trim(), password, role, name.trim());
      if (error) {
        setError(error);
      } else {
        setInfo("Account created! Please check your email to confirm, then sign in.");
        setMode("login");
      }
    } else {
      if (!email.trim()) { setError("Email is required"); setLoading(false); return; }
      if (!password) { setError("Password is required"); setLoading(false); return; }
      const { error } = await login(email.trim(), password, role);
      if (error) setError(error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Ambulance className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Smart Ambulance</h1>
          <p className="text-sm text-muted-foreground mt-1">Traffic Clearance System</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex mb-4 bg-secondary rounded-lg p-1">
          {(["login", "signup"] as AuthMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {info && (
          <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-lg text-sm text-success text-center">
            {info}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-lg">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Role</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "admin" as UserRole, label: "Admin", icon: ShieldCheck, desc: "Manage & monitor" },
                { value: "driver" as UserRole, label: "Driver", icon: Ambulance, desc: "Field operations" },
              ]).map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all ${
                    role === r.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  <r.icon className="w-5 h-5" />
                  <span className="text-sm font-semibold">{r.label}</span>
                  <span className="text-[10px] opacity-70">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name (signup only) */}
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginPage;
