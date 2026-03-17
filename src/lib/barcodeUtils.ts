// Barcode utility functions

export type BarcodeFormat = 
  // 1D Barcodes (JsBarcode)
  | 'CODE39'
  | 'CODE93'
  | 'CODE128'
  | 'EAN13'
  | 'EAN8'
  | 'EAN5'
  | 'EAN2'
  | 'UPC'
  | 'UPCE'
  | 'ITF14'
  | 'ITF'
  | 'MSI'
  | 'MSI10'
  | 'MSI11'
  | 'MSI1010'
  | 'MSI1110'
  | 'pharmacode'
  | 'codabar'
  // 2D Barcodes (bwip-js)
  | 'qrcode'
  | 'azteccode'
  | 'datamatrix'
  | 'pdf417';

// Helper to check if format is 2D
export function is2DBarcode(format: BarcodeFormat): boolean {
  return ['qrcode', 'azteccode', 'datamatrix', 'pdf417'].includes(format);
}

export type ChecksumType = 
  | 'none' 
  | 'mod10' 
  | 'mod11' 
  | 'mod43' 
  | 'mod16' 
  | 'japanNW7' 
  | 'jrc' 
  | 'luhn' 
  | 'mod11PZN' 
  | 'mod11A' 
  | 'mod10Weight2' 
  | 'mod10Weight3' 
  | '7CheckDR' 
  | 'mod16Japan'
  | 'ean13' 
  | 'upc';

export type QualityLevel = 'A' | 'B' | 'C';

export const QUALITY_LEVELS: { value: QualityLevel; label: string; description: string; blur: number }[] = [
  { value: 'A', label: 'High (A)', description: 'Crystal clear, sharp edges', blur: 0 },
  { value: 'B', label: 'Medium (B)', description: 'Slightly softened edges', blur: 0.5 },
  { value: 'C', label: 'Low (C)', description: 'Blurred, degraded appearance', blur: 1.2 },
];

export interface BarcodeConfig {
  format: BarcodeFormat;
  text: string;
  widthMils: number;
  dpi: number;
  height: number;
  displayValue: boolean;
  fontSize: number;
  lineColor: string;
  background: string;
  margin: number;
  checksumType: ChecksumType;
  quality: QualityLevel;
  scale: number;
}

export function getApplicableChecksums(format: BarcodeFormat): { value: ChecksumType; label: string }[] {
  const checksums: { value: ChecksumType; label: string }[] = [{ value: 'none', label: 'None' }];
  
  switch (format) {
    case 'CODE39':
      checksums.push({ value: 'mod43', label: 'Modulo 43' });
      break;
    case 'codabar':
      checksums.push({ value: 'mod16', label: 'Modulo 16' });
      checksums.push({ value: 'japanNW7', label: 'Japan NW-7' });
      checksums.push({ value: 'jrc', label: 'JRC' });
      checksums.push({ value: 'luhn', label: 'Luhn' });
      checksums.push({ value: 'mod11PZN', label: 'Modulo 11 PZN' });
      checksums.push({ value: 'mod11A', label: 'Modulo 11-A' });
      checksums.push({ value: 'mod10Weight2', label: 'Modulo 10 Weight 2' });
      checksums.push({ value: 'mod10Weight3', label: 'Modulo 10 Weight 3' });
      checksums.push({ value: '7CheckDR', label: '7 Check DR' });
      checksums.push({ value: 'mod16Japan', label: 'Modulo 16 Japan' });
      break;
    // EAN-13, EAN-8, UPC-A, UPC-E, Code 128 have intrinsic checksums
    // handled automatically by the rendering library — no user option needed
    case 'EAN13':
    case 'EAN8':
    case 'UPC':
    case 'UPCE':
    case 'CODE128':
      return []; // No checksum options — built-in
    case 'ITF':
    case 'ITF14':
      checksums.push({ value: 'mod10', label: 'Modulo 10 (auto-pads for even length)' });
      break;
    case 'MSI':
      checksums.push({ value: 'mod10', label: 'Modulo 10' });
      checksums.push({ value: 'mod11', label: 'Modulo 11' });
      break;
  }
  
  return checksums;
}

