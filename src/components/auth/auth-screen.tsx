"use client";

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type UserCredential,
} from "firebase/auth";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  FlaskConical,
  Link2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";
import { getClientAuth } from "@/lib/firebase/client";
import { safeNextPath } from "@/lib/safe-redirect";

type Mode = "signin" | "signup";
type Errors = Partial<Record<"name" | "email" | "password" | "terms", string>>;
type Notice = { kind: "ok" | "bad"; text: string } | null;

const COPY = {
  signin: {
    title: (
      <>
        Welcome back to <span className="grad-text">{BRAND.name}</span>
      </>
    ),
    sub: "Sign in to your validation workspace.",
    cta: "Sign in to workspace",
    alt: "New here?",
    altBtn: "Create a free account",
    path: "/login",
  },
  signup: {
    title: (
      <>
        Start validating <span className="grad-text">for free</span>
      </>
    ),
    sub: "Create your founder workspace. No credit card required.",
    cta: "Create founder account",
    alt: "Already have an account?",
    altBtn: "Sign in",
    path: "/signup",
  },
} as const;

/** Product principles shown in the side panel (real commitments, not invented social proof). */
const PRINCIPLES = [
  {
    kicker: "Evidence first",
    title: "Every fact links to a source.",
    text: "Reports label each statement as FACT, ANALYSIS or ASSUMPTION. No source means “needs research”, never a guess.",
  },
  {
    kicker: "Real validation",
    title: "Validated means tested.",
    text: "An idea counts as validated only after you record real experiment results, never because an AI report sounds positive.",
  },
  {
    kicker: "Private by default",
    title: "Your ideas stay yours.",
    text: "Workspaces are isolated per account and never used to train shared models.",
  },
];

const FIREBASE_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Choose a stronger password (at least 8 characters).",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/network-request-failed": "Network error. Check your connection.",
};
const messageFor = (err: unknown) =>
  err instanceof FirebaseError
    ? (FIREBASE_MESSAGES[err.code] ?? "Sign-in failed. Please try again.")
    : err instanceof Error
      ? err.message
      : "Something went wrong. Please try again.";

const emailSchema = z.email();
const STRENGTH = [
  ["", ""],
  ["Weak", "#f77373"],
  ["Fair", "#f5a524"],
  ["Good", "#c762f6"],
  ["Strong", "#18b26b"],
] as const;

function strength(v: string): number {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return Math.max(s, 1);
}

