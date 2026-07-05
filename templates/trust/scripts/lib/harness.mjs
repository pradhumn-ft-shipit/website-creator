// Shared harness for the quality gates: serve the built `dist/` via Astro's programmatic
// preview server and enumerate the routes to audit (the section-removal-derived nav — so the
// gates audit exactly the pages that ship).
import { preview } from 'astro';
import { navInternal } from '../../src/config/site.mjs';

/** Internal routes that actually build (nav minus external Client Login), plus the 404 page. */
export function routes() {
  const nav = navInternal.map((n) => n.href);
  return [...nav, '/404'];
}

/** Start `astro preview`, run `fn(baseUrl)`, always stop the server. */
export async function withPreviewServer(fn) {
  const server = await preview({ logLevel: 'error' });
  const host = !server.host || server.host === '::' || server.host === '0.0.0.0' ? 'localhost' : server.host;
  const base = `http://${host}:${server.port}`;
  try {
    return await fn(base);
  } finally {
    await server.stop();
  }
}
