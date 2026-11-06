// First-visit dashboard welcome. Paste the Loom share link here to switch the
// welcome video on; while it is empty (or not a Loom link) only the tour runs.
export const WELCOME_VIDEO_URL = '';

// Accepts https://www.loom.com/share/<id> or /embed/<id> (optional query) and
// returns the embeddable URL. Anything else (other hosts, http, junk) -> null.
export function loomEmbedUrl(url: string): string | null {
  const m = /^https:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([A-Za-z0-9]{16,64})(?:[/?#].*)?$/.exec(url.trim());
  return m ? `https://www.loom.com/embed/${m[1]}` : null;
}
