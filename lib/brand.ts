/** Branding and outbound links, kept in one place so they're easy to change. */

export const BRAND = {
  name: "Free Higgsfield",
  short: "Studio",
  tagline: "Estúdio de imagens e vídeos com pagamento por geração",
};

/**
 * Where the home-page banner sends people to create a key.
 *
 * `console.higgsfield.ai` is the real API console — the authentication docs
 * point there, and `cloud.higgsfield.ai` redirects to it. Swap in a referral
 * URL here when one is live; note `higgsfield.com` redirects to
 * `higgsfield.ai`, so an affiliate path has to exist on the `.ai` domain.
 */
export const AFFILIATE = {
  label: "Obtenha suas chaves de API",
  display: "higgsfield.ai",
  href: "https://console.higgsfield.ai",
};
