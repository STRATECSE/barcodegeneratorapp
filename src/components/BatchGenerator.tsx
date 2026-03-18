import { useState, useEffect, useRef } from 'react';
import { BarcodeFormat, BARCODE_FORMATS, validateInput } from '@/lib/barcodeUtils';
import { generateBarcodeImage, generateBarcodeBlob, BarcodeImageResult } from '@/lib/barcodeImageGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Shuffle, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

const SCALE_PRESETS = [
  { label: 'Small', value: 0.5 },
  { label: 'Medium', value: 1 },
  { label: 'Large', value: 2 },
];

export interface BatchActions {
  downloadAsZip: () => Promise<void>;
  exportAsPDF: () => Promise<void>;
  isDisabled: boolean;
  isGenerating: boolean;
}

interface BatchGeneratorProps {
  onImagesGenerated?: (images: BarcodeImageResult[]) => void;
  onActionsReady?: (actions: BatchActions) => void;
}

export function BatchGenerator({ onImagesGenerated, onActionsReady }: BatchGeneratorProps) {
  const [format, setFormat] = useState<BarcodeFormat>('CODE39');
  const [values, setValues] = useState('');
  const [count, setCount] = useState(10);
  const [stringLength, setStringLength] = useState(8);
  const [scale, setScale] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-preview: generate images whenever values, format, or scale change
  useEffect(() => {
    const valueList = values.split('\n').map(v => v.trim()).filter(v => v);
    if (valueList.length === 0) {
      onImagesGenerated?.([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const images: BarcodeImageResult[] = [];
        for (const val of valueList) {
          const result = await generateBarcodeImage(val, format, scale);
          if (result) images.push(result);
        }
        onImagesGenerated?.(images);
      } catch (error) {
        console.error('Auto-preview error:', error);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [values, format, scale, onImagesGenerated]);

  const generateRandomString = (length: number, numeric: boolean = false): string => {
    const chars = numeric
      ? '0123456789'
      : '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateRandomValues = () => {
    const isNumericOnly = ['EAN13', 'EAN8', 'UPC', 'ITF14', 'ITF', 'CODE128C', 'MSI', 'MSI10', 'MSI11', 'pharmacode'].includes(format);

    let length = stringLength;
    if (format === 'EAN13') length = 12;
    if (format === 'EAN8') length = 7;
    if (format === 'UPC') length = 11;
    if (format === 'ITF14') length = 13;
    if (format === 'ITF' && length % 2 !== 0) length = Math.max(2, length - 1);

    const randomValues: string[] = [];
    for (let i = 0; i < count; i++) {
      randomValues.push(generateRandomString(length, isNumericOnly));
    }
    setValues(randomValues.join('\n'));
    toast.success(`Generated ${count} random values`);
  };

  const getValueList = () => values.split('\n').map(v => v.trim()).filter(v => v);

  const downloadAsZip = async () => {
    const valueList = getValueList();
    if (valueList.length === 0) { toast.error('Please enter at least one value'); return; }

    setIsGenerating(true);
    setProgress(0);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('barcodes');

      for (let i = 0; i < valueList.length; i++) {
        const blob = await generateBarcodeBlob(valueList[i], format, scale, 0);
        if (blob && folder) {
          folder.file(`${valueList[i]}.png`, blob);
        }
        setProgress(((i + 1) / valueList.length) * 100);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `barcodes-${format}-${Date.now()}.zip`;
      link.click();
      toast.success(`Downloaded ${valueList.length} barcodes`);
    } catch (error) {
      console.error('Batch generation error:', error);
      toast.error('Failed to generate barcodes');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const exportAsPDF = async () => {
    const valueList = getValueList();
    if (valueList.length === 0) { toast.error('Please enter at least one value'); return; }

    setIsGenerating(true);
    setProgress(0);

    try {
      const { jsPDF } = await import('jspdf');
      const images: { dataUrl: string; width: number; height: number; value: string }[] = [];

      for (let i = 0; i < valueList.length; i++) {
        const result = await generateBarcodeImage(valueList[i], format, scale, 0);
        if (result) images.push(result);
        setProgress(((i + 1) / valueList.length) * 100);
      }

      if (images.length === 0) { toast.error('No valid barcodes generated'); return; }

      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageW = 210, pageH = 297, margin = 15, gap = 10, rowGap = 8;
      const usableW = pageW - margin * 2;

      const pxToMm = 25.4 / 96;
      const imgWmm = images[0].width * pxToMm;
      const imgHmm = images[0].height * pxToMm;
      const labelH = 5;

      const cols = Math.max(1, Math.floor((usableW + gap) / (imgWmm + gap)));
      const cellW = (usableW - (cols - 1) * gap) / cols;
      const scaleRatio = cellW / imgWmm;
      const cellH = imgHmm * scaleRatio + labelH;

      let x = margin, y = margin;

      images.forEach((img, i) => {
        if (y + cellH > pageH - margin) {
          pdf.addPage();
          y = margin;
        }

        const col = i % cols;
        x = margin + col * (cellW + gap);

        pdf.addImage(img.dataUrl, 'PNG', x, y, cellW, imgHmm * scaleRatio);
        pdf.setFontSize(8);
        pdf.setFont('courier');
        pdf.text(img.value, x + cellW / 2, y + imgHmm * scaleRatio + 4, { align: 'center' });

        if (col === cols - 1) {
          y += cellH + rowGap;
        }
      });

      const today = new Date().toISOString().split('T')[0];
      pdf.save(`batch_barcodes_${today}.pdf`);
      toast.success(`PDF saved with ${images.length} barcodes`);
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const isDisabled = isGenerating || !values.trim();

  // Expose action functions to parent
  useEffect(() => {
    onActionsReady?.({ downloadAsZip, exportAsPDF, isDisabled, isGenerating });
  }, [isDisabled, isGenerating, values, format, scale]);

  return (
    <div className="space-y-6">
      {/* Format Selection */}
      <div className="space-y-2">
        <Label>Barcode Format</Label>
        <Select value={format} onValueChange={(v) => setFormat(v as BarcodeFormat)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover max-h-[300px]">
            {BARCODE_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Output Size */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
          <Label>Output Size</Label>
        </div>
        <div className="flex gap-2">
          {SCALE_PRESETS.map((p) => (
            <Button
              key={p.label}
              variant={scale === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScale(p.value)}
              className="flex-1"
            >
              {p.label} {p.value}x
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <Slider
            min={0.25}
            max={4}
            step={0.25}
            value={[scale]}
            onValueChange={([v]) => setScale(v)}
          />
          <p className="text-xs text-muted-foreground text-center">Custom: {scale}x</p>
        </div>
      </div>

      {/* Random Generation Controls */}
      <div className="p-4 bg-secondary/50 rounded-lg space-y-4">
        <p className="text-sm font-mono text-foreground">Random Generator</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Count</Label>
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
              min={1}
              max={1000}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">String Length</Label>
            <Input
              type="number"
              value={stringLength}
              onChange={(e) => setStringLength(Math.max(1, Math.min(100, parseInt(e.target.value) || 8)))}
              min={1}
              max={100}
              className="font-mono"
            />
          </div>
        </div>

        <Button onClick={generateRandomValues} variant="outline" className="w-full gap-2">
          <Shuffle className="h-4 w-4" />
          Generate {count} Random Values
        </Button>
      </div>

      {/* Values Input */}
      <div className="space-y-2">
        <Label>Values (one per line)</Label>
        <Textarea
          value={values}
          onChange={(e) => setValues(e.target.value)}
          placeholder="Enter barcode values, one per line..."
          className="min-h-[150px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {values.split('\n').filter(v => v.trim()).length} values entered
        </p>
      </div>

      {/* Progress */}
      {isGenerating && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">
            Generating... {Math.round(progress)}%
          </p>
        </div>
      )}

    </div>
  );
}