export function AuthScreen({ initialMode, missingConfig, signupNotice }: { initialMode: Mode; missingConfig: string[]; signupNotice?: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [swapping, setSwapping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const configured = missingConfig.length === 0;
  const copy = COPY[mode];

  useEffect(() => {
    const id = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setSwapping(true);
    setTimeout(() => {
      setMode(next);
      setErrors({});
      setNotice(null);
      setSwapping(false);
      // Keep the URL in sync so refresh/back keeps the chosen mode.
      const qs = params.toString();
      window.history.replaceState(null, "", `${COPY[next].path}${qs ? `?${qs}` : ""}`);
    }, 220);
  }

  async function finish(credential: UserCredential) {
    const idToken = await credential.user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken, remember: mode === "signup" ? true : remember }),
    });
    // The server session cookie is the source of truth; drop the client-side Firebase session.
    await signOut(await getClientAuth());
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Could not start your session.");
    }
    router.replace(safeNextPath(params.get("next")));
    router.refresh();
  }

  function validate(): Errors {
    const e: Errors = {};
    if (mode === "signup" && !name.trim()) e.name = "Tell us what to call you.";
    if (!emailSchema.safeParse(email).success) e.email = "Enter a valid email address.";
    if (mode === "signup" && password.length < 8) e.password = "Use at least 8 characters.";
    if (mode === "signin" && !password) e.password = "Enter your password.";
    if (mode === "signup" && !terms) e.terms = "Please accept the Terms and Privacy Policy.";
    return e;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy("email");
    try {
      const auth = await getClientAuth();
      const credential =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      if (mode === "signup") {
        await updateProfile(credential.user, { displayName: name.trim() });
        await credential.user.getIdToken(true);
      }
      await finish(credential);
    } catch (err) {
      setNotice({ kind: "bad", text: messageFor(err) });
      setBusy(null);
    }
  }

  async function onGoogle() {
    setNotice(null);
    if (mode === "signup" && !terms) {
      setErrors({ terms: "Please accept the Terms and Privacy Policy." });
      return;
    }
    setBusy("google");
    try {
      await finish(await signInWithPopup(await getClientAuth(), new GoogleAuthProvider()));
    } catch (err) {
      setNotice({ kind: "bad", text: messageFor(err) });
      setBusy(null);
    }
  }

  async function onForgot() {
    if (!emailSchema.safeParse(email).success) {
      setErrors({ email: "Enter your email above first." });
      return;
    }
    try {
      await sendPasswordResetEmail(await getClientAuth(), email);
    } catch (err) {
      // Don't reveal whether the account exists; only surface rate limiting and network issues.
      if (err instanceof FirebaseError && ["auth/too-many-requests", "auth/network-request-failed"].includes(err.code)) {
        setNotice({ kind: "bad", text: messageFor(err) });
        return;
      }
    }
    setNotice({ kind: "ok", text: `If an account exists for ${email}, a password reset link is on its way.` });
  }

  const level = strength(password);
  const [levelLabel, levelColor] = STRENGTH[level];

  return (
    <div className={`auth-shell ${mode === "signup" ? "signup" : ""} ${loaded ? "loaded" : ""}`}>
      <div className="shell">
        {/* ================= LEFT: FORM ================= */}
        <div className="left">
          <div className="rails" />
          <div className="top rv">
            <Link href="/" className="brand" aria-label={`${BRAND.name} home`}>
              <Wordmark className="text-[24px]" />
            </Link>
            <Link href="/" className="back">
              <ArrowLeft className="ic" />
              Back to site
            </Link>
          </div>

          <div className="form-wrap">
            <div className="form-box">
              <span className="status rv" style={{ "--d": ".05s" } as React.CSSProperties}>
                <i />
                Free plan · no credit card required
              </span>
              <h1 className="rv" style={{ "--d": ".12s" } as React.CSSProperties}>
                <span className={`swap ${swapping ? "out" : ""}`}>{copy.title}</span>
              </h1>
              <p className="lead rv" style={{ "--d": ".18s" } as React.CSSProperties}>
                <span className={`swap ${swapping ? "out" : ""}`}>{copy.sub}</span>
              </p>

              <div className="toggle rv" style={{ "--d": ".24s" } as React.CSSProperties} role="tablist" aria-label="Sign in or create account">
                <span className="knob" />
                <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>
                  Sign in
                </button>
                <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>
                  Create account
                </button>
              </div>

              {!configured ? (
                <div className="notice warn rv" style={{ "--d": ".3s" } as React.CSSProperties} role="alert">
                  <strong>Sign-in is not configured yet.</strong> Add these variables to <code>.env</code> and restart the server:
                  <ul>
                    {missingConfig.map((m) => (
                      <li key={m}>• {m}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  {mode === "signup" && signupNotice ? (
                    <div className="notice warn" role="status">
                      <CircleAlert className="ic" />
                      <span>{signupNotice}</span>
                    </div>
                  ) : null}
                  <div className="rv" style={{ "--d": ".3s" } as React.CSSProperties}>
                    <button className="soc" type="button" onClick={onGoogle} disabled={!!busy}>
                      {busy === "google" ? <span className="spin" style={{ borderColor: "#d9cde3", borderTopColor: "#41175e" }} /> : <GoogleIcon />}
                      Continue with Google
                    </button>
                  </div>

                  <div className="divider rv" style={{ "--d": ".34s" } as React.CSSProperties}>
                    or continue with email
                  </div>

                  <form className="rv" style={{ "--d": ".38s" } as React.CSSProperties} onSubmit={onSubmit} noValidate>
                    <div className="only-up" aria-hidden={mode !== "signup"}>
                      <div>
                        <div className={`field ${errors.name ? "bad" : ""}`}>
                          <div className="field-h">
                            <label htmlFor="name">Full name</label>
                          </div>
                          <div className="inp">
                            <User className="ic" />
                            <input
                              id="name"
                              autoComplete="name"
                              placeholder="Ada Founder"
                              value={name}
                              tabIndex={mode === "signup" ? 0 : -1}
                              onChange={(e) => setName(e.target.value)}
                            />
                          </div>
                          {errors.name ? <div className="err">{errors.name}</div> : null}
                        </div>
                      </div>
                    </div>

                    <div className={`field ${errors.email ? "bad" : ""}`}>
                      <div className="field-h">
                        <label htmlFor="email">Work email</label>
                      </div>
                      <div className="inp">
                        <Mail className="ic" />
                        <input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      {errors.email ? <div className="err">{errors.email}</div> : null}
                    </div>

                    <div className={`field ${errors.password ? "bad" : ""}`}>
                      <div className="field-h">
                        <label htmlFor="password">Password</label>
                        {mode === "signin" ? (
                          <button type="button" className="link" onClick={onForgot}>
                            Forgot password?
                          </button>
                        ) : null}
                      </div>
                      <div className="inp">
                        <Lock className="ic" />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button type="button" className="eye" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide characters" : "Show characters"}>
                          {showPassword ? <EyeOff className="ic" /> : <Eye className="ic" />}
                        </button>
                      </div>
                      {errors.password ? <div className="err">{errors.password}</div> : null}
                      <div className="only-up" aria-hidden={mode !== "signup"}>
                        <div>
                          <div className="meter">
                            {[0, 1, 2, 3].map((i) => (
                              <i key={i} style={{ background: i < level ? levelColor : undefined }} />
                            ))}
                          </div>
                          <div className="meter-l">
                            <span>Use 8+ characters with a number &amp; symbol</span>
                            <b style={{ color: levelColor }}>{levelLabel}</b>
                          </div>
                        </div>
                      </div>
                    </div>

                    {mode === "signin" ? (
                      <label className="check">
                        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                        <span className="box">
                          <Check className="ic" strokeWidth={3} />
                        </span>
                        Keep me signed in for 5 days
                      </label>
                    ) : null}
                    <div className="only-up" aria-hidden={mode !== "signup"}>
                      <div>
                        <label className={`check ${errors.terms ? "bad" : ""}`}>
                          <input
                            type="checkbox"
                            checked={terms}
                            tabIndex={mode === "signup" ? 0 : -1}
                            onChange={(e) => {
                              setTerms(e.target.checked);
                              setErrors((er) => ({ ...er, terms: undefined }));
                            }}
                          />
                          <span className="box">
                            <Check className="ic" strokeWidth={3} />
                          </span>
                          <span>
                            I agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>. Your ideas never train shared models.
                          </span>
                        </label>
                        {errors.terms ? <div className="err" style={{ marginTop: -14, marginBottom: 16 }}>{errors.terms}</div> : null}
                      </div>
                    </div>

                    <button className="btn" type="submit" disabled={!!busy}>
                      <span className={`swap ${swapping ? "out" : ""}`}>{copy.cta}</span>
                      <span className="chip">
                        {busy === "email" ? (
                          <span className="spin" />
                        ) : (
                          <>
                            <ArrowRight className="ic" />
                            <ArrowRight className="ic" />
                          </>
                        )}
                      </span>
                    </button>

                    {notice ? (
                      <div className={`notice ${notice.kind}`} role={notice.kind === "bad" ? "alert" : "status"}>
                        {notice.kind === "ok" ? <Check className="ic" /> : <CircleAlert className="ic" />}
                        <span>{notice.text}</span>
                      </div>
                    ) : null}
                  </form>
                </>
              )}

              <p className="alt rv" style={{ "--d": ".44s" } as React.CSSProperties}>
                {copy.alt}{" "}
                <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                  {copy.altBtn}
                </button>
              </p>
            </div>
          </div>

          <div className="foot rv" style={{ "--d": ".5s" } as React.CSSProperties}>
            <span className="safe">
              <ShieldCheck className="ic" />
              httpOnly session cookie · your ideas never train shared models
            </span>
            <span>
              © {new Date().getFullYear()} {BRAND.name}
            </span>
          </div>
        </div>

        {/* ================= RIGHT: SHOWCASE ================= */}
        <ShowcasePanel />
      </div>
    </div>
  );
}

function ShowcasePanel() {
  const [index, setIndex] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % PRINCIPLES.length), 6000);
    return () => clearTimeout(t);
  }, [index]);

  function onMove(e: React.PointerEvent) {
    const scene = sceneRef.current;
    const tilt = tiltRef.current;
    if (!scene || !tilt || e.pointerType !== "mouse") return;
    const r = scene.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transform = `rotateX(${-y * 8}deg) rotateY(${x * 10}deg)`;
  }

  return (
    <aside className="right" aria-hidden="true">
      <div
        className="panel"
        onPointerMove={onMove}
        onPointerLeave={() => {
          if (tiltRef.current) tiltRef.current.style.transform = "";
        }}
      >
        <div className="bloom" />
        <div className="gridbg" />
        <div className="rv" style={{ "--d": ".2s" } as React.CSSProperties}>
          <span className="pill-d">
            <i />
            Find it. Prove it. Then build it.
          </span>
        </div>

        <div className="scene" ref={sceneRef}>
          <div className="tilt" ref={tiltRef}>
            <div className="plane">
              <div className="floor" />
              <div className="p3 float" style={{ left: 60, top: 60, "--z": "0px", "--fd": "0s" } as React.CSSProperties}>
                <div className="layer">ASSUMPTION</div>
              </div>
              <div className="p3 float" style={{ left: 60, top: 60, "--z": "46px", "--fd": "-.4s" } as React.CSSProperties}>
                <div className="layer l2">ANALYSIS</div>
              </div>
              <div className="p3 float" style={{ left: 60, top: 60, "--z": "92px", "--fd": "-.8s" } as React.CSSProperties}>
                <div className="layer l3">
                  <div className="in">
                    <LogoMark className="mx-auto mb-2.5 size-10" />
                    <b>FACT</b>
                    <small>linked to a stored source</small>
                  </div>
                </div>
              </div>
              <div className="p3 float" style={{ left: 290, top: 20, "--z": "150px", "--fd": "-2s" } as React.CSSProperties}>
                <span className="chip3">
                  <Link2 className="ic" />
                  Every claim cited
                </span>
              </div>
              <div className="p3 float" style={{ left: -150, top: 150, "--z": "70px", "--fd": "-3.4s" } as React.CSSProperties}>
                <span className="chip3">
                  <FlaskConical className="ic" />
                  Real experiments decide
                </span>
              </div>
              <div className="p3 float" style={{ left: 250, top: 330, "--z": "110px", "--fd": "-1.2s" } as React.CSSProperties}>
                <span className="chip3">
                  <Lock className="ic" />
                  Private by default
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rv" style={{ "--d": ".35s" } as React.CSSProperties}>
          <div className="quotes">
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className={`q ${i === index ? "on" : ""}`}>
                <div className="kicker">{p.kicker}</div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
          <div className="dots">
            {PRINCIPLES.map((p, i) => (
              <button key={`${p.title}-${i === index ? index : "x"}`} type="button" tabIndex={-1} className={i === index ? "on" : ""} onClick={() => setIndex(i)}>
                <i />
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
