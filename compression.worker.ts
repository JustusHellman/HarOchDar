/**
 * Web Worker for heavy image processing tasks.
 * Uses OffscreenCanvas to perform resizing and JPEG encoding off the main thread.
 */

self.onmessage = async (e: MessageEvent) => {
  const { id, blob, maxWidth, quality } = e.data;

  try {
    // 1. Create ImageBitmap from the input Blob
    // This is faster and more memory-efficient than HTMLImageElement
    const img = await createImageBitmap(blob);

    let width = img.width;
    let height = img.height;

    // 2. Calculate new dimensions
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    // 3. Setup OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get 2D context from OffscreenCanvas');
    }

    // 4. Draw and Resize
    ctx.drawImage(img, 0, 0, width, height);
    
    // 5. Convert to Blob (JPEG)
    // This part is computationally expensive for large images
    const compressedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: quality
    });

    // 6. Convert to DataURL
    // We do this in the worker to keep the main thread free
    const reader = new FileReader();
    reader.onloadend = () => {
      self.postMessage({ id, dataUrl: reader.result });
    };
    reader.readAsDataURL(compressedBlob);

    // Cleanup
    img.close();
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Unknown compression error' });
  }
};
