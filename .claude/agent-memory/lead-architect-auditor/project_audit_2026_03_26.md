---
name: Registry & Validation Audit 2026-03-26
description: Focused audit of registry consistency, checksum pipeline, and validation system — 0 blockers, 7 debt, 2 test gaps. All 4 previous blockers resolved.
type: project
---

Registry and validation system audit completed 2026-03-26. STATUS: APPROVED (0 blockers).

All 4 blockers from 2026-03-24 audit are resolved:
1. Switch statements replaced with Record<> registries (confirmed)
2. XSS in electron/main.js fixed via JSON.stringify for data URL injection (confirmed)
3. Race condition in auto-certify fixed with generation counter pattern (confirmed)
4. Canvas memory leak fixed — canvas.width=0 cleanup after extraction (confirmed)

**Current Debt (7):**
1. MSI1010 and MSI1110 still missing from BARCODE_FORMATS metadata array (persists from 2024-03-24)
2. Magic number 7.5 in BarcodePreview.tsx certificate display (persists from 2024-03-24)
3. CHECKSUM_APPLIER_REGISTRY typed as Record<string> instead of Record<ChecksumType>
4. codabar missing from VALIDATION_REGISTRY — accepts any input characters
5. BatchGenerator.tsx onActionsReady useEffect incomplete dependency array (persists from 2024-03-24)
6. BarcodePreview.tsx remains a God Object (~790 lines, 7+ concerns) (persists from 2024-03-24)
7. certify() applies normalizeForRendering before applyChecksum — produces misleading not_applicable status for full-length EAN/UPC inputs (not grade-breaking)

**Test Gaps (2):**
1. validationService.ts certify()/roundTrip() — zero direct unit tests (persists)
2. validationRunner.ts runValidationSuite() — zero coverage (new finding)

**Registry Consistency:** All 22 BarcodeFormat values have at least one validation path. No orphaned entries. MSI1010/MSI1110 are phantom formats (registered but unreachable from UI). ean13/upc ChecksumTypes are intentionally asymmetric (in APPLIER but not OPTIONAL registry — programmatic use only).

**Why:** This audit validates that the registry refactoring from sprint 2026-03-24 was successful and identifies remaining debt items for prioritization.

**How to apply:** Reference when reviewing PRs touching barcodeUtils.ts, validationService.ts, or BarcodePreview.tsx. The 3 persistent debt items (MSI formats, magic number, God Object) should be prioritized for resolution.
