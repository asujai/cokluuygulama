import { SrtCue } from './types';

export function msToSrtTime(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(safeMs / (1000 * 60 * 60));
  const minutes = Math.floor((safeMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((safeMs % (1000 * 60)) / 1000);
  const millis = safeMs % 1000;

  const padHH = hours.toString().padStart(2, '0');
  const padMM = minutes.toString().padStart(2, '0');
  const padSS = seconds.toString().padStart(2, '0');
  const padMMM = millis.toString().padStart(3, '0');

  return `${padHH}:${padMM}:${padSS},${padMMM}`;
}

export function srtTimeToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const cleanStr = timeStr.trim().replace('.', ',');
  const parts = cleanStr.split('-->');
  const targetStr = parts[0].trim();

  const match = targetStr.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  let millis = parseInt(match[4] || '0', 10);

  if (match[4].length === 1) millis *= 100;
  else if (match[4].length === 2) millis *= 10;

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
}

export function parseSrt(rawText: string): SrtCue[] {
  if (!rawText) return [];

  // Strip BOM and normalize line endings
  const clean = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = clean.split(/\n\s*\n/);

  const cues: SrtCue[] = [];
  let currentCueIndex = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    let arrowLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        arrowLineIndex = i;
        break;
      }
    }

    if (arrowLineIndex === -1) continue;

    const timeParts = lines[arrowLineIndex].split('-->');
    if (timeParts.length < 2) continue;

    const startMs = srtTimeToMs(timeParts[0]);
    const endMs = srtTimeToMs(timeParts[1]);

    const textLines = lines.slice(arrowLineIndex + 1);
    const text = textLines.join('\n');

    cues.push({
      id: `cue-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      index: currentCueIndex++,
      startMs,
      endMs: Math.max(startMs + 100, endMs),
      text,
    });
  }

  // Sort sequentially by start time and reindex
  cues.sort((a, b) => a.startMs - b.startMs);
  return cues.map((c, i) => ({ ...c, index: i + 1 }));
}

export function serializeSrt(cues: SrtCue[]): string {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);

  return sorted
    .map((cue, idx) => {
      const seq = idx + 1;
      const startStr = msToSrtTime(cue.startMs);
      const endStr = msToSrtTime(cue.endMs);
      return `${seq}\n${startStr} --> ${endStr}\n${cue.text}`;
    })
    .join('\n\n');
}

export function shiftCues(cues: SrtCue[], shiftSeconds: number, fromCueIndex: number = 1): SrtCue[] {
  const shiftMs = Math.round(shiftSeconds * 1000);

  return cues.map((cue) => {
    if (cue.index < fromCueIndex) return cue;

    const duration = Math.max(200, cue.endMs - cue.startMs);
    const newStart = Math.max(0, cue.startMs + shiftMs);
    const newEnd = Math.max(newStart + 200, cue.endMs + shiftMs);

    return {
      ...cue,
      startMs: newStart,
      endMs: newEnd,
    };
  });
}

export const SAMPLE_SRT_TEXT = `1
00:00:01,000 --> 00:00:03,500
Merhaba! Gundelik Altyazı Düzenleyicisine hoş geldiniz.

2
00:00:04,000 --> 00:00:07,200
Bu araç ile SRT altyazı dosyalarınızı kolayca düzenleyebilirsiniz.

3
00:00:08,000 --> 00:00:11,500
Zaman kaydırma (+/- saniye), yeni kare ekleme ve dışa aktarma özelliklerini kullanabilirsiniz.`;