export function applyChecksum(text: string, format: BarcodeFormat, checksumType: ChecksumType): string {
  if (checksumType === 'none' || !text.trim()) return text;
  
  // For ITF barcodes, we need to ensure even length after adding checksum
  const isITF = format === 'ITF' || format === 'ITF14';
  
  switch (checksumType) {
    case 'mod10': {
      const checkDigit = calculateMod10(text);
      let result = text + checkDigit;
      // ITF requires even number of digits - pad with leading zero if needed
      if (isITF && result.length % 2 !== 0) {
        result = '0' + result;
      }
      return result;
    }
    case 'mod11': {
      const check = calculateMod11(text);
      return text + (check === 10 ? 'X' : check);
    }
    case 'mod43':
      return text + calculateMod43Checksum(text);
    case 'mod16':
      return text + calculateMod16Checksum(text);
    case 'japanNW7':
      return text + calculateJapanNW7Checksum(text);
    case 'jrc':
      return text + calculateJRCChecksum(text);
    case 'luhn':
      return text + calculateLuhnChecksum(text);
    case 'mod11PZN':
      return text + calculateMod11PZNChecksum(text);
    case 'mod11A':
      return text + calculateMod11AChecksum(text);
    case 'mod10Weight2':
      return text + calculateMod10Weight2Checksum(text);
    case 'mod10Weight3':
      return text + calculateMod10Weight3Checksum(text);
    case '7CheckDR':
      return text + calculate7CheckDRChecksum(text);
    case 'mod16Japan':
      return text + calculateMod16JapanChecksum(text);
    case 'ean13':
      if (text.length === 12) {
        return text + calculateEAN13Checksum(text);
      }
      return text;
    case 'upc':
      if (text.length === 11) {
        return text + calculateUPCChecksum(text);
      }
      return text;
    default:
      return text;
  }
}

