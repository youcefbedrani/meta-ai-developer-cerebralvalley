import { ModuleGate } from "@/components/app/module-gate";

export default function ProjectMarketingLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="marketing">{children}</ModuleGate>;
}
