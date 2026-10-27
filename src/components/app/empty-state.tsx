import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="ambient-glow flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="animate-float grid size-12 place-items-center rounded-2xl border border-border bg-card text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-medium">{title}</h3>
      <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Honest placeholder for MVP modules that aren't built yet. */
export function ModuleNotReady({ icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <EmptyState
      icon={icon}
      title={`${title} isn't available yet`}
      description={
        <>
          <p>{description}</p>
          <p className="mt-2">This module is under construction. Nothing here is simulated.</p>
        </>
      }
    />
  );
}
