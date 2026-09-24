/**
 * Centralized API client for Solar ERP
 */

const TOKEN_KEY = 'solar_session_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to update auth token in localStorage:', err);
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach Bearer token from localStorage for iframe compatibility
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // sends solar_session cookie automatically when allowed
  });

  const data = await response.json().catch(() => ({}));

  // Auto-capture session token from response if returned
  if (data && typeof data === 'object') {
    if (typeof data.sessionId === 'string' && data.sessionId) {
      setAuthToken(data.sessionId);
    } else if (typeof data.token === 'string' && data.token) {
      setAuthToken(data.token);
    }
  }

  if (!response.ok) {
    const errorMsg = data.error || `Request failed with status ${response.status}`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}