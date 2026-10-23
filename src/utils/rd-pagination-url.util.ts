import type { RdCredentials } from 'src/types/rd-credentials';

/** Resolve RD cursors without trusting their host or allowing a different resource. */
export const rdPaginationUrl = (
  version: RdCredentials['version'],
  path: string,
  nextPath: string | null = null,
): URL => {
  const origin = version === 'v1'
    ? 'https://crm.rdstation.com'
    : 'https://api.rd.services';
  const prefix = version === 'v1' ? '/api/v1/' : '/crm/v2/';
  const resource = new URL(`${prefix}${path}`, origin);
  let url: URL;
  try {
    url = nextPath === null ? new URL(resource) : new URL(nextPath, resource);
  } catch {
    throw new Error('Unsafe pagination URL returned by RD Station.');
  }
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Unsafe pagination URL returned by RD Station.');
  // Some RD v2 responses emit /api/v2 links. Only normalize on the official
  // HTTPS origin, then require the exact resource originally requested.
  if (version === 'v2' && nextPath !== null && url.pathname.startsWith('/api/v2/'))
    url.pathname = url.pathname.replace(/^\/api\/v2\//, '/crm/v2/');
  if (
    !resource.pathname.startsWith(prefix) ||
    url.pathname !== resource.pathname
  )
    throw new Error('Unsafe pagination URL returned by RD Station.');
  url.searchParams.sort();
  return url;
};
