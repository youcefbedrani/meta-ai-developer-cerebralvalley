import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="ambient-glow flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-sm text-muted-foreground">Or you don&apos;t have access to it.</p>
      <Link href="/app" className={cn(buttonVariants({ variant: "gradient" }), "mt-6 h-10 px-5")}>
        Back to dashboard
      </Link>
    </div>
  );
}
