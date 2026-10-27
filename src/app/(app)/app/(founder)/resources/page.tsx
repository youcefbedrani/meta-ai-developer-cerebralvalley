import { ArrowRight, BookOpen, Compass, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { MVP_PLAYBOOK } from "@/lib/resources/mvp-playbook";

export const metadata: Metadata = { title: "Resources" };

const RESOURCES = [
  { href: `/app/resources/${MVP_PLAYBOOK.slug}`, icon: Rocket, title: MVP_PLAYBOOK.title, body: MVP_PLAYBOOK.subtitle, meta: `${MVP_PLAYBOOK.readMinutes} min read · ${MVP_PLAYBOOK.strategies.length} strategies` },
  { href: "/app/guide", icon: Compass, title: "Start here: the founder journey", body: "The 9 steps from first idea to first customers, with your progress.", meta: "Interactive guide" },
];

export default function ResourcesPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Resources" description="Practical guides for building a SaaS: how to test ideas fast, launch, and get customers. Stuck? Use the Help button in the corner." />
      <div className="grid gap-4 md:grid-cols-2">
        {RESOURCES.map((r) => (
          <Link key={r.href} href={r.href} className="surface group flex flex-col p-6 transition-transform hover:-translate-y-0.5">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white"><r.icon className="size-5" /></span>
            <p className="mt-4 font-medium">{r.title}</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.body}</p>
            <p className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BookOpen className="size-3.5" /> {r.meta}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
