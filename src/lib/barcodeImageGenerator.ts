import JsBarcode from 'jsbarcode';
import { BarcodeFormat, validateInput, normalizeForRendering } from '@/lib/barcodeUtils';

export interface BarcodeImageResult {
  dataUrl: string;
  width: number;
  height: number;
  value: string;
}

export async function generateBarcodeImage(
  value: string,
  format: BarcodeFormat,
  scale: number,
  margin = 10
): Promise<BarcodeImageResult | null> {
  const validation = validateInput(value, format);
  if (!validation.valid) return null;

  const renderValue = normalizeForRendering(value, format);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  try {
    JsBarcode(svg, renderValue, {
      format,
      width: 2 * scale,
      height: 100 * scale,
      displayValue: false,
      lineColor: '#000000',
      background: '#FFFFFF',
      margin: margin * scale,
      font: 'monospace',
    });

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      value,
    };
  } catch (e) {
    console.warn(`Failed to generate barcode for: ${value}`, e);
    return null;
  }
}

export async function generateBarcodeBlob(
  value: string,
  format: BarcodeFormat,
  scale: number,
  margin = 10
): Promise<Blob | null> {
  const validation = validateInput(value, format);
  if (!validation.valid) return null;

  const renderValue = normalizeForRendering(value, format);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  try {
    JsBarcode(svg, renderValue, {
      format,
      width: 2 * scale,
      height: 100 * scale,
      displayValue: false,
      lineColor: '#000000',
      background: '#FFFFFF',
      margin: margin * scale,
      font: 'monospace',
    });

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });

    return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  } catch (e) {
    console.warn(`Failed to generate barcode for: ${value}`, e);
    return null;
  }
}
