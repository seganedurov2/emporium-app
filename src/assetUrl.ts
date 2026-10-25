/**
 * Resolves a path inside `public/` against the app's deploy base URL.
 *
 * Vite only rewrites asset references it can statically analyse; portrait
 * URLs are assembled at runtime, so they need this manual prefix. With a
 * relative base (`./`) the result resolves correctly both at the domain
 * root and under a GitHub Pages project subpath.
 */
export const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
