export interface ProxyError extends Error {
  response?: {
    status: number;
    data: unknown;
  };
}

function makeProxyError(message: string, status: number, data: unknown): ProxyError {
  const error: ProxyError = new Error(message);
  error.response = { status, data };
  return error;
}

export async function proxyRestPost(path: string, queryParams?: Record<string, string>): Promise<unknown> {
  const apiUrl = process.env.DECOMPTE_API_BASE;
  const apiKey = process.env.DECOMPTE_API_KEY;
  const apiToken = process.env.DECOMPTE_API_BEARER;

  if (!apiUrl || !apiKey || !apiToken) {
    throw new Error('Decompte API credentials not configured.');
  }

  const restBase = new URL(apiUrl).origin;
  const qs = queryParams ? '?' + new URLSearchParams(queryParams).toString() : '';
  const url = `${restBase}${path}${qs}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${apiToken}` },
  });

  const text = await response.text();
  if (!response.ok) {
    throw makeProxyError(
      'Proxy REST request failed',
      response.status,
      text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : { message: text },
    );
  }
  return JSON.parse(text);
}

export async function proxyRestPostJson(path: string, body: unknown): Promise<unknown> {
  const apiUrl = process.env.DECOMPTE_API_BASE;
  const apiKey = process.env.DECOMPTE_API_KEY;
  const apiToken = process.env.DECOMPTE_API_BEARER;

  if (!apiUrl || !apiKey || !apiToken) {
    throw new Error('Decompte API credentials not configured.');
  }

  const restBase = new URL(apiUrl).origin;
  const url = `${restBase}${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw makeProxyError(
      'Proxy REST JSON request failed',
      response.status,
      text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : { message: text },
    );
  }
  return JSON.parse(text);
}

export async function proxyRestGet(path: string): Promise<unknown> {
  const apiUrl = process.env.DECOMPTE_API_BASE;
  const apiKey = process.env.DECOMPTE_API_KEY;
  const apiToken = process.env.DECOMPTE_API_BEARER;

  if (!apiUrl || !apiKey || !apiToken) {
    throw new Error('Decompte API credentials not configured.');
  }

  const restBase = new URL(apiUrl).origin;
  const url = `${restBase}${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${apiToken}` },
  });

  const text = await response.text();
  if (!response.ok) {
    throw makeProxyError(
      'Proxy REST request failed',
      response.status,
      text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : { message: text },
    );
  }
  return JSON.parse(text);
}

export async function proxyGraphQL(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const apiUrl = process.env.DECOMPTE_API_BASE;
  const apiKey = process.env.DECOMPTE_API_KEY;
  const apiToken = process.env.DECOMPTE_API_BEARER;

  if (!apiUrl || !apiKey || !apiToken) {
    throw new Error('Decompte API credentials not configured in environment (DECOMPTE_API_BASE, DECOMPTE_API_KEY, DECOMPTE_API_BEARER).');
  }

  const graphqlUrl = apiUrl.replace(/\/+$/, '');

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('Internal API proxy call failed:', {
        url: graphqlUrl,
        status: response.status,
        statusText: response.statusText,
        body: text
      });

      // Create a typed error so route handlers can extract status/data
      throw makeProxyError(
        'Proxy request failed',
        response.status,
        text.startsWith('{') ? JSON.parse(text) : { message: text },
      );
    }

    return JSON.parse(text);
  } catch (error: unknown) {
    const e = error as ProxyError;
    if (!e.response) {
      console.error('Error during internal API proxy call:', e.message);
    }
    throw error;
  }
}
