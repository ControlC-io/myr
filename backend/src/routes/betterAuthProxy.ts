import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { auth } from '../lib/auth';
import { proxyGraphQL } from '../services/proxyService';
import { buildContactSupplierQuery } from '../services/decompteQueries';

const router = express.Router();

/** Cookie prefix (must match auth.ts advanced.cookiePrefix). */
const COOKIE_PREFIX = 'dmz_auth';
/** Better Auth cookie names (prefix.name). */
const SESSION_COOKIE = `${COOKIE_PREFIX}.session_token`;
const SESSION_DATA_COOKIE = `${COOKIE_PREFIX}.session_data`;

/**
 * Set-Cookie values to clear all session-related cookies. Send both path variants
 * so the browser clears them whether Better Auth set them with Path=/ or Path=/api/auth.
 */
function clearSessionCookieHeaders(): string[] {
  const names = [SESSION_COOKIE, SESSION_DATA_COOKIE];
  const headers: string[] = [];
  for (const name of names) {
    headers.push(`${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    headers.push(`${name}=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Lax`);
  }
  return headers;
}

/**
 * Proxies all unmatched /api/auth/* requests to Better Auth handler.
 * Normalizes 4xx/5xx responses to JSON so clients can show message/error.
 * On sign-out, forces session cookie clearing regardless of Better Auth's response status.
 */

export async function betterAuthProxyHandler(req: ExpressRequest, res: ExpressResponse): Promise<void> {
  // Pre-registration check: verify email exists in the supplier system before
  // forwarding to Better Auth, so unrecognised emails are blocked server-side.
  const isSignUp = req.method === 'POST' && req.originalUrl.includes('/sign-up/email');
  if (isSignUp) {
    const email: string | undefined = req.body?.email;
    if (!email) {
      res.status(400).json({ error: 'Email is required', message: 'Email is required' });
      return;
    }
    try {
      const query = buildContactSupplierQuery(email);
      const result = await proxyGraphQL(query) as { data?: { contactSupplier?: { total: number } } };
      const total = result?.data?.contactSupplier?.total ?? 0;
      if (total === 0) {
        res.status(403).json({
          error: 'USER_NOT_REGISTERED',
          message: 'User not registered in our server',
          code: 'USER_NOT_REGISTERED',
        });
        return;
      }
    } catch (checkErr) {
      console.error('Pre-registration supplier check failed:', (checkErr as Error).message);
      res.status(503).json({
        error: 'Registration check unavailable',
        message: 'Registration check unavailable. Please try again later.',
      });
      return;
    }
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    // Use originalUrl so Better Auth receives /api/auth/get-session, not just /get-session
    const url = `${protocol}://${host}${req.originalUrl}`;
    const isSignOut = req.method === 'POST' && req.originalUrl.includes('/sign-out');

    let bodyString =
      req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body ?? {}) : undefined;
    const headers = new Headers(req.headers as Record<string, string>);
    if (req.method !== 'GET' && req.method !== 'HEAD' && !headers.has('content-type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && (bodyString === undefined || bodyString === '')) {
      bodyString = '{}';
    }
    // Web API Request (fetch), not Express Request
    const webRequest = new Request(url, {
      method: req.method,
      headers,
      body: bodyString,
    });

    const response = await auth.handler(webRequest);
    const body = await response.text();

    res.status(response.status);
    // Forward all headers. Set-Cookie must be forwarded as an array so we don't lose
    // the cookie-clear header on sign-out. getSetCookie() exists in Node 21+; fallback for Node 20.
    let setCookieValues: string[] = [];
    if (typeof response.headers.getSetCookie === 'function') {
      setCookieValues = response.headers.getSetCookie();
    } else {
      const v = response.headers.get('set-cookie');
      if (v !== null && v !== undefined) {
        setCookieValues = Array.isArray(v) ? v : [String(v)];
      }
    }
    // On sign-out, always clear session cookies so the browser logs out even if Better Auth
    // returns non-2xx (e.g. 415 Unsupported Media Type when body/Content-Type is wrong).
    if (isSignOut) {
      setCookieValues = clearSessionCookieHeaders();
    }
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
    });
    if (setCookieValues.length > 0) {
      res.setHeader('Set-Cookie', setCookieValues);
    }

    if (response.status >= 400) {
      let json: { message?: string; error?: string } | null = null;
      if (body.trim()) {
        try {
          json = JSON.parse(body) as { message?: string; error?: string };
        } catch {
          /* body is not JSON */
        }
      }
      const message = (json?.message ?? json?.error ?? body) || response.statusText;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Auth-Error-Normalized', '1');
      res.json({ error: message, message });
      return;
    }

    res.send(body);
  } catch (error) {
    console.error('Auth handler error:', error);
    res.setHeader('X-Auth-Error-Normalized', '1');
    res.status(500).json({ error: 'Authentication error', message: (error as Error).message });
  }
}

router.all('*', (req, res, next) => {
  betterAuthProxyHandler(req, res).catch(next);
});

export default router;
