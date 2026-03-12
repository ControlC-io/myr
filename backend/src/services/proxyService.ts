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
    const error: any = new Error('Proxy REST request failed');
    error.response = {
      status: response.status,
      data: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : { message: text },
    };
    throw error;
  }
  return JSON.parse(text);
}

/**
 * Proxies a GraphQL query to the internal API using credentials from environment variables.
 *
 * @param query The GraphQL query string to execute.
 * @returns The response data from the internal API.
 */
export async function proxyGraphQL(query: string): Promise<any> {
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
      body: JSON.stringify({ query }),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('Internal API proxy call failed:', {
        url: graphqlUrl,
        status: response.status,
        statusText: response.statusText,
        body: text
      });
      
      // Create a fake Axios-like error object so the route handler can extract status/data
      const error: any = new Error('Proxy request failed');
      error.response = {
        status: response.status,
        data: text.startsWith('{') ? JSON.parse(text) : { message: text }
      };
      throw error;
    }

    return JSON.parse(text);
  } catch (error: any) {
    if (!error.response) {
      console.error('Error during internal API proxy call:', error.message);
    }
    throw error;
  }
}
