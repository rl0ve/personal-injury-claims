/**
 * The path prefix this app is mounted at.
 *
 * UiPath Coded Apps serve at `https://<org>.uipath.host/<routing-name>` and
 * inject the mount point into `index.html` at deploy time:
 *
 *   <base href="/maestro-case-app/">
 *   <meta name="uipath:app-base" content="/maestro-case-app">
 *
 * Locally and on Vercel the app is served from the domain root, no meta tag is
 * present, and this returns "/", so the same build works in all three places.
 *
 * This mirrors `getAppBase()` from `@uipath/uipath-typescript`. It's hand-rolled
 * because that package is the full UiPath SDK and this prototype makes no UiPath
 * API calls (and the repo's .npmrc redirects the @uipath scope to a gated feed).
 * If real UiPath data wiring ever lands, swap this for the SDK's version.
 */
export function getAppBase(): string {
  if (typeof document === "undefined") return "/";
  const content = document
    .querySelector('meta[name="uipath:app-base"]')
    ?.getAttribute("content")
    ?.trim();
  // The platform writes it without a trailing slash ("/maestro-case-app"), which
  // is the shape TanStack Router's `basepath` wants. Empty content = root.
  return content && content !== "" ? content : "/";
}

/**
 * Absolute origin + base prefix, with no trailing slash, for building shareable
 * links. At the root this is just the origin, so links stay unchanged locally.
 */
export function appOrigin(): string {
  const base = getAppBase();
  return base === "/" ? window.location.origin : `${window.location.origin}${base}`;
}

/**
 * Resolves an asset path in `public/` against the app's mount point.
 *
 * A bare relative path like `documents/report.pdf` resolves against the CURRENT
 * URL, not the app root, so the same link that works on `/actions` requests
 * `/cases/documents/report.pdf` from `/cases/CLAIM-5182` and 404s. This
 * prefixes the mount point instead, so a document opens from any route depth and
 * from a UiPath Coded App served under `/<routing-name>/`.
 */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  const base = getAppBase();
  return base === "/" ? `/${clean}` : `${base}/${clean}`;
}
