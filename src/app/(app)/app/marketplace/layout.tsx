import { ModuleGate } from "@/components/app/module-gate";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="marketplace">{children}</ModuleGate>;
}
