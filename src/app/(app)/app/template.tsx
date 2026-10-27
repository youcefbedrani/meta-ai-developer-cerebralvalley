/** Re-mounts on every navigation, so each page fades up and its sections rise in one after another (globals.css). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
