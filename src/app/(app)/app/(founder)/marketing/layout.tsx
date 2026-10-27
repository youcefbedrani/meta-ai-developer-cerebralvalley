import { ModuleGate } from "@/components/app/module-gate";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="marketing">{children}</ModuleGate>;
}
