import { Location, GameState } from './types';

export const calculateDistance = (loc1: Location, loc2: Location): number => {
  const R = 6371;
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const formatDistance = (km: number): string => {
  if (km < 1) return `${(km * 1000).toFixed(0)}m`;
  return `${km.toFixed(2)}km`;
};

export const generateId = () => Math.random().toString(36).substr(2, 6).toUpperCase();

export const getLeanState = (state: GameState): Partial<GameState> => {
  const { questions, ...leanState } = state;
  return leanState;
};

/**
 * Modern non-blocking image compression using Web Workers.
 * Prevents main-thread jank and handles memory more efficiently.
 * Inlined via Blob to ensure compatibility across all environments.
 */
let worker: Worker | null = null;
let nextMessageId = 0;
const pendingRequests = new Map<number, { resolve: (value: string) => void; fallback: string }>();

const createWorker = () => {
  const workerCode = `
    self.onmessage = async (e) => {
      const { id, blob, maxWidth, quality } = e.data;
      try {
        const img = await createImageBitmap(blob);
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        const reader = new FileReader();
        reader.onloadend = () => self.postMessage({ id, dataUrl: reader.result });
        reader.readAsDataURL(compressedBlob);
        img.close();
      } catch (error) {
        self.postMessage({ id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
};

export const compressImage = async (dataUrl: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
  if (!worker) {
    try {
      worker = createWorker();
      worker.onerror = (err) => {
        console.error("Worker fatal error:", err);
        pendingRequests.forEach(entry => entry.resolve(entry.fallback));
        pendingRequests.clear();
      };
      worker.onmessage = (e) => {
        const { id, dataUrl: resultUrl, error } = e.data;
        const entry = pendingRequests.get(id);
        if (entry) {
          if (error || !resultUrl) {
            console.error("Worker error during compression, using original image:", error);
            entry.resolve(entry.fallback);
          } else {
            entry.resolve(resultUrl);
          }
          pendingRequests.delete(id);
        }
      };
    } catch (err) {
      console.error("Worker creation failed:", err);
      return dataUrl;
    }
  }

  return new Promise((resolve) => {
    const id = nextMessageId++;
    pendingRequests.set(id, { resolve, fallback: dataUrl });
    
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        worker?.postMessage({ id, blob, maxWidth, quality });
      })
      .catch(err => {
        console.error("Image processing request failed:", err);
        resolve(dataUrl);
        pendingRequests.delete(id);
      });
  });
};