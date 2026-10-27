/** Onboarding fades up like the rest of the app (globals.css .page-in). */
export default function OnboardingTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
