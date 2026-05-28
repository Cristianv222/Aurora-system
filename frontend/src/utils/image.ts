/**
 * Utility function to clean and format image URLs for products and categories.
 * Strips host and port from Django REST Framework URLs to make them relative,
 * ensuring they resolve correctly through the Nginx proxy regardless of client domain/IP.
 */
export const getCleanImageUrl = (url: string | null | undefined): string => {
  if (!url) return '/logo-aurora.png';

  // If it is a full URL, extract the path component.
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      return parsed.pathname;
    } catch (e) {
      console.warn('Error parsing image URL:', url, e);
    }
  }

  // If it's already a relative path starting with '/', return it
  if (url.startsWith('/')) {
    return url;
  }

  // Otherwise, prepend a slash to ensure it's relative to the origin
  return '/' + url;
};
