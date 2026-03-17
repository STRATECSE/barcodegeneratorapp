import { useState, useCallback, useRef, KeyboardEvent, DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { analyzeBarcode, AnalysisResult, FormatMatch, ChecksumStatus } from '@/lib/barcodeAnalyzer';
import { scanBarcodeFromFile, ImageScanResult } from '@/lib/barcodeImageScanner';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  ScanLine,
  AlertCircle,
  ImageUp,
  Loader2,
  Type,
  RotateCcw,
} from 'lucide-react';

// ── Checksum status display config ───────────────────────────────────────────

const CHECKSUM_CONFIG: Record<ChecksumStatus, {
  icon: React.ReactNode;
  label: string;
  colorClass: string;
}> = {
  valid: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Valid',
    colorClass: 'text-emerald-500',
  },
  invalid: {
    icon: <XCircle className="h-4 w-4" />,
    label: 'Invalid',
    colorClass: 'text-red-500',
  },
  not_applicable: {
    icon: <MinusCircle className="h-4 w-4" />,
    label: 'N/A',
    colorClass: 'text-muted-foreground',
  },
  intrinsic: {
    icon: <ShieldCheck className="h-4 w-4" />,
    label: 'Intrinsic',
    colorClass: 'text-blue-400',
  },
};

const CONFIDENCE_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  high:   { label: 'High confidence',   variant: 'default' },
  medium: { label: 'Medium confidence', variant: 'secondary' },
  low:    { label: 'Low confidence',    variant: 'outline' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FormatCard({ match, isPrimary }: { match: FormatMatch; isPrimary: boolean }) {
  const cs = CHECKSUM_CONFIG[match.checksumStatus];
  const conf = CONFIDENCE_BADGE[match.confidence];

  return (
    <div
      className={`p-5 rounded-xl border transition-all ${
        isPrimary
          ? 'border-primary/50 bg-primary/5 shadow-md'
          : 'border-border/40 bg-card/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm font-mono tracking-wide">{match.label}</span>
            <Badge variant="outline" className="text-xs px-2 py-0 h-5">{match.category}</Badge>
            {isPrimary && (
              <Badge
                className="text-xs px-2 py-0 h-5 bg-primary/15 text-primary border-primary/40"
                variant="outline"
              >
                Best match
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{match.description}</p>
        </div>
        <Badge variant={conf.variant} className="text-xs shrink-0">
          {conf.label}
        </Badge>
      </div>

      <Separator className="mb-3 opacity-40" />

      <div className="flex items-start gap-2">
        <div className={`flex items-center gap-1.5 shrink-0 mt-px ${cs.colorClass}`}>
          {cs.icon}
          <span className="text-xs font-semibold">{cs.label}</span>
        </div>
        <span className="text-xs text-muted-foreground leading-relaxed">
          — {match.checksumNote}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-panel rounded-2xl shadow-xl p-10 flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <ScanLine className="h-7 w-7 text-primary/50" />
      </div>
      <h3 className="font-semibold text-base mb-2">Ready to Analyze</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        Type a barcode value in the <strong>Text</strong> tab, or upload a barcode image in the{' '}
        <strong>Image Scan</strong> tab. Checksums are validated automatically.
      </p>
    </div>
  );
}

interface NoMatchStateProps {
  input: string;
  imageScanMeta?: { formatLabel: string } | null;
}

function NoMatchState({ input, imageScanMeta }: NoMatchStateProps) {
  return (
    <div className="glass-panel rounded-2xl shadow-xl p-10 flex flex-col items-center text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="font-semibold text-base mb-2">No Format Matched</h3>
      {imageScanMeta ? (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          The scanner identified a <strong>{imageScanMeta.formatLabel}</strong> barcode with
          value{' '}
          <span className="font-mono text-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
            {input}
          </span>
          , but this format is not supported for checksum analysis in this tool.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          The value{' '}
          <span className="font-mono text-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
            {input}
          </span>{' '}
          doesn't match any known barcode format. Check for invalid characters or incorrect length.
        </p>
      )}
    </div>
  );
}

interface ResultsListProps {
  result: AnalysisResult;
  imageScanMeta?: { formatLabel: string } | null;
}

function ResultsList({ result, imageScanMeta }: ResultsListProps) {
  return (
    <div className="glass-panel rounded-2xl shadow-xl p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="font-semibold text-base">Analysis Results</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Value:{' '}
              <span className="font-mono text-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                {result.input}
              </span>
            </p>
            {imageScanMeta && (
              <Badge variant="secondary" className="text-xs gap-1.5 shrink-0">
                <ImageUp className="h-3 w-3" />
                Image scan · {imageScanMeta.formatLabel} detected
              </Badge>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {result.matches.length} format{result.matches.length !== 1 ? 's' : ''} matched
        </Badge>
      </div>

      <div className="space-y-3">
        {result.matches.map((match, index) => (
          <FormatCard key={match.format} match={match} isPrimary={index === 0} />
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-border/40">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Note:</strong> Multiple formats may match the same value. Confidence reflects
          how specific the format's constraints are. 2D formats (QR Code, Aztec, etc.) accept
          nearly any input and will always appear as low-confidence candidates.
        </p>
      </div>
    </div>
  );
}

// ── ImageScanner component ────────────────────────────────────────────────────

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

interface ImageScannerProps {
  onDecoded: (result: ImageScanResult) => void;
}

function ImageScanner({ onDecoded }: ImageScannerProps) {
  const [isDragOver, setIsDragOver]   = useState(false);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [scanState, setScanState]     = useState<ScanState>('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (PNG, JPG, WebP, etc.).');
      setScanState('error');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setScanState('scanning');
    setErrorMsg('');

    try {
      const scanResult = await scanBarcodeFromFile(file);
      setScanState('success');
      onDecoded(scanResult);
    } catch {
      setScanState('error');
      setErrorMsg('No barcode detected. Try a clearer or higher-resolution image.');
    }
  }, [onDecoded]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const reset = useCallback(() => {
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setScanState('idle');
    setErrorMsg('');
  }, []);

  // ── Drop zone (no image selected yet) ────────────────────────────────────
  if (!previewUrl) {
    return (
      <div>
        <div
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center text-center cursor-pointer transition-colors select-none ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border/50 hover:border-border hover:bg-secondary/20'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium mb-1">Drop a barcode image here</p>
          <p className="text-xs text-muted-foreground mb-3">or click to browse files</p>
          <p className="text-xs text-muted-foreground/50">PNG · JPG · WebP · BMP · GIF</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  // ── Preview + scan status ─────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Image preview */}
      <div className="relative rounded-xl overflow-hidden border border-border/40 bg-secondary/20">
        <img
          src={previewUrl}
          alt="Uploaded barcode"
          className="max-h-56 w-full object-contain"
        />
        {scanState === 'scanning' && (
          <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span className="text-sm font-medium">Scanning image…</span>
          </div>
        )}
      </div>

      {/* Status messages */}
      {scanState === 'success' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Barcode decoded successfully — results shown below
          </p>
        </div>
      )}

      {scanState === 'error' && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{errorMsg}</p>
        </div>
      )}

      {/* Action button */}
      <Button
        variant="outline"
        size="sm"
        onClick={reset}
        className="gap-1.5 text-xs h-8"
      >
        <RotateCcw className="h-3 w-3" />
        {scanState === 'error' ? 'Try a different image' : 'Change image'}
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const Analyzer = () => {
  const [textValue, setTextValue]         = useState('');
  const [result, setResult]               = useState<AnalysisResult | null>(null);
  const [hasAnalyzed, setHasAnalyzed]     = useState(false);
  const [imageScanMeta, setImageScanMeta] = useState<{ formatLabel: string } | null>(null);

  const runAnalysis = useCallback((value: string, meta?: { formatLabel: string }) => {
    setResult(analyzeBarcode(value));
    setHasAnalyzed(true);
    setImageScanMeta(meta ?? null);
  }, []);

  const handleTextAnalyze = useCallback(() => {
    if (!textValue.trim()) return;
    runAnalysis(textValue);
  }, [textValue, runAnalysis]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleTextAnalyze();
    },
    [handleTextAnalyze],
  );

  const handleImageDecoded = useCallback((scanResult: ImageScanResult) => {
    setTextValue(scanResult.decodedText);
    runAnalysis(scanResult.decodedText, { formatLabel: scanResult.formatLabel });
  }, [runAnalysis]);

  const handleClear = useCallback(() => {
    setTextValue('');
    setResult(null);
    setHasAnalyzed(false);
    setImageScanMeta(null);
  }, []);

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        {/* Back navigation */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Generator
          </Link>
        </div>

        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScanLine className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Barcode Analyzer</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Type a value or upload a barcode image — formats are detected and checksums
            validated automatically.
          </p>
        </div>

        {/* Input section */}
        <div className="glass-panel rounded-2xl shadow-xl p-6 mb-6">
          <Tabs defaultValue="text">
            <TabsList className="grid grid-cols-2 w-full mb-5 p-1 bg-secondary/60 rounded-xl h-auto gap-1">
              <TabsTrigger
                value="text"
                className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow data-[state=active]:text-primary transition-all"
              >
                <Type className="h-4 w-4" />
                <span className="font-medium">Text Input</span>
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow data-[state=active]:text-primary transition-all"
              >
                <ImageUp className="h-4 w-4" />
                <span className="font-medium">Image Scan</span>
              </TabsTrigger>
            </TabsList>

            {/* Text tab */}
            <TabsContent value="text" className="mt-0">
              <label className="block text-sm font-medium mb-3 text-foreground/80">
                Barcode Value
              </label>
              <div className="flex gap-3">
                <Input
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. 5901234123457  ·  HELLO-123  ·  A12345B"
                  className="flex-1 font-mono bg-secondary/50 border-border/60 focus-visible:ring-primary/50 h-11"
                />
                <Button
                  onClick={handleTextAnalyze}
                  disabled={!textValue.trim()}
                  className="h-11 px-5 gap-2 font-medium"
                >
                  <Search className="h-4 w-4" />
                  Analyze
                </Button>
                {hasAnalyzed && (
                  <Button variant="outline" onClick={handleClear} className="h-11 px-4">
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press{' '}
                <kbd className="px-1 py-0.5 rounded bg-secondary/60 font-mono text-xs">Enter</kbd>{' '}
                to analyze · All formats and checksum types detected automatically
              </p>
            </TabsContent>

            {/* Image tab */}
            <TabsContent value="image" className="mt-0">
              <p className="text-sm font-medium mb-3 text-foreground/80">Barcode Image</p>
              <ImageScanner onDecoded={handleImageDecoded} />
              <p className="text-xs text-muted-foreground mt-3">
                Supports 1D and 2D barcodes · PNG, JPG, WebP, BMP, GIF
              </p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Results area */}
        {hasAnalyzed && result ? (
          result.matches.length === 0 ? (
            <NoMatchState input={result.input} imageScanMeta={imageScanMeta} />
          ) : (
            <ResultsList result={result} imageScanMeta={imageScanMeta} />
          )
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
};

export default Analyzer;