export const BARCODE_FORMATS: { value: BarcodeFormat; label: string; description: string; validChars: string; lengthHint: string; category: '1D' | '2D' }[] = [
  // 1D Barcodes
  { 
    value: 'CODE39', 
    label: 'CODE 39', 
    description: 'Alphanumeric, widely used in industrial applications',
    validChars: 'A-Z, 0-9, -, ., $, /, +, %, SPACE',
    lengthHint: 'Any length',
    category: '1D'
  },
  { 
    value: 'CODE93', 
    label: 'CODE 93', 
    description: 'Higher density than CODE 39, full ASCII support',
    validChars: 'All ASCII characters',
    lengthHint: 'Any length',
    category: '1D'
  },
  { 
    value: 'CODE128', 
    label: 'CODE 128', 
    description: 'High-density, supports full ASCII',
    validChars: 'All ASCII characters (0-127)',
    lengthHint: 'Any length',
    category: '1D'
  },
  { 
    value: 'EAN13',
    label: 'EAN-13', 
    description: 'European Article Number, retail products',
    validChars: '0-9 only',
    lengthHint: '12 or 13 digits',
    category: '1D'
  },
  { 
    value: 'EAN8', 
    label: 'EAN-8', 
    description: 'Short version of EAN-13',
    validChars: '0-9 only',
    lengthHint: '7 or 8 digits',
    category: '1D'
  },
  { 
    value: 'EAN5', 
    label: 'EAN-5', 
    description: 'UPC/EAN supplemental 5-digit add-on',
    validChars: '0-9 only',
    lengthHint: 'Exactly 5 digits',
    category: '1D'
  },
  { 
    value: 'EAN2', 
    label: 'EAN-2', 
    description: 'UPC/EAN supplemental 2-digit add-on',
    validChars: '0-9 only',
    lengthHint: 'Exactly 2 digits',
    category: '1D'
  },
  { 
    value: 'UPC', 
    label: 'UPC-A', 
    description: 'Universal Product Code, US retail',
    validChars: '0-9 only',
    lengthHint: '11 or 12 digits',
    category: '1D'
  },
  { 
    value: 'UPCE', 
    label: 'UPC-E', 
    description: 'Compressed UPC for small packages',
    validChars: '0-9 only',
    lengthHint: '6, 7, or 8 digits',
    category: '1D'
  },
  { 
    value: 'ITF14', 
    label: 'ITF-14', 
    description: 'Interleaved 2 of 5, shipping containers',
    validChars: '0-9 only',
    lengthHint: '13 or 14 digits',
    category: '1D'
  },
  { 
    value: 'ITF', 
    label: 'ITF', 
    description: 'Interleaved 2 of 5',
    validChars: '0-9 only',
    lengthHint: 'Even number of digits',
    category: '1D'
  },
  { 
    value: 'MSI', 
    label: 'MSI', 
    description: 'Modified Plessey, inventory control',
    validChars: '0-9 only',
    lengthHint: 'Any length',
    category: '1D'
  },
  { 
    value: 'MSI10', 
    label: 'MSI Mod 10', 
    description: 'MSI with Mod 10 check digit',
    validChars: '0-9 only',
    lengthHint: 'Any length',
    category: '1D'
  },
  { 
    value: 'MSI11', 
    label: 'MSI Mod 11', 
    description: 'MSI with Mod 11 check digit',
    validChars: '0-9 only',
    lengthHint: 'Any length',
    category: '1D'
  },
  { 
    value: 'pharmacode', 
    label: 'Pharmacode', 
    description: 'Pharmaceutical packaging',
    validChars: '0-9 only',
    lengthHint: 'Number 3-131070',
    category: '1D'
  },
  { 
    value: 'codabar', 
    label: 'Codabar', 
    description: 'Libraries, blood banks, shipping',
    validChars: '0-9, -, $, :, /, ., +',
    lengthHint: 'Any length',
    category: '1D'
  },
  // 2D Barcodes
  { 
    value: 'qrcode', 
    label: 'QR Code', 
    description: 'Quick Response code, widely used for URLs and data',
    validChars: 'All characters',
    lengthHint: 'Up to 4,296 chars',
    category: '2D'
  },
  { 
    value: 'azteccode', 
    label: 'Aztec Code', 
    description: 'High-density 2D barcode, used in transport tickets',
    validChars: 'All ASCII characters',
    lengthHint: 'Up to 3,832 chars',
    category: '2D'
  },
  { 
    value: 'datamatrix', 
    label: 'Data Matrix', 
    description: '2D matrix barcode for small items',
    validChars: 'All ASCII characters',
    lengthHint: 'Up to 2,335 chars',
    category: '2D'
  },
  { 
    value: 'pdf417', 
    label: 'PDF417', 
    description: 'Stacked linear barcode, used in IDs and shipping',
    validChars: 'All ASCII characters',
    lengthHint: 'Up to 1,850 chars',
    category: '2D'
  },
];

// Calculate various checksums

// Standard Luhn algorithm (Mod 10 with doubling)
export function calculateMod10(input: string): number {
  const digits = input.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  let isOdd = true;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if (isOdd) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isOdd = !isOdd;
  }
  
  return (10 - (sum % 10)) % 10;
}

// Mod 11 checksum with weights 2-7
export function calculateMod11(input: string): number {
  const digits = input.replace(/\D/g, '').split('').map(Number).reverse();
  const weights = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * weights[i % weights.length];
  }
  
  const remainder = sum % 11;
  return remainder === 0 ? 0 : 11 - remainder;
}

// Modulo 43 for CODE39 and CODE39 Full ASCII
export function calculateMod43Checksum(input: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
  let sum = 0;
  
  for (const char of input.toUpperCase()) {
    const index = chars.indexOf(char);
    if (index !== -1) {
      sum += index;
    }
  }
  
  return chars[sum % 43];
}

// Legacy CODE39 checksum (same as Mod43)
export function calculateCode39Checksum(input: string): string {
  return calculateMod43Checksum(input);
}

// Modulo 16 for Codabar
export function calculateMod16Checksum(input: string): string {
  const codabarChars = '0123456789-$:/.+';
  let sum = 0;
  
  for (const char of input) {
    const index = codabarChars.indexOf(char);
    if (index !== -1) {
      sum += index;
    }
  }
  
  const check = sum % 16;
  return codabarChars[check];
}

