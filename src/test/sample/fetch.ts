const globalFetch = window.fetch.bind(window);

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface FetchOptions<T> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  body?: T;
  timeout?: number;
}

async function httpRequest<TRequest, TResponse>(
  url: string,
  options: FetchOptions<TRequest> = {}
): Promise<TResponse> {
  const {
    method = 'GET',
    headers = {},
    queryParams,
    body,
    timeout = 10000
  } = options;

  // Build query string
  const queryString = queryParams
    ? '?' + new URLSearchParams(queryParams as Record<string, string>).toString()
    : '';

  const fullUrl = url + queryString;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    signal: controller.signal
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await globalFetch(fullUrl, fetchOptions);
    clearTimeout(timer);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorBody}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    throw new Error("Unsupported response type");
  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
}