import { VideoCard } from "@/components/website/VideoCard";
import { Reveal } from "@/components/motion/Reveal";
import { DisplayHeading } from "@/components/public/DisplayHeading";

type Video = {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string | null;
};

export function HomeVideos({ videos }: { videos: Video[] }) {
  if (!videos.length) return null;

  return (
    <section className="pub-section pub-container" id="nexo-videos">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="pub-kicker">Nexo Music Videos</p>
          <DisplayHeading as="h2" size="md" className="mt-3">
            Watch on Nexo
          </DisplayHeading>
        </div>
        <p className="pub-body max-w-sm">
          Videos published by the Nexo team appear here automatically when enabled in Website → Videos.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video, index) => (
          <Reveal key={video.id} delayMs={(index % 3) * 50}>
            <VideoCard
              title={video.title}
              url={video.url}
              thumbnailUrl={video.thumbnail_url}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
