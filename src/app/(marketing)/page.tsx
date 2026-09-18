import type { Metadata } from "next";
import Link from "next/link";
import { PublicCatalogRealtime } from "@/components/website/PublicCatalogRealtime";
import { HomeFeaturedCatalog } from "@/components/website/HomeFeaturedCatalog";
import { VideoCard } from "@/components/website/VideoCard";
import { PartnerLogoMarquee } from "@/components/website/PartnerLogoMarquee";
import { listActivePartners } from "@/lib/website/partners";
import {
  getWebsiteSetting,
  listFeaturedPublicArtists,
  listFeaturedPublicReleases,
  listPublishedVideos,
} from "@/lib/website/queries";
import { resolveHomepageImageMap } from "@/lib/website/homepage-images";
import { HeroStage } from "@/components/public/HeroStage";
import { TextMarquee } from "@/components/public/TextMarquee";
import { DragCarousel } from "@/components/public/DragCarousel";
import { PlatformDestinations } from "@/components/public/PlatformDestinations";
import { PortalPreview } from "@/components/public/PortalPreview";
import { ServiceRows } from "@/components/public/ServiceRows";
import { StepCards } from "@/components/public/StepCards";
import { PlanTeasers } from "@/components/public/PlanTeasers";
import { DisplayHeading } from "@/components/public/DisplayHeading";
import { NumberedLabel } from "@/components/public/NumberedLabel";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Reveal } from "@/components/motion/Reveal";
import { SITE_URL } from "@/lib/site";
import { HOMEPAGE_IMAGE_PRESETS } from "@/lib/website/homepage-images";

export const metadata: Metadata = {
  title: {
    absolute: "NEXO Music Distribution | Digital Distribution & Publishing",
  },
  description:
    "Global music distribution and publishing for artists and labels. Reach 450+ platforms, manage royalties, and grow with Nexo Publishing Group.",
  alternates: { canonical: SITE_URL },
};

const HOME_FAQS = [
  {
    question: "What does NEXO Music Distribution do?",
    answer:
      "NEXO MUSIC DISTRIBUTION LTD provides digital music distribution, royalty management, and publishing support through Nexo Publishing Group for independent artists and labels.",
  },
  {
    question: "How many platforms can my music reach?",
    answer:
      "Nexo distributes to 450+ digital platforms and storefronts, including major streaming services and specialist stores. The exact destination set can evolve as the market changes.",
  },
  {
    question: "Do I keep ownership of my recordings?",
    answer:
      "Nexo is built for independent catalogs. Keep ownership of your masters — we describe capabilities accurately and do not invent exclusive rights claims.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Artist Starter is free. Artist Pro is $9.99/month or $99/year, Label Starter is $19.99/month or $199/year, and Label Pro is $49.99/month or $499/year (USD list prices). Paid plans include a 7-day trial. Tax is calculated by Paddle at checkout.",
  },
  {
    question: "What is Nexo Publishing Group?",
    answer:
      "Nexo Publishing Group is the publishing division of NEXO. It covers sync licensing pathways, mechanical royalties, performance administration support, creative services, publishing administration, and statements.",
  },
  {
    question: "Is the dashboard preview live data?",
    answer:
      "No. Product showcase figures are labeled demo/showcase values for illustration only — not live company results, artist earnings, or verified streams.",
  },
];

const SERVICES = [
  {
    index: "01",
    title: "Distribution & label management",
    body: "Deliver releases to 450+ platforms from artist or label accounts, with quality control before send.",
    href: "/distribution",
  },
  {
    index: "02",
    title: "Royalty management & statements",
    body: "Track earnings, review statements, and organize payouts with workflows built for growing catalogs.",
    href: "/services",
  },
  {
    index: "03",
    title: "Nexo Publishing Group",
    body: "Sync, mechanical, performance administration, creative services, and publishing statements.",
    href: "/publishing",
  },
  {
    index: "04",
    title: "Content ID protection",
    body: "Protect recordings across platforms with Content ID tooling designed to help you claim and monetize usage.",
    href: "/services",
  },
  {
    index: "05",
    title: "Analytics & catalog views",
    body: "Understand streams and performance trends so you can plan releases with better visibility.",
    href: "/distribution",
  },
  {
    index: "06",
    title: "Support for artists & labels",
    body: "Human guidance from first release through ongoing catalog care — no invented celebrity clients.",
    href: "/contact",
  },
];

