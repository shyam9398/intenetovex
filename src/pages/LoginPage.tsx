import React, { useState } from "react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Ambulance, ShieldCheck, Loader2, Phone, KeyRound, Mail, Lock, User } from "lucide-react";

type AuthMode = "login" | "signup";
type Step = "phone" | "otp";

const generateOTP = () => String(Math.floor(1000 + Math.random() * 9000));

const LoginPage: React.FC = () => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>("driver");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Driver fields (phone OTP)
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [enteredOTP, setEnteredOTP] = useState("");

  // Admin fields (email/password)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminName, setAdminName] = useState("");

  const normalizePhone = (p: string) => p.replace(/[^0-9]/g, "");
  const phoneToEmail = (p: string) => `${normalizePhone(p)}@ambulance.local`;
  const phoneToPassword = (p: string) => `amb_${normalizePhone(p)}_secure`;

  const resetFlow = () => {
    setStep("phone");
    setEnteredOTP("");
    setGeneratedOTP("");
    setError(null);
  };

  // ── Driver: Send OTP ──
  const handleSendOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number (min 10 digits)");
      return;
    }
    const otp = generateOTP();
    setGeneratedOTP(otp);
    setStep("otp");
  };

  // ── Driver: Verify OTP ──
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (enteredOTP !== generatedOTP) {
      setError("Incorrect OTP. Please try again.");
      return;
    }
    setLoading(true);
    const mappedEmail = phoneToEmail(phone);
    const mappedPassword = phoneToPassword(phone);

    const driverIdentity = normalizePhone(phone);

    if (mode === "signup") {
      const { error } = await signup(mappedEmail, mappedPassword, "driver", driverIdentity);
      if (error) {
        if (error.includes("already") || error.includes("exists")) {
          const loginRes = await login(mappedEmail, mappedPassword, "driver");
          if (loginRes.error) setError(loginRes.error);
        } else {
          setError(error);
        }
      }
    } else {
      const { error } = await login(mappedEmail, mappedPassword, "driver");
      if (error) {
        if (error.includes("Invalid login")) {
          setError("No account found. Please sign up first.");
        } else {
          setError(error);
        }
      }
    }
    setLoading(false);
  };

  // ── Admin: Email/Password ──
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    if (mode === "signup" && !adminName.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    if (mode === "signup") {
      const { error } = await signup(email, password, "admin", adminName.trim());
      if (error) setError(error);
    } else {
      const { error } = await login(email, password, "admin");
      if (error) setError(error);
    }
    setLoading(false);
  };

  const isDriver = role === "driver";

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
              onClick={() => { setMode(m); resetFlow(); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-lg">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Role</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "admin" as UserRole, label: "Admin", icon: ShieldCheck, desc: "Email login" },
                { value: "driver" as UserRole, label: "Driver", icon: Ambulance, desc: "Phone login" },
              ]).map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => { setRole(r.value); resetFlow(); setError(null); }}
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

          {/* ── ADMIN: Email/Password Form ── */}
          {!isDriver && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Admin name"
                      className="w-full pl-10 pr-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === "login" ? "Sign In" : "Create Admin Account"}
              </button>
            </form>
          )}

          {/* ── DRIVER: Phone OTP Flow ── */}
          {isDriver && (
            <AnimatePresence mode="wait">
              {step === "phone" ? (
                <motion.form key="phone-step" onSubmit={handleSendOTP} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2">
                    <Phone className="w-4 h-4" /> Send OTP
                  </button>
                </motion.form>
              ) : (
                <motion.form key="otp-step" onSubmit={handleVerifyOTP} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Simulated OTP sent to {phone}</p>
                    <p className="text-2xl font-bold font-mono text-success tracking-[0.3em]">{generatedOTP}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Enter this code below</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Enter OTP</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text" inputMode="numeric" maxLength={4}
                        value={enteredOTP} onChange={(e) => setEnteredOTP(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="_ _ _ _"
                        className="w-full pl-10 pr-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    type="submit" disabled={loading || enteredOTP.length !== 4}
                    className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Verify & {mode === "login" ? "Sign In" : "Create Account"}
                  </button>
                  <button type="button" onClick={resetFlow} className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    ← Change phone number
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
