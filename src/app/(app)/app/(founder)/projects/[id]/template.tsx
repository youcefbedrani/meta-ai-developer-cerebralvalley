/** Switching project tabs re-mounts this, so the tab's content fades up (globals.css .page-in). */
export default function ProjectTabTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