// Japan NW-7 checksum for Codabar
export function calculateJapanNW7Checksum(input: string): string {
  const codabarChars = '0123456789-$:/.+ABCD';
  let sum = 0;
  
  for (const char of input.toUpperCase()) {
    const index = codabarChars.indexOf(char);
    if (index !== -1) {
      sum += index;
    }
  }
  
  const check = (16 - (sum % 16)) % 16;
  return codabarChars[check];
}

// JRC (Japanese Railway) checksum
export function calculateJRCChecksum(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 2);
  }
  
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

// Luhn algorithm (same as standard credit card check)
export function calculateLuhnChecksum(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if ((digits.length - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

// Modulo 11 PZN (Pharmazentralnummer) checksum
export function calculateMod11PZNChecksum(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (i + 1);
  }
  
  const check = sum % 11;
  return check === 10 ? '0' : String(check);
}

// Modulo 11-A checksum
export function calculateMod11AChecksum(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number).reverse();
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (i + 2);
  }
  
  const remainder = sum % 11;
  const check = remainder === 0 ? 0 : 11 - remainder;
  return check === 10 ? 'X' : String(check);
}

// Modulo 10 with weight 2 (alternating 1,2)
export function calculateMod10Weight2Checksum(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    const weight = i % 2 === 0 ? 1 : 2;
    let weighted = digits[i] * weight;
    if (weighted > 9) weighted -= 9;
    sum += weighted;
  }
  
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

// Modulo 10 with weight 3 (alternating 1,3)
export function calculateMod10Weight3Checksum(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    const weight = i % 2 === 0 ? 1 : 3;
    sum += digits[i] * weight;
  }
  
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

// 7 Check DR (Digital Root based)
export function calculate7CheckDRChecksum(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  
  for (const digit of digits) {
    sum += digit;
  }
  
  // Digital root calculation
  let dr = sum;
  while (dr > 9) {
    dr = String(dr).split('').map(Number).reduce((a, b) => a + b, 0);
  }
  
  const check = (7 - (dr % 7)) % 7;
  return String(check);
}

// Modulo 16 Japan variant
export function calculateMod16JapanChecksum(input: string): string {
  const codabarChars = '0123456789-$:/.+ABCDTN*E';
  let sum = 0;
  
  for (const char of input.toUpperCase()) {
    const index = codabarChars.indexOf(char);
    if (index !== -1) {
      sum += index;
    }
  }
  
  const check = sum % 16;
  return codabarChars[check];
}

// EAN-13 checksum
export function calculateEAN13Checksum(input: string): number {
  const digits = input.replace(/\D/g, '').slice(0, 12).split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  
  return (10 - (sum % 10)) % 10;
}

// UPC-A checksum (Modulo 10)
export function calculateUPCChecksum(input: string): number {
  const digits = input.replace(/\D/g, '').slice(0, 11).split('').map(Number);
  let oddSum = 0;
  let evenSum = 0;
  
  for (let i = 0; i < 11; i++) {
    if (i % 2 === 0) {
      oddSum += digits[i];
    } else {
      evenSum += digits[i];
    }
  }
  
  const total = (oddSum * 3) + evenSum;
  return (10 - (total % 10)) % 10;
}

// Normalize input for JsBarcode: strip check digits so JsBarcode recalculates them
export function normalizeForRendering(text: string, format: BarcodeFormat): string {
  switch (format) {
    case 'EAN13':
      // JsBarcode EAN13 expects 12 digits (calculates check digit itself)
      if (/^\d{13}$/.test(text)) return text.slice(0, 12);
      return text;
    case 'EAN8':
      // JsBarcode EAN8 expects 7 digits
      if (/^\d{8}$/.test(text)) return text.slice(0, 7);
      return text;
    case 'UPC':
      // JsBarcode UPC expects 11 digits
      if (/^\d{12}$/.test(text)) return text.slice(0, 11);
      return text;
    case 'UPCE':
      // JsBarcode UPC-E expects 6 or 7 digits; 8 = includes check digit
      if (/^\d{8}$/.test(text)) return text.slice(0, 7);
      return text;
    case 'ITF14':
      // JsBarcode ITF14 expects 13 digits
      if (/^\d{14}$/.test(text)) return text.slice(0, 13);
      return text;
    default:
      return text;
  }
}

