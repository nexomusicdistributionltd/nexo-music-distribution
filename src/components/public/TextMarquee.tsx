const ITEMS = [
  "Digital distribution",
  "Nexo Publishing Group",
  "Royalty management",
  "Content ID protection",
  "Quality control",
  "Catalog analytics",
  "Artist & label accounts",
];

export function TextMarquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <section className="pub-marquee" aria-label="Nexo capabilities">
      <div className="pub-marquee-track" aria-hidden>
        {row.map((item, i) => (
          <span key={`${item}-${i}`} className="pub-marquee-item">
            {i > 0 ? " ✦ " : ""}
            {item}
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
