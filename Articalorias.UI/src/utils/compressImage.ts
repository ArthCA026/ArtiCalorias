/**
 * Compresses and resizes an image file using the Canvas API.
 *
 * - Resizes so that the longest edge is at most `maxPx` pixels.
 * - Re-encodes as JPEG at the given `quality` (0–1).
 * - Returns the raw base64 string (no data URL prefix) and the output MIME type.
 *
 * This runs entirely in the browser — the image bytes never leave the device
 * until explicitly sent to the API.
 */
export async function compressImage(
  file: File,
  maxPx = 1024,
  quality = 0.8,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calculate target dimensions while preserving aspect ratio
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx);
          width = maxPx;
        } else {
          width = Math.round((width / height) * maxPx);
          height = maxPx;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const outputMimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(outputMimeType, quality);

      // Strip the "data:image/jpeg;base64," prefix
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode image as base64.'));
        return;
      }

      resolve({ base64, mimeType: outputMimeType });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression.'));
    };

    img.src = objectUrl;
  });
}
