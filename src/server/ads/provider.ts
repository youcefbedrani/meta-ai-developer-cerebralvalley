/*
 * Ad platform integration seam. This version has NO direct ad-platform API
 * integration: founders create ads in the platform's own tools and log the
 * numbers. Later, Meta/Google/LinkedIn providers can implement this interface
 * to push campaigns and pull stats into channel_results automatically.
 */

export type AdsProviderId = "manual" | "meta" | "google" | "linkedin";

export type AdCampaignDraft = {
  name: string;
  dailyBudget: number;
  currency: string;
  durationDays: number;
  audience: string;
  variants: { name: string; headline: string; primaryText: string; cta: string; url: string }[];
};

export type AdStats = { date: Date; variantName: string; spend: number; impressions: number; clicks: number };

export interface AdsProvider {
  id: AdsProviderId;
  label: string;
  /** False until the founder connects an ad account (OAuth, later). */
  isConnected(userId: string): Promise<boolean>;
  /** Creates the campaign in the platform, paused, for the founder to review there. */
  createCampaign(userId: string, draft: AdCampaignDraft): Promise<{ externalId: string }>;
  fetchStats(userId: string, externalId: string, since: Date): Promise<AdStats[]>;
}

class NotConnectedError extends Error {
  constructor(provider: string) {
    super(`${provider} isn't connected. Create the ads in the platform and log the results manually.`);
    this.name = "NotConnectedError";
  }
}

/** The only provider today: everything is created in the platform and results are entered by hand. */
export const manualAdsProvider: AdsProvider = {
  id: "manual",
  label: "Manual (log results yourself)",
  isConnected: async () => false,
  createCampaign: async () => {
    throw new NotConnectedError("Ad platform");
  },
  fetchStats: async () => [],
};

export function getAdsProvider(id: AdsProviderId = "manual"): AdsProvider {
  // Meta/Google/LinkedIn providers plug in here once their APIs are integrated.
  void id;
  return manualAdsProvider;
}
