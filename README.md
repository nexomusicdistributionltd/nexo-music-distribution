# NEXO Music Distribution

Public marketing website for **NEXO MUSIC DISTRIBUTION LTD**  
https://nexomusicdistribution.com

Digital Music Distribution | Publishing | Royalty Management  
Publishing division: **Nexo Publishing Group**

---

## How to run

```bash
cd /workspace/nexo-music-distribution
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

---

## Batch 2 notes (public website)

Batch 2 extends the Batch 1 foundation (theme tokens, logos, UI kit, architecture stubs, RBAC, provider interface). It does **not** rebuild or delete that foundation.

### Public routes

| Route | Notes |
|-------|--------|
| `/` | Full marketing homepage (hero → footer) |
| `/distribution` | Distribution overview |
| `/publishing` | Nexo Publishing Group |
| `/artists` | For Artists (canonical) |
| `/labels` | For Labels (canonical) |
| `/pricing` | Architecture complete — **no invented prices** |
| `/services` | Services overview |
| `/about` | Mission only — no invented founders/offices/awards |
| `/contact` | Real form UI — submit disabled until backend configured |
| `/faq` | Accurate FAQ answers |
| `/get-started` | Onboarding interest paths |
| `/login` | Auth shell — disabled, honest |
| `404` | Polished not-found |

**Redirects:** `/for-artists` → `/artists`, `/for-labels` → `/labels` (Next.js `redirects` + page redirects).

### Homepage density

Hero, trust indicators, DSP marquee (real Simple Icons brand SVGs + Amazon Music path), six feature cards, product showcase with **demo** dashboard UI, For Artists / For Labels, Publishing Group, workflow 01–06, QC, royalty demo UI, global reach, confirmed stats only (30+ Artists, 50+ Releases, 10+ New Releases/Month, 450+ Platforms), final CTA, footer.

### Intentional placeholders

- Newsletter signup — disabled / coming soon
- Social URLs — labels only, no fabricated links
- Legal pages — “soon”
- Contact form & login submit — disabled; no fake success
- Pricing amounts — “Contact Nexo” / being finalized
- Dashboard & royalty figures — labeled **Demo / Showcase** only
- Language selector — UI present, not multi-locale yet
- Artist portal / auth / uploads / admin — out of scope (public site only)

### Brand & theme

- `public/brand/nexo-logo-dark.png` / `nexo-logo-light.png` with theme switching via `Logo`
- Black + white premium editorial aesthetic; light and dark intentional
- DSP logos from `simple-icons` (monochrome `currentColor`) — not generic notes or AI fakes

### Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + design tokens in `src/app/globals.css`
- `next-themes`, `lucide-react`, `simple-icons`, `cva` / `clsx` / `tailwind-merge`

### Architecture stubs (unchanged intent)

`src/architecture/` still holds provider adapter interface, DB types, RBAC, module boundaries — **no** distribution API connection or fake keys.

---

## Company

NEXO MUSIC DISTRIBUTION LTD  
https://nexomusicdistribution.com
