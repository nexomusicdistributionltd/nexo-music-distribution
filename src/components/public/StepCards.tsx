import { DisplayHeading } from "@/components/public/DisplayHeading";

const STEPS = [
  {
    index: "01 / Upload",
    title: "Upload your music.",
    body: "Submit audio, artwork, and metadata for singles, EPs, or albums. Nexo reviews technical and rights readiness before delivery.",
    accent: false,
  },
  {
    index: "02 / Distribute",
    title: "We release worldwide.",
    body: "Releases are delivered to your selected platforms and territories. Storefront approval remains subject to each destination’s policies.",
    accent: true,
  },
  {
    index: "03 / Collect",
    title: "Track and get paid.",
    body: "Follow catalog activity as reporting arrives, then review statements and payout workflows in one place.",
    accent: false,
  },
];

export function StepCards() {
  return (
    <section className="pub-section pub-container">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <DisplayHeading>
          Upload.
          <br />
          Distribute.
          <br />
          Get paid.
        </DisplayHeading>
        <p className="pub-body max-w-sm lg:justify-self-end">
          A clear path from first assets to royalty workflows — built for independent artists
          and labels, without invented delivery promises.
        </p>
      </div>
      <div className="mt-12 grid gap-3 md:grid-cols-3">
        {STEPS.map((step) => (
          <article key={step.index} className={step.accent ? "pub-step pub-step--accent" : "pub-step"}>
            <p className="pub-kicker">{step.index}</p>
            <div>
              <h3 className="pub-step-title mt-10">{step.title}</h3>
              <p className="pub-body mt-4">{step.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
