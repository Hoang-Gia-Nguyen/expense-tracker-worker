import { getCorsHeaders } from './cors';

const PUBLIC_KEY_CACHE_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 30;
const publicKeyCache = new Map();

function unauthorized(request) {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...getCorsHeaders(request),
    },
  });
}

function unavailable(request) {
  return new Response('Authentication is not configured', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...getCorsHeaders(request),
    },
  });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonSegment(segment) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

async function getPublicKeys(teamDomain) {
  const cached = publicKeyCache.get(teamDomain);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Access certificate request failed (${response.status})`);

  const payload = await response.json();
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('Access certificate response did not contain keys');
  }

  const keys = new Map();
  for (const jwk of payload.keys) {
    if (jwk.kid && jwk.kty === 'RSA' && jwk.n && jwk.e) {
      keys.set(jwk.kid, await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      ));
    }
  }
  if (keys.size === 0) throw new Error('Access certificate response had no supported keys');

  publicKeyCache.set(teamDomain, { keys, expiresAt: Date.now() + PUBLIC_KEY_CACHE_TTL_MS });
  return keys;
}

async function isValidAccessAssertion(token, teamDomain, audience) {
  if (!token || token.length > 8192) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  let header;
  let claims;
  try {
    header = decodeJsonSegment(parts[0]);
    claims = decodeJsonSegment(parts[1]);
  } catch {
    return false;
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;

  const issuer = `https://${teamDomain}`;
  const tokenAudiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== issuer || !tokenAudiences.includes(audience)) return false;
  if (!Number.isFinite(claims.exp) || claims.exp <= now - CLOCK_SKEW_SECONDS) return false;
  if (Number.isFinite(claims.nbf) && claims.nbf > now + CLOCK_SKEW_SECONDS) return false;

  const keys = await getPublicKeys(teamDomain);
  const key = keys.get(header.kid);
  if (!key) return false;

  try {
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}

/** Verify Cloudflare Access JWTs and fail closed if Access is not configured. */
export async function cloudflareAccessMiddleware(request, env) {
  if (env.APP_ENV === 'development'
    && env.ALLOW_UNAUTHENTICATED_LOCAL === 'true'
    && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)) {
    return undefined;
  }

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  const audience = env.CF_ACCESS_AUD;
  if (typeof teamDomain !== 'string'
    || !/^[a-z0-9.-]+$/i.test(teamDomain)
    || typeof audience !== 'string'
    || audience.length === 0) {
    return unavailable(request);
  }

  try {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (await isValidAccessAssertion(token, teamDomain, audience)) return undefined;
    return unauthorized(request);
  } catch (error) {
    console.error('Cloudflare Access validation failed:', error);
    return unavailable(request);
  }
}
