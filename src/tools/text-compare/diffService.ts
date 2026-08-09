import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { DiffLine, DiffOptions, DiffSummary, DiffWord } from './types';

export function computeWordDiff(
  strA: string,
  strB: string,
  options: DiffOptions
): DiffWord[] {
  const wordsA = strA.split(/(\s+)/);
  const wordsB = strB.split(/(\s+)/);

  const normalize = (s: string) => (options.ignoreCase ? s.toLowerCase() : s);

  const m = wordsA.length;
  const n = wordsB.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalize(wordsA[i - 1]) === normalize(wordsB[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const result: DiffWord[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(wordsA[i - 1]) === normalize(wordsB[j - 1])) {
      result.push({ type: 'unchanged', value: wordsA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', value: wordsB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.push({ type: 'deleted', value: wordsA[i - 1] });
      i--;
    }
  }

  return result.reverse();
}

export function computeDiff(
  textA: string,
  textB: string,
  options: DiffOptions
): { lines: DiffLine[]; summary: DiffSummary } {
  let linesA = textA.split(/\r?\n/);
  let linesB = textB.split(/\r?\n/);

  if (options.ignoreEmptyLines) {
    linesA = linesA.filter((l) => l.trim().length > 0);
    linesB = linesB.filter((l) => l.trim().length > 0);
  }

  const normalize = (s: string) => {
    let res = s;
    if (options.ignoreWhitespace) res = res.trim().replace(/\s+/g, ' ');
    if (options.ignoreCase) res = res.toLowerCase();
    return res;
  };

  const m = linesA.length;
  const n = linesB.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalize(linesA[i - 1]) === normalize(linesB[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const rawDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(linesA[i - 1]) === normalize(linesB[j - 1])) {
      rawDiff.push({
        type: 'unchanged',
        lineA: i,
        lineB: j,
        textA: linesA[i - 1],
        textB: linesB[j - 1],
        text: linesA[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({
        type: 'added',
        lineB: j,
        textB: linesB[j - 1],
        text: linesB[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({
        type: 'deleted',
        lineA: i,
        textA: linesA[i - 1],
        text: linesA[i - 1],
      });
      i--;
    }
  }

  rawDiff.reverse();

  // Combine consecutive deleted + added into 'modified'
  const lines: DiffLine[] = [];
  let k = 0;
  let addedCount = 0;
  let deletedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  while (k < rawDiff.length) {
    if (
      rawDiff[k].type === 'deleted' &&
      k + 1 < rawDiff.length &&
      rawDiff[k + 1].type === 'added'
    ) {
      const del = rawDiff[k];
      const add = rawDiff[k + 1];
      const wordDiff = computeWordDiff(del.textA || '', add.textB || '', options);

      lines.push({
        type: 'modified',
        lineA: del.lineA,
        lineB: add.lineB,
        textA: del.textA,
        textB: add.textB,
        words: wordDiff,
      });
      modifiedCount++;
      k += 2;
    } else {
      if (rawDiff[k].type === 'added') addedCount++;
      else if (rawDiff[k].type === 'deleted') deletedCount++;
      else if (rawDiff[k].type === 'unchanged') unchangedCount++;
      lines.push(rawDiff[k]);
      k++;
    }
  }

  const totalMatches = dp[m][n];
  const maxLines = Math.max(m, n);
  const similarityRatio = maxLines === 0 ? 100 : Math.round((totalMatches / maxLines) * 100);

  const summary: DiffSummary = {
    addedLines: addedCount,
    deletedLines: deletedCount,
    modifiedLines: modifiedCount,
    unchangedLines: unchangedCount,
    totalLinesA: m,
    totalLinesB: n,
    similarityRatio,
  };

  return { lines, summary };
}

export function generateReportText(
  lines: DiffLine[],
  summary: DiffSummary,
  options: DiffOptions
): string {
  const timestamp = new Date().toLocaleString('tr-TR');
  let report = `==================================================\n`;
  report += ` METİN KARŞILAŞTIRMA VE FARK RAPORU\n`;
  report += ` Oluşturulma Tarihi: ${timestamp}\n`;
  report += ` Benzerlik Oranı: %${summary.similarityRatio}\n`;
  report += `==================================================\n\n`;

  report += `[ÖZET BİLGİLER]\n`;
  report += `- Orijinal Metin Satırı (A): ${summary.totalLinesA}\n`;
  report += `- Karşılaştırılan Satır (B): ${summary.totalLinesB}\n`;
  report += `- Eklenen Satırlar (+): ${summary.addedLines}\n`;
  report += `- Silinen Satırlar (-): ${summary.deletedLines}\n`;
  report += `- Değiştirilen Satırlar (~): ${summary.modifiedLines}\n`;
  report += `- Değişmeyen Satırlar (=): ${summary.unchangedLines}\n\n`;

  report += `[AYRINTILI FARKLAR]\n`;
  lines.forEach((line) => {
    if (line.type === 'added') {
      report += `+ [B:${line.lineB}] ${line.textB}\n`;
    } else if (line.type === 'deleted') {
      report += `- [A:${line.lineA}] ${line.textA}\n`;
    } else if (line.type === 'modified') {
      report += `~ [A:${line.lineA} -> B:${line.lineB}]\n`;
      report += `  - ESKİ: ${line.textA}\n`;
      report += `  + YENİ: ${line.textB}\n`;
    } else {
      report += `  [${line.lineA}:${line.lineB}] ${line.text}\n`;
    }
  });

  return report;
}

export async function exportReportToFile(reportContent: string): Promise<string> {
  const fileName = `metin_karsilastirma_raporu_${Date.now()}.txt`;
  if (Platform.OS === 'web') {
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return 'browser_download';
  } else {
    const baseDir = FileSystem.Paths?.cache?.uri || FileSystem.Paths?.document?.uri || '';
    const fileUri = `${baseDir.endsWith('/') ? baseDir : `${baseDir}/`}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, reportContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    }
    return fileUri;
  }
}