export default async function HomePage() {
  const [partners, featuredReleases, featuredArtists, featuredVideos, homepageSetting] = await Promise.all([
    listActivePartners(),
    listFeaturedPublicReleases(8),
    listFeaturedPublicArtists(8),
    listPublishedVideos({ limit: 6 }),
    getWebsiteSetting("homepage"),
  ]);
  const home = (homepageSetting?.value ?? {}) as Record<string, unknown>;
  const heroEyebrow = String(
    home.hero_eyebrow || "One upload. 450+ platforms. Independent artists and labels."
  );
  const heroTitle = String(home.hero_title || "Your music.");
  const heroAccent = String(home.hero_title_accent || "Everywhere.");
  const heroBody = String(
    home.hero_body ||
      "The distribution backbone for independent artists and labels — plus publishing through Nexo Publishing Group."
  );
  const heroCtaLabel = String(home.hero_cta_label || "Get started →");
  const heroCtaHref = String(home.hero_cta_href || "/get-started");
  const showFeaturedReleases = home.show_featured_releases !== false;
  const showFeaturedArtists = home.show_featured_artists !== false;
  const showPartners = home.show_partners !== false;
  const images = resolveHomepageImageMap(home);

  const dragCards = [
    {
      src: images.artists_image_url || HOMEPAGE_IMAGE_PRESETS.live,
      index: "01",
      kicker: "Own your music",
      title: "Keep your masters",
      body: "Independent by design.",
      alt: "Live performance for independent artists",
    },
    {
      src: images.distribution_image_url || HOMEPAGE_IMAGE_PRESETS.producer,
      index: "02",
      kicker: "Release your music",
      title: "Global delivery",
      body: "450+ platforms.",
      alt: "Studio production for global distribution",
    },
    {
      src: images.publishing_image_url || HOMEPAGE_IMAGE_PRESETS.headphones,
      index: "03",
      kicker: "Build your catalog",
      title: "Publishing group",
      body: "Rights alongside distribution.",
      alt: "Creative listening and publishing focus",
    },
    {
      src: images.royalties_image_url || HOMEPAGE_IMAGE_PRESETS.producer,
      index: "04",
      kicker: "Track your music",
      title: "Streams & earnings",
      body: "Dashboard access after sign-in.",
      alt: "Royalty workspace",
    },
  ];

  return (
    <div className="overflow-x-hidden">
      <PublicCatalogRealtime />
      <HeroStage
        eyebrow={heroEyebrow}
        title={heroTitle}
        accent={heroAccent}
        body={heroBody}
        ctaLabel={heroCtaLabel}
        ctaHref={heroCtaHref}
        heroImage={images.hero_image_url}
      />
      <TextMarquee />

      <section className="pub-section pub-container">
        <Reveal className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <div>
            <NumberedLabel index="01">Why Nexo</NumberedLabel>
            <p className="pub-body mt-6 max-w-xs">
              Independent artists and labels use Nexo to deliver catalogs worldwide, keep royalty
              workflows clear, and access publishing through Nexo Publishing Group.
            </p>
          </div>
          <DisplayHeading>
            Own your{" "}
            <span className="pub-accent">music.</span>
            <br />
            Reach the
            <br />
            world.
          </DisplayHeading>
        </Reveal>
      </section>

      <section className="pb-[var(--pub-section)] pub-container">
        <div className="mb-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <DisplayHeading size="lg">
            Your music.
            <br />
            Your rights.
          </DisplayHeading>
          <p className="pub-body max-w-sm lg:justify-self-end">
            Release worldwide, keep ownership of your masters, and use Nexo tools to distribute,
            track, and grow your catalog.
          </p>
        </div>
        <DragCarousel cards={dragCards} />
      </section>

      <PlatformDestinations />
      <PortalPreview />

      <section className="pub-section pub-container">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <DisplayHeading>
            Everything
            <br />
            you
            <br />
            need and
            <br />
            more.
          </DisplayHeading>
          <p className="pub-body max-w-sm lg:justify-self-end">
            Distribution, royalties, analytics, protection, support, and publishing — connected
            under one professional system.
          </p>
        </div>
        <ServiceRows items={SERVICES} />
      </section>

      <StepCards />
      <PlanTeasers />

      {showPartners ? <PartnerLogoMarquee partners={partners} /> : null}
      <HomeFeaturedCatalog
        releases={featuredReleases}
        artists={featuredArtists}
        showReleases={showFeaturedReleases}
        showArtists={showFeaturedArtists}
      />

      {featuredVideos.length > 0 ? (
        <section className="pub-section pub-container" id="featured-videos">
          <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <NumberedLabel index="07">Nexo video showcase</NumberedLabel>
              <DisplayHeading size="md" className="mt-4">
                Featured videos.
              </DisplayHeading>
              <p className="pub-body mt-3 max-w-xl">
                Videos selected by Nexo administrators and presented inside the Nexo website experience.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredVideos.map((video) => (
              <VideoCard
                key={video.id}
                title={video.title}
                url={video.url}
                thumbnailUrl={video.thumbnail_url}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="pub-section pub-container">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <p className="pub-kicker">Frequently asked questions</p>
            <DisplayHeading className="mt-4">
              Questions?
              <br />
              Answered.
            </DisplayHeading>
            <p className="pub-body mt-6 max-w-sm">
              Current answers about plans, platforms, uploads, ownership, and publishing.
            </p>
          </div>
          <FaqAccordion items={HOME_FAQS} />
        </div>
      </section>

      <FinalCta
        title="Ready to be heard?"
        description="Start with Artist Starter at no cost, or talk with Nexo about label operations and publishing. We do not invent commissions, delivery clocks, or testimonials."
        imageSrc={images.cta_image_url}
        aboutImageSrc={images.about_image_url}
      />
      <p className="sr-only">
        <Link href="/faq">Full FAQ</Link>
      </p>
    </div>
  );
}
