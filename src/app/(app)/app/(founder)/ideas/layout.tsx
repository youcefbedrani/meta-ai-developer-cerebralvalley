import { ModuleGate } from "@/components/app/module-gate";

export default function IdeasLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="ideas">{children}</ModuleGate>;
}
