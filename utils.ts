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
  if (km === undefined || km === null || isNaN(km)) return '0 m';
  if (km <= 0) return '0 m';

  // If distance is less than 1 km, display in meters (m) with at least 3 value digits
  if (km < 1) {
    const m = km * 1000;
    let formatted: string;

    if (m >= 100) {
      formatted = m.toFixed(0);
    } else if (m >= 10) {
      formatted = m.toFixed(1);
    } else if (m >= 1) {
      formatted = m.toFixed(2);
    } else if (m >= 0.1) {
      formatted = m.toFixed(3);
    } else if (m >= 0.01) {
      formatted = m.toFixed(4);
    } else {
      formatted = m.toFixed(5);
    }

    return `${formatted.replace('.', ',')} m`;
  }

  // If distance is 1 km or greater, display in kilometers (km) with at least 3 value digits
  let formatted: string;

  if (km >= 100) {
    formatted = km.toFixed(0);
  } else if (km >= 10) {
    formatted = km.toFixed(1);
  } else {
    // 1 <= km < 10 -> 2 decimals (e.g. 1,23 km)
    formatted = km.toFixed(2);
  }

  return `${formatted.replace('.', ',')} km`;
};

export const generateId = () => Math.random().toString(36).substr(2, 6).toUpperCase();

export const getOpenTrailCode = (trailId: string): string => {
  if (!trailId) return 'OT-000000';
  const upper = trailId.toUpperCase();
  if (upper.startsWith('OT-')) return upper;
  if (upper.startsWith('OT')) return `OT-${upper.slice(2)}`;
  const clean = trailId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const shortPart = clean.slice(0, 8);
  return `OT-${shortPart}`;
};

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