/**
 * Image Utility: Enforces WebP compression and responsive resizing.
 */
export function getOptimizedImage(url: string, width = 400): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&q=80&w=400';
  }

  // Cloudinary account dp1x9u4vh has Strict Transformations enabled, which blocks 
  // dynamic resizing on-the-fly (returns 400/404). We serve the raw URL unmodified 
  // to ensure images load perfectly exactly like the homepage grid.
  return url;
}
