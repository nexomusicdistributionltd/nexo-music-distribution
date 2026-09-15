/**
 * Public HTTPS brand assets for outbound email.
 * Prefer CloudFront wordmark + icon_light (jsDelivr on this branch).
 * Never use relative /public paths in messages — clients cannot fetch them.
 */
export const NEXO_EMAIL_BRAND = {
  website: "https://nexomusicdistro.space",
  tiktok: "https://www.tiktok.com/@nexomusicdistribution",
  email: "contact@nexomusicdistro.space",
  company: "Nexo Music Distribution LTD",
  tagline: "Digital Music Distribution | Publishing | Royalty Management",
  /** Silver wordmark on transparent (CloudFront). */
  wordmark:
    "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/5d2343c0-6c83-4277-855d-696ffca77790.png",
  /** Light icon for dark fields (jsDelivr, repo public/brand/email). */
  iconLight:
    "https://cdn.jsdelivr.net/gh/nexomusicdistributionltd/nexo-music-distribution@feat/nexo-email-architecture/public/brand/email/nexo-icon-light-v2.png",
  icons: {
    tiktokWhite:
      "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/ab90abbb-2019-4161-877c-b2cbb0b92826.png",
    globeWhite:
      "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/a46131aa-a854-42f5-b65d-358571cea2fd.png",
    mailWhite:
      "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/0a190c12-e78c-4f1c-a230-aead6a8ced17.png",
  },
} as const;

export const NEXO_EMAIL_SHELL_PATH = "emails/shells/nexo-dark.html";
