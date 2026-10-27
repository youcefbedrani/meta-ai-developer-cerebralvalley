import type { ModuleKey } from "@/lib/platform-settings";
import { BarChart3, BookOpen, Bot, CircleUser, Compass, CreditCard, FlaskConical, FolderKanban, History, LayoutDashboard, Lightbulb, Megaphone, Pickaxe, SearchCheck, Settings, SlidersHorizontal, Sparkles, Store, UserPlus, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** True while the module isn't built yet; rendered with a "Soon" badge. */
  soon?: boolean;
  /** Hidden while an admin has turned this module off. */
  module?: ModuleKey;
  /** Sidebar section. */
  group: NavGroup;
};

export const NAV_GROUPS = [
  { key: "start", label: null },
  { key: "discover", label: "1 · Discover" },
  { key: "validate", label: "2 · Validate" },
  { key: "build", label: "3 · Build & grow" },
  { key: "account", label: "Account" },
  { key: "stats", label: "Statistics" },
  { key: "control", label: "Control" },
] as const;
export type NavGroup = (typeof NAV_GROUPS)[number]["key"];

export type NavFeatures = { admin: boolean; modules: Record<ModuleKey, boolean> };

/** Admin accounts only use the admin console, so they get its sections instead of the founder tools. */
export function visibleNavItems(features: NavFeatures): NavItem[] {
  if (features.admin) return ADMIN_NAV_ITEMS;
  return NAV_ITEMS.filter((item) => !item.module || features.modules[item.module]);
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, group: "start" },
  { href: "/app/guide", label: "Start here", icon: Compass, group: "start" },
  { href: "/app/copilot", label: "AI Copilot", icon: Sparkles, module: "copilot", group: "start" },
  { href: "/app/ideas", label: "Discover Ideas", icon: Lightbulb, module: "ideas", group: "discover" },
  { href: "/app/gold-mine", label: "Gold Mine", icon: Pickaxe, module: "goldMine", group: "discover" },
  { href: "/app/marketplace", label: "Marketplace", icon: Store, module: "marketplace", group: "discover" },
  { href: "/app/projects", label: "My Projects", icon: FolderKanban, group: "validate" },
  { href: "/app/research", label: "Research & Validate", icon: SearchCheck, module: "research", group: "validate" },
  { href: "/app/lab", label: "Validation Lab", icon: FlaskConical, module: "lab", group: "validate" },
  { href: "/app/marketing", label: "Marketing Studio", icon: Megaphone, module: "marketing", group: "build" },
  { href: "/app/resources", label: "Resources", icon: BookOpen, module: "resources", group: "build" },
  { href: "/app/profile", label: "My profile", icon: CircleUser, group: "account" },
  { href: "/app/settings", label: "Settings", icon: Settings, group: "account" },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/app/admin", label: "Overview", icon: BarChart3, group: "stats" },
  { href: "/app/admin/signups", label: "Sign-ups", icon: UserPlus, group: "stats" },
  { href: "/app/admin/projects", label: "Projects", icon: FolderKanban, group: "stats" },
  { href: "/app/admin/jobs", label: "Jobs & AI", icon: Bot, group: "stats" },
  { href: "/app/admin/billing", label: "Billing & credits", icon: CreditCard, group: "stats" },
  { href: "/app/admin/users", label: "Users", icon: Users, group: "control" },
  { href: "/app/admin/marketplace", label: "Marketplace", icon: Store, group: "control" },
  { href: "/app/admin/settings", label: "Settings", icon: SlidersHorizontal, group: "control" },
  { href: "/app/admin/audit", label: "Audit log", icon: History, group: "control" },
];

/** Visible items by sidebar section; empty sections are left out. */
export function groupedNavItems(features: NavFeatures) {
  const items = visibleNavItems(features);
  return NAV_GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.group === g.key) })).filter((g) => g.items.length);
}

export function isActive(pathname: string, href: string): boolean {
  return href === "/app" || href === "/app/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
