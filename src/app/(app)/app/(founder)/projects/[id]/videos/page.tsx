import { notFound } from "next/navigation";
import { LaunchVideos } from "@/components/videos/launch-videos";
import { CREDIT_COSTS } from "@/lib/plans";
import { captionFor, SOCIAL_PROVIDERS } from "@/lib/validation/launch-video";
import { requireFounder } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { listLaunchVideos, projectLink, storyboardOf } from "@/server/services/launch-video";
import { enabledConnectors, listConnections, listSocialPosts } from "@/server/services/social";

/** Launch videos for organic social: Muse Spark storyboard + Muse Image scenes → MP4, then post or share. */
export default async function VideosPage({ params }: PageProps<"/app/projects/[id]/videos">) {
  const user = await requireFounder();
  const { id } = await params;
  if (!(await getProject(user.id, id))) notFound();
  const [videos, connections, posts, balance, link] = await Promise.all([listLaunchVideos(user.id, id), listConnections(user.id), listSocialPosts(user.id, id), getBalance(user.id), projectLink(id)]);
  return (
    <LaunchVideos
      projectId={id}
      cost={CREDIT_COSTS.launch_video}
      balance={balance}
      hasLink={!!link}
      connectors={enabledConnectors()}
      connections={connections.map((c) => ({ id: c.id, provider: c.provider, accountName: c.accountName }))}
      posts={posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      videos={videos.map(({ video: v, stage }) => {
        const sb = storyboardOf(v);
        return {
          id: v.id,
          status: v.status,
          stage,
          angle: v.angle,
          error: v.error,
          durationSec: v.durationSec,
          createdAt: v.createdAt.toISOString(),
          title: sb?.title ?? null,
          scenes: sb?.scenes.map((s) => s.caption) ?? [],
          captions: sb ? Object.fromEntries(SOCIAL_PROVIDERS.map((p) => [p, captionFor(sb, p, link)])) : null,
        };
      })}
    />
  );
}
