import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Globe2,
  Headphones,
  Lock,
  PenLine,
  Scale,
  ShieldCheck,
  Sparkles,
  FileAudio,
  Image as ImageIcon,
  ListChecks,
  Music2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Badge } from "@/components/ui/Badge";
import { DspMarquee } from "@/components/marketing/DspMarquee";
import { PartnerLogoMarquee } from "@/components/website/PartnerLogoMarquee";
import { HomeFeaturedCatalog } from "@/components/website/HomeFeaturedCatalog";
import { PublicCatalogRealtime } from "@/components/website/PublicCatalogRealtime";
import { HeroImage } from "@/components/website/HeroImage";
import { EditorialImage } from "@/components/website/EditorialImage";
import { listActivePartners } from "@/lib/website/partners";
import {
  getWebsiteSetting,
  listFeaturedPublicArtists,
  listFeaturedPublicReleases,
} from "@/lib/website/queries";
import { resolveHomepageImageMap } from "@/lib/website/homepage-images";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { DashboardMock } from "@/components/marketing/home/DashboardMock";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { CONFIRMED_STATS, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "NEXO Music Distribution | Digital Distribution & Publishing",
  },
  description:
    "Global music distribution and publishing for artists and labels. Reach 450+ platforms, manage royalties, and grow with Nexo Publishing Group.",
  alternates: { canonical: SITE_URL },
};

const FEATURES = [
  {
    icon: <Globe2 className="h-5 w-5" />,
    title: "Global Reach",
    description:
      "Deliver releases to 450+ digital platforms and storefronts worldwide — from major DSPs to specialist stores.",
  },
  {
    icon: <Scale className="h-5 w-5" />,
    title: "Royalty Management",
    description:
      "Track earnings, review statements, and organize payouts with clear royalty workflows built for growing catalogs.",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Powerful Analytics",
    description:
      "Understand streams and performance trends so you can plan releases and campaigns with better visibility.",
  },
  {
    icon: <Lock className="h-5 w-5" />,
    title: "Content ID Protection",
    description:
      "Protect your recordings across platforms with Content ID tooling designed to help you claim and monetize usage.",
  },
  {
    icon: <Headphones className="h-5 w-5" />,
    title: "Full Support",
    description:
      "Work with a team that understands independent artists and labels — from first release through ongoing catalog care.",
  },
  {
    icon: <PenLine className="h-5 w-5" />,
    title: "Nexo Publishing Group",
    description:
      "Sync, mechanical, performance administration, creative services, and clear publishing statements — alongside distribution.",
    badge: "New",
  },
];

const CHECKLIST = [
  "Easy release submission",
  "Quality control review",
  "Artist and label accounts",
  "Catalog and analytics views",
  "Royalty statements and payouts",
  "Publishing and sync pathways",
];

const WORKFLOW = [
  {
    step: "01",
    title: "Create your account",
    description: "Set up an artist or label profile and prepare your catalog details.",
  },
  {
    step: "02",
    title: "Upload assets",
    description: "Add audio, artwork, and metadata for singles, EPs, or albums.",
  },
  {
    step: "03",
    title: "Quality control",
    description: "Nexo reviews technical and metadata requirements before delivery.",
  },
  {
    step: "04",
    title: "Distribute",
    description: "Releases are delivered to your selected platforms and territories.",
  },
  {
    step: "05",
    title: "Track performance",
    description: "Monitor streams and catalog activity in one place as data arrives.",
  },
  {
    step: "06",
    title: "Collect royalties",
    description: "Review statements and manage payouts through royalty workflows.",
  },
];

const QC_ITEMS = [
  {
    icon: <FileAudio className="h-5 w-5" />,
    title: "Audio",
    description: "Technical checks for format, loudness, and delivery-ready masters.",
  },
  {
    icon: <ImageIcon className="h-5 w-5" />,
    title: "Artwork",
    description: "Cover art dimensions, clarity, and storefront presentation standards.",
  },
  {
    icon: <ListChecks className="h-5 w-5" />,
    title: "Metadata",
    description: "Titles, contributors, ISRC/UPC readiness, and language consistency.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Rights & compliance",
    description: "Release ownership, clearances, and store policy alignment before send.",
  },
];

const PUBLISHING_PILLARS = [
  {
    id: "sync",
    title: "Sync licensing",
    description: "Pitch and place compositions for film, TV, ads, games, and digital media opportunities.",
  },
  {
    id: "mechanical",
    title: "Mechanical royalties",
    description: "Administer mechanical rights for reproductions across digital and physical formats.",
  },
  {
    id: "performance",
    title: "Performance royalties",
    description: "Support performance royalty collection pathways for public and broadcast uses.",
  },
  {
    id: "admin",
    title: "Publishing administration",
    description: "Organize works registration, splits, and rights data so catalogs stay accurate.",
  },
  {
    id: "creative",
    title: "Creative services",
    description: "Creative support for writers and catalogs seeking placement and development opportunities.",
  },
  {
    id: "statements",
    title: "Statements",
    description: "Clear publishing statements so you can see how works are performing over time.",
  },
];

