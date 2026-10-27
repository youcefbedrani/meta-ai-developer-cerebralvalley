import type { Metadata } from "next";
import { AuthPage } from "../auth-page";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return <AuthPage mode="signin" searchParams={searchParams as Promise<{ next?: string }>} />;
}
