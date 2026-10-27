import { ModuleGate } from "@/components/app/module-gate";

export default function GoldMineLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="goldMine">{children}</ModuleGate>;
}