export default async function HomePage() {
  const [partners, featuredReleases, featuredArtists, homepageSetting] = await Promise.all([
    listActivePartners(),
    listFeaturedPublicReleases(8),
    listFeaturedPublicArtists(8),
    getWebsiteSetting("homepage"),
  ]);
  const home = (homepageSetting?.value ?? {}) as Record<string, unknown>;
  const heroEyebrow = String(home.hero_eyebrow || "Global Music Distribution & Publishing");
  const heroTitle = String(home.hero_title || "Your Music.");
  const heroAccent = String(home.hero_title_accent || "Everywhere.");
  const heroBody = String(
    home.hero_body ||
      "NEXO Music Distribution helps independent artists and labels deliver releases to 450+ platforms, manage royalties with clarity, and unlock publishing opportunities through Nexo Publishing Group — infrastructure built for the modern music business."
  );
  const heroCtaLabel = String(home.hero_cta_label || "Get Started");
  const heroCtaHref = String(home.hero_cta_href || "/get-started");
  const showFeaturedReleases = home.show_featured_releases !== false;
  const showFeaturedArtists = home.show_featured_artists !== false;
  const showPartners = home.show_partners !== false;
  const images = resolveHomepageImageMap(home);

  return (
    <div className="animate-fade-in overflow-x-hidden">
      <PublicCatalogRealtime />
      {/* 1. Hero */}
      <section className="relative overflow-hidden border-b border-[var(--nexo-border)]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 75% -20%, color-mix(in srgb, var(--nexo-text) 10%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 80%, color-mix(in srgb, var(--nexo-text) 5%, transparent), transparent 50%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-[0.07] dark:opacity-[0.12] lg:block"
          aria-hidden
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent, transparent 18px, var(--nexo-text) 18px, var(--nexo-text) 19px)",
            maskImage: "linear-gradient(90deg, transparent, black 35%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:gap-12 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:py-28">
          <Reveal variant="fade-up">
            <Eyebrow>{heroEyebrow}</Eyebrow>
            <h1 className="mt-5 text-display text-[var(--nexo-text)]">
              {heroTitle}
              <br />
              <span className="text-[var(--nexo-text-secondary)]">{heroAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-body text-[var(--nexo-text-muted)]">{heroBody}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={heroCtaHref}>
                <Button size="lg" className="gap-2 rounded-full px-6">
                  {heroCtaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/#platform">
                <Button size="lg" variant="outline" className="rounded-full px-6">
                  Learn More
                </Button>
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-2">
              {["450+ Platforms", "Artists & Labels", "Nexo Publishing Group"].map((label) => (
                <li key={label}>
                  <Badge>{label}</Badge>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal variant="fade-left" delayMs={120} className="relative">
            <div className="absolute -inset-4 rounded-[2rem] border border-[var(--nexo-border)] opacity-60 hidden sm:block" aria-hidden />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-3 shadow-[var(--nexo-shadow-lg)] sm:p-4">
              <HeroImage
                src={images.hero_image_url}
                preset="singer"
                alt="Vocalist performing at a microphone"
                priority
                aspectClassName="aspect-[16/10]"
              />
              <div className="mt-4 flex items-center justify-between px-1">
                <Music2 className="h-5 w-5 text-[var(--nexo-text)]" aria-hidden />
                <span className="text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
                  Editorial
                </span>
              </div>
              <p
                className="mt-4 px-1 font-serif text-2xl italic leading-snug text-[var(--nexo-text-secondary)] sm:text-3xl"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Independent artists.
                <br />
                Global reach.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[var(--nexo-divider)] px-1 pt-5">
                {CONFIRMED_STATS.slice(0, 3).map((s) => (
                  <div key={s.label}>
                    <p className="text-h4 text-[var(--nexo-text)]">{s.value}</p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 px-1 text-caption text-[var(--nexo-text-muted)]">
                Confirmed company figures · not invented metrics
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2. Trust / value indicators */}
      <section className="border-b border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        <Stagger className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8" stepMs={80} variant="fade-up">
          {[
            { title: "Distribution", body: "Release delivery across major and specialist platforms." },
            { title: "Publishing", body: "Nexo Publishing Group for rights and creative pathways." },
            { title: "Royalties", body: "Statements and payout workflows you can follow." },
            { title: "Support", body: "Human guidance for artists and labels at every stage." },
          ].map((item) => (
            <div key={item.title} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
              <p className="text-label text-[var(--nexo-text)]">{item.title}</p>
              <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{item.body}</p>
            </div>
          ))}
        </Stagger>
      </section>

      {/* 3. DSP marquee */}
      <DspMarquee />
      {showPartners ? <PartnerLogoMarquee partners={partners} /> : null}
      <HomeFeaturedCatalog
        releases={featuredReleases}
        artists={featuredArtists}
        showReleases={showFeaturedReleases}
        showArtists={showFeaturedArtists}
      />

      {/* 4. Six feature cards */}
      <Section id="features">
        <Reveal variant="fade-up" className="max-w-2xl">
          <Eyebrow>Platform</Eyebrow>
          <h2 className="mt-3 text-h2 text-[var(--nexo-text)]">Built for modern catalogs</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
            Distribution, royalties, analytics, protection, support, and publishing —
            connected under one professional system.
          </p>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stepMs={60} variant="scale-in">
          {FEATURES.map((f) => (
            <FeatureCard
              key={f.title}
              icon={f.icon}
              title={f.title}
              description={f.description}
              badge={f.badge}
            />
          ))}
        </Stagger>
      </Section>

      {/* 5. Product showcase */}
      <Section id="platform" surface>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>Built for creators</Eyebrow>
            <h2 className="mt-3 text-h2 text-[var(--nexo-text)]">
              Everything you need in one platform
            </h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Submit releases, pass quality control, follow catalog performance, and keep
              royalty and publishing activity organized — without juggling disconnected tools.
            </p>
            <ul className="mt-6 space-y-3">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-3 text-small text-[var(--nexo-text-secondary)]">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--nexo-border-strong)] bg-[var(--nexo-elevated)]">
                    <Check className="h-3 w-3 text-[var(--nexo-text)]" aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/get-started" className="mt-8 inline-flex">
              <Button className="gap-2 rounded-full px-5">
                Create Your Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">
              Account creation launches after onboarding is connected. Interest starts on Get Started.
            </p>
          </div>
          <DashboardMock />
        </div>
      </Section>

      {/* 6. For Artists */}
      <Section id="artists">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <Reveal variant="fade-right">
            <Eyebrow>For Artists</Eyebrow>
            <h2 className="mt-3 text-h2">Release with confidence</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Whether you are shipping your first single or expanding an independent catalog,
              Nexo gives you professional delivery, clear royalty visibility, and access to
              publishing support when you are ready.
            </p>
            <ul className="mt-6 space-y-2 text-small text-[var(--nexo-text-secondary)]">
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> Direct-to-platform distribution</li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> Artist-friendly release workflows</li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> Optional publishing pathways</li>
            </ul>
            <Link href="/artists" className="mt-8 inline-flex">
              <Button variant="outline" className="rounded-full">Explore For Artists</Button>
            </Link>
          </Reveal>
          <div>
            <EditorialImage
              src={images.artists_image_url}
              fallbackPreset="live"
              alt="Live performance energy for independent artists"
              motion="mask-up"
              aspectClassName="aspect-[4/3]"
            />
            <p className="mt-4 text-small text-[var(--nexo-text-muted)]">
              Independent by design — keep ownership of your masters with infrastructure
              that feels like a finished music company.
            </p>
          </div>
        </div>
      </Section>

      {/* 7. For Labels */}
      <Section id="labels" surface>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <EditorialImage
              src={images.labels_image_url || images.distribution_image_url}
              fallbackPreset="studioSession"
              alt="Studio session for label roster operations"
              motion="mask-left"
              aspectClassName="aspect-[4/3]"
            />
            <p className="mt-4 text-small text-[var(--nexo-text-muted)]">
              Built for roster operations — multi-artist releases, shared QC, and reporting
              that holds up across a catalog.
            </p>
          </div>
          <div className="order-1 lg:order-2">
            <Eyebrow>For Labels</Eyebrow>
            <h2 className="mt-3 text-h2">Scale your catalog cleanly</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Labels need repeatable delivery, consistent metadata quality, and reporting that
              holds up across a roster. Nexo is structured for that operational reality.
            </p>
            <Link href="/labels" className="mt-8 inline-flex">
              <Button variant="outline" className="rounded-full">Explore For Labels</Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* 8. Nexo Publishing Group */}
      <Section id="publishing">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="max-w-2xl">
            <Eyebrow>Nexo Publishing Group</Eyebrow>
            <h2 className="mt-3 text-h2">Your music. Our publishing power.</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Publishing sits alongside distribution — sync, mechanical, performance
              administration, creative services, and statements. We describe capabilities
              accurately and do not invent PRO or DSP partnership claims.
            </p>
          </div>
          <EditorialImage
            src={images.publishing_image_url}
            fallbackPreset="headphones"
            alt="Creative listening and publishing focus"
            motion="clip-diagonal"
            aspectClassName="aspect-[16/10]"
          />
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLISHING_PILLARS.map((p) => (
            <article
              key={p.id}
              id={p.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
            >
              <h3 className="text-h4">{p.title}</h3>
              <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{p.description}</p>
            </article>
          ))}
        </div>
        <Link href="/publishing" className="mt-8 inline-flex">
          <Button className="rounded-full">Explore Publishing</Button>
        </Link>
      </Section>

      {/* 9. Distribution workflow */}
      <Section id="workflow" surface>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow>Workflow</Eyebrow>
            <h2 className="mt-3 text-h2">From upload to payout</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              A clear six-step path for getting music into the world and keeping royalties organized.
            </p>
          </div>
          <Workflow className="hidden h-8 w-8 text-[var(--nexo-text-muted)] sm:block" aria-hidden />
        </div>
        <Stagger className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-6" stepMs={55} variant="fade-up">
          {WORKFLOW.map((item) => (
            <article
              key={item.step}
              className="relative rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
            >
              <p className="text-caption font-semibold tracking-[0.14em] text-[var(--nexo-text-muted)]">
                {item.step}
              </p>
              <h3 className="mt-3 text-h4">{item.title}</h3>
              <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{item.description}</p>
            </article>
          ))}
        </Stagger>
      </Section>

      {/* 10. QC */}
      <Section id="qc">
        <div className="max-w-2xl">
          <Eyebrow>Quality control</Eyebrow>
          <h2 className="mt-3 text-h2">Release-ready standards</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
            Every release is reviewed for audio, artwork, metadata, and rights readiness.
            QC improves delivery quality — it does not guarantee storefront approval, which
            remains subject to each platform&apos;s policies.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QC_ITEMS.map((item) => (
            <FeatureCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </Section>

      {/* 11. Royalty conceptual UI */}
      <Section id="royalties" surface>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Royalties</Eyebrow>
            <h2 className="mt-3 text-h2">Clarity over guesswork</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Review estimated earnings, available balance, and statement history in a
              conceptual royalty workspace. Figures shown here are demo UI only — not live
              company results.
            </p>
            <Link href="/services" className="mt-8 inline-flex">
              <Button variant="outline" className="rounded-full">View Services</Button>
            </Link>
          </div>
          <div className="space-y-4">
            <EditorialImage
              src={images.royalties_image_url}
              fallbackPreset="producer"
              alt="Producer console and royalty workspace"
              motion="fade-parallax"
              aspectClassName="aspect-[16/10]"
            />
            <div className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 shadow-[var(--nexo-shadow)]">
              <div className="flex items-center justify-between">
                <p className="text-label">Royalty overview · Demo</p>
                <Badge>Showcase</Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: "Estimated Earnings", value: "$2,480" },
                  { label: "Available Balance", value: "$1,250" },
                  { label: "Pending", value: "$430" },
                  { label: "Last Statement", value: "Feb 2026" },
                ].map((row) => (
                  <div key={row.label} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-4">
                    <p className="text-caption text-[var(--nexo-text-muted)]">{row.label}</p>
                    <p className="mt-1 text-h4">{row.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-caption text-[var(--nexo-text-muted)]">
                Demo values for product illustration — not real balances.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 12. Global reach */}
      <Section id="reach">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <Eyebrow>Global reach</Eyebrow>
            <h2 className="mt-3 text-h2">Everywhere your audience listens</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              From flagship streaming services to social platforms and specialist stores,
              Nexo routes your releases through a broad digital footprint — so your music can
              meet listeners where they already are.
            </p>
          </div>
          <div>
            <EditorialImage
              src={images.distribution_image_url}
              fallbackPreset="producer"
              alt="Studio production for global distribution"
              motion="mask-up"
              aspectClassName="aspect-[4/3]"
            />
            <div className="mt-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-5">
              <p className="text-h3">450+ platforms</p>
              <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
                Streaming, download, social, and specialty destinations — continuously expanding
                as the market evolves.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 13. Confirmed stats */}
      <Section surface>
        <div className="max-w-2xl">
          <Eyebrow>By the numbers</Eyebrow>
          <h2 className="mt-3 text-h2">Confirmed company figures</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
            Only verified figures are shown. No invented stream counts, revenue, or testimonials.
          </p>
        </div>
        <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stepMs={70} variant="mask">
          {CONFIRMED_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6"
            >
              <dt className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
                {stat.label}
              </dt>
              <dd className="mt-3 text-display text-[var(--nexo-text)]" style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)" }}>
                {stat.value}
              </dd>
            </div>
          ))}
        </Stagger>
      </Section>

      {/* 14. Final CTA */}
      <FinalCta imageSrc={images.cta_image_url} aboutImageSrc={images.about_image_url} />
    </div>
  );
}
