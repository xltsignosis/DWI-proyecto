const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL || '';

function isLocalBrowser() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function getApiBaseUrl() {
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV !== 'production' || isLocalBrowser()) {
    return 'http://localhost:3001';
  }

  throw new Error('Falta configurar NEXT_PUBLIC_API_URL con la URL pública del backend en Render.');
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export const API_URL = configuredApiUrl ? configuredApiUrl.replace(/\/$/, '') : 'http://localhost:3001';
