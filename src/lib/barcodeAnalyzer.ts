// Barcode analysis logic — independent of all existing features.
// Detects compatible formats and validates checksums from a raw barcode value.

import {
  BarcodeFormat,
  BARCODE_FORMATS,
  validateInput,
  calculateEAN13Checksum,
  calculateUPCChecksum,
  calculateMod10,
  calculateMod11,
  calculateMod43Checksum,
  calculateMod16Checksum,
} from './barcodeUtils';

export type ChecksumStatus = 'valid' | 'invalid' | 'not_applicable' | 'intrinsic';

export interface FormatMatch {
  format: BarcodeFormat;
  label: string;
  description: string;
  category: '1D' | '2D';
  checksumStatus: ChecksumStatus;
  checksumLabel: string;
  checksumNote: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  input: string;
  matches: FormatMatch[];
  primaryMatch: FormatMatch | null;
}

// EAN-8 check digit uses weights 3,1,3,1,3,1,3 (opposite of EAN-13)
function calculateEAN8Checksum(input: string): number {
  const digits = input.slice(0, 7).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

type ChecksumEval = { status: ChecksumStatus; label: string; note: string };

function evaluateChecksum(input: string, format: BarcodeFormat): ChecksumEval {
  const upper = input.toUpperCase();

  switch (format) {
    case 'EAN13': {
      if (input.length === 13) {
        const expected = calculateEAN13Checksum(input.slice(0, 12));
        const actual = parseInt(input[12], 10);
        return expected === actual
          ? { status: 'valid', label: 'EAN-13', note: `Check digit ${actual} is correct` }
          : { status: 'invalid', label: 'EAN-13', note: `Check digit should be ${expected}, got ${actual}` };
      }
      return { status: 'not_applicable', label: '—', note: '12-digit input has no check digit to validate' };
    }

    case 'EAN8': {
      if (input.length === 8) {
        const expected = calculateEAN8Checksum(input.slice(0, 7));
        const actual = parseInt(input[7], 10);
        return expected === actual
          ? { status: 'valid', label: 'EAN-8', note: `Check digit ${actual} is correct` }
          : { status: 'invalid', label: 'EAN-8', note: `Check digit should be ${expected}, got ${actual}` };
      }
      return { status: 'not_applicable', label: '—', note: '7-digit input has no check digit to validate' };
    }

    case 'UPC': {
      if (input.length === 12) {
        const expected = calculateUPCChecksum(input.slice(0, 11));
        const actual = parseInt(input[11], 10);
        return expected === actual
          ? { status: 'valid', label: 'UPC-A', note: `Check digit ${actual} is correct` }
          : { status: 'invalid', label: 'UPC-A', note: `Check digit should be ${expected}, got ${actual}` };
      }
      return { status: 'not_applicable', label: '—', note: '11-digit input has no check digit to validate' };
    }

    case 'UPCE': {
      if (input.length >= 7) {
        return { status: 'intrinsic', label: 'UPC-E', note: 'Requires full UPC-A expansion to validate; verified by scanner' };
      }
      return { status: 'not_applicable', label: '—', note: 'Short form has no standalone check digit' };
    }

    case 'ITF14': {
      if (input.length === 14) {
        const expected = calculateMod10(input.slice(0, 13));
        const actual = parseInt(input[13], 10);
        return expected === actual
          ? { status: 'valid', label: 'Mod 10', note: `Check digit ${actual} is correct` }
          : { status: 'invalid', label: 'Mod 10', note: `Check digit should be ${expected}, got ${actual}` };
      }
      return { status: 'not_applicable', label: '—', note: '13-digit input has no check digit to validate' };
    }

    case 'CODE128':
      return { status: 'intrinsic', label: 'Code 128', note: 'Check character is encoding-level; verified automatically by scanner' };

    case 'CODE93':
      return { status: 'intrinsic', label: 'Code 93', note: 'Dual check characters are encoding-level; verified automatically by scanner' };

    case 'MSI10':
      return { status: 'intrinsic', label: 'Mod 10', note: 'Check digit is appended automatically during barcode rendering' };

    case 'MSI11':
      return { status: 'intrinsic', label: 'Mod 11', note: 'Check digit is appended automatically during barcode rendering' };

    case 'MSI1010':
      return { status: 'intrinsic', label: 'Double Mod 10', note: 'Two check digits are appended automatically during barcode rendering' };

    case 'MSI1110':
      return { status: 'intrinsic', label: 'Mod 11 + Mod 10', note: 'Dual check digits are appended automatically during barcode rendering' };

    case 'CODE39': {
      // Mod 43 is optional: try to detect a valid check character at the end
      if (upper.length >= 2) {
        const expected = calculateMod43Checksum(upper.slice(0, -1));
        if (expected === upper[upper.length - 1]) {
          return { status: 'valid', label: 'Mod 43', note: `Last character '${upper[upper.length - 1]}' is a valid Mod 43 check` };
        }
      }
      return { status: 'not_applicable', label: '—', note: 'Mod 43 is optional for CODE 39; no valid check character detected' };
    }

    case 'codabar': {
      // Mod 16 is the most common Codabar checksum — try to detect it
      if (input.length >= 2) {
        const expected = calculateMod16Checksum(input.slice(0, -1));
        if (expected === input[input.length - 1]) {
          return { status: 'valid', label: 'Mod 16', note: `Last character is a valid Mod 16 check` };
        }
      }
      return { status: 'not_applicable', label: '—', note: 'Checksum is optional for Codabar; no valid check character detected' };
    }

    case 'MSI': {
      // Both Mod 10 and Mod 11 are optional — try to detect either
      if (input.length >= 2) {
        const body = input.slice(0, -1);
        const lastChar = input[input.length - 1];
        const expectedMod10 = calculateMod10(body);
        if (expectedMod10 === parseInt(lastChar, 10)) {
          return { status: 'valid', label: 'Mod 10', note: `Last digit is a valid Mod 10 check` };
        }
        const expectedMod11 = calculateMod11(body);
        const checkMod11 = expectedMod11 === 10 ? 'X' : String(expectedMod11);
        if (checkMod11 === lastChar.toUpperCase()) {
          return { status: 'valid', label: 'Mod 11', note: `Last character is a valid Mod 11 check` };
        }
      }
      return { status: 'not_applicable', label: '—', note: 'Checksum is optional for MSI; none detected' };
    }

    case 'ITF': {
      // Mod 10 is optional for ITF — try to detect it
      if (input.length >= 2) {
        const expected = calculateMod10(input.slice(0, -1));
        const actual = parseInt(input[input.length - 1], 10);
        if (expected === actual) {
          return { status: 'valid', label: 'Mod 10', note: `Last digit ${actual} is a valid Mod 10 check` };
        }
      }
      return { status: 'not_applicable', label: '—', note: 'Mod 10 is optional for ITF; none detected' };
    }

    case 'EAN5':
    case 'EAN2':
      return { status: 'not_applicable', label: '—', note: 'Supplemental add-on code; no standalone checksum' };

    case 'pharmacode':
      return { status: 'not_applicable', label: '—', note: 'Pharmacode uses binary encoding; no separate check digit' };

    case 'qrcode':
    case 'azteccode':
    case 'datamatrix':
    case 'pdf417':
      return { status: 'intrinsic', label: 'Reed-Solomon', note: 'Error correction is embedded in the 2D symbol; verified by scanner' };

    default:
      return { status: 'not_applicable', label: '—', note: '' };
  }
}

function getConfidence(input: string, format: BarcodeFormat): 'high' | 'medium' | 'low' {
  const isNumeric = /^\d+$/.test(input);

  switch (format) {
    case 'EAN13':
      return (input.length === 12 || input.length === 13) && isNumeric ? 'high' : 'medium';
    case 'EAN8':
      return (input.length === 7 || input.length === 8) && isNumeric ? 'high' : 'medium';
    case 'EAN5':
      return input.length === 5 && isNumeric ? 'high' : 'medium';
    case 'EAN2':
      return input.length === 2 && isNumeric ? 'high' : 'medium';
    case 'UPC':
      return (input.length === 11 || input.length === 12) && isNumeric ? 'high' : 'medium';
    case 'UPCE':
      return input.length >= 6 && input.length <= 8 && isNumeric ? 'high' : 'medium';
    case 'ITF14':
      return (input.length === 13 || input.length === 14) && isNumeric ? 'high' : 'medium';
    case 'pharmacode': {
      const num = parseInt(input, 10);
      return isNumeric && num >= 3 && num <= 131070 ? 'high' : 'low';
    }
    case 'CODE39':
      return /^[A-Z0-9\-\.\s\$\/\+\%]+$/.test(input.toUpperCase()) ? 'medium' : 'low';
    case 'codabar':
      return /^[0-9\-\$\:\/\.\+]+$/.test(input) ? 'medium' : 'low';
    case 'ITF':
    case 'MSI':
    case 'MSI10':
    case 'MSI11':
    case 'MSI1010':
    case 'MSI1110':
      return isNumeric ? 'medium' : 'low';
    case 'CODE93':
    case 'CODE128':
    case 'qrcode':
    case 'azteccode':
    case 'datamatrix':
    case 'pdf417':
      return 'low';
    default:
      return 'low';
  }
}

export function analyzeBarcode(input: string): AnalysisResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { input: trimmed, matches: [], primaryMatch: null };
  }

  const matches: FormatMatch[] = [];

  for (const formatDef of BARCODE_FORMATS) {
    const validation = validateInput(trimmed, formatDef.value);
    if (!validation.valid) continue;

    const checksumResult = evaluateChecksum(trimmed, formatDef.value);
    const confidence = getConfidence(trimmed, formatDef.value);

    matches.push({
      format: formatDef.value,
      label: formatDef.label,
      description: formatDef.description,
      category: formatDef.category,
      checksumStatus: checksumResult.status,
      checksumLabel: checksumResult.label,
      checksumNote: checksumResult.note,
      confidence,
    });
  }

  // Sort: high confidence first, then medium, then low. Within equal confidence, 1D before 2D.
  const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const categoryOrder: Record<string, number> = { '1D': 0, '2D': 1 };
  matches.sort((a, b) => {
    if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    }
    return categoryOrder[a.category] - categoryOrder[b.category];
  });

  return {
    input: trimmed,
    matches,
    primaryMatch: matches.length > 0 ? matches[0] : null,
  };
}
