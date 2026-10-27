import { WelcomeModal } from "@/components/app/welcome-modal";
import { requireFounder } from "@/server/auth/current-user";

/**
 * Founder tools (dashboard, ideas, projects, research, marketing, settings…). Platform admin accounts
 * only use the admin console, statistics and controls, so requireFounder sends them there instead.
 * New founders get a one-time welcome popup on the first page they open.
 */
export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFounder();
  return (
    <>
      {children}
      {user.welcomeSeenAt ? null : <WelcomeModal name={user.name} />}
    </>
  );
}