export function validateInput(text: string, format: BarcodeFormat): { valid: boolean; message: string } {
  if (!text.trim()) {
    return { valid: false, message: 'Please enter a value' };
  }

  switch (format) {
    case 'CODE39':
      if (!/^[A-Z0-9\-\.\s\$\/\+\%]+$/i.test(text)) {
        return { valid: false, message: 'CODE 39 only supports A-Z, 0-9, -, ., $, /, +, %, and space' };
      }
      break;
    case 'CODE93':
      break;
    case 'EAN13':
      if (!/^\d+$/.test(text)) {
        return { valid: false, message: 'EAN-13 only supports digits (0-9)' };
      }
      if (text.length !== 12 && text.length !== 13) {
        return { valid: false, message: 'EAN-13 requires exactly 12 or 13 digits' };
      }
      break;
    case 'EAN8':
      if (!/^\d+$/.test(text)) {
        return { valid: false, message: 'EAN-8 only supports digits (0-9)' };
      }
      if (text.length !== 7 && text.length !== 8) {
        return { valid: false, message: 'EAN-8 requires exactly 7 or 8 digits' };
      }
      break;
    case 'EAN5':
      if (!/^\d{5}$/.test(text)) {
        return { valid: false, message: 'EAN-5 requires exactly 5 digits' };
      }
      break;
    case 'EAN2':
      if (!/^\d{2}$/.test(text)) {
        return { valid: false, message: 'EAN-2 requires exactly 2 digits' };
      }
      break;
    case 'UPC':
      if (!/^\d+$/.test(text)) {
        return { valid: false, message: 'UPC-A only supports digits (0-9)' };
      }
      if (text.length !== 11 && text.length !== 12) {
        return { valid: false, message: 'UPC-A requires exactly 11 or 12 digits' };
      }
      break;
    case 'UPCE':
      if (!/^\d+$/.test(text)) {
        return { valid: false, message: 'UPC-E only supports digits (0-9)' };
      }
      if (text.length < 6 || text.length > 8) {
        return { valid: false, message: 'UPC-E requires 6, 7, or 8 digits' };
      }
      break;
    case 'ITF14':
      if (!/^\d+$/.test(text)) {
        return { valid: false, message: 'ITF-14 only supports digits (0-9)' };
      }
      if (text.length !== 13 && text.length !== 14) {
        return { valid: false, message: 'ITF-14 requires exactly 13 or 14 digits' };
      }
      break;
    case 'ITF':
      if (!/^\d+$/.test(text) || text.length % 2 !== 0) {
        return { valid: false, message: 'ITF requires an even number of digits' };
      }
      break;
    case 'pharmacode':
      const num = parseInt(text, 10);
      if (isNaN(num) || num < 3 || num > 131070) {
        return { valid: false, message: 'Pharmacode requires a number between 3 and 131070' };
      }
      break;
    case 'MSI':
    case 'MSI10':
    case 'MSI11':
    case 'MSI1010':
    case 'MSI1110':
      if (!/^\d+$/.test(text)) {
        return { valid: false, message: 'MSI formats only support digits' };
      }
      break;
    case 'qrcode':
    case 'azteccode':
    case 'datamatrix':
    case 'pdf417':
      break;
  }

  return { valid: true, message: '' };
}

export function getDefaultConfig(): BarcodeConfig {
  return {
    format: 'CODE39',
    text: 'BARCODE123',
    widthMils: 7.5,
    dpi: 300,
    height: 100,
    displayValue: true,
    fontSize: 16,
    lineColor: '#000000',
    background: '#FFFFFF',
    margin: 10,
    checksumType: 'none',
    quality: 'A',
     scale: 1,
  };
}
