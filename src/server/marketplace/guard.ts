import "server-only";
import { notFound } from "next/navigation";
import { isMarketplaceEnabled } from "./config";

/** 404s every marketplace page while the feature flag is off. */
export function requireMarketplace(): void {
  if (!isMarketplaceEnabled()) notFound();
}
