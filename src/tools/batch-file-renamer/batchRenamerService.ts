import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BatchRenameResult, FileItem, RenameConfig } from './types';

export function splitFilename(filename: string): { baseName: string; extension: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) {
    return { baseName: filename, extension: '' };
  }
  return {
    baseName: filename.substring(0, lastDot),
    extension: filename.substring(lastDot),
  };
}

function padNumber(num: number, padding: number): string {
  let str = String(num);
  while (str.length < padding) {
    str = '0' + str;
  }
  return str;
}

function applyCasing(str: string, option: string): string {
  if (option === 'lowercase') return str.toLowerCase();
  if (option === 'uppercase') return str.toUpperCase();
  if (option === 'titlecase') {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }
  return str;
}

export function computeNewName(
  originalName: string,
  index: number,
  config: RenameConfig
): string {
  const { baseName: origBase, extension: origExt } = splitFilename(originalName);

  let ext = origExt;
  if (config.extensionCasing === 'lowercase') ext = ext.toLowerCase();
  if (config.extensionCasing === 'uppercase') ext = ext.toUpperCase();

  let newBase = origBase;

  if (config.mode === 'find_replace') {
    if (config.findText) {
      newBase = origBase.split(config.findText).join(config.replaceText);
    }
  } else if (config.mode === 'casing') {
    newBase = applyCasing(origBase, config.casing);
  } else {
    // Mode: pattern
    if (config.baseName.trim().length > 0) {
      newBase = config.baseName.trim();
    }

    if (config.useNumbering) {
      const numStr = padNumber(config.startNumber + index, config.numberPadding);
      if (config.numberPosition === 'prefix') {
        newBase = `${numStr}_${newBase}`;
      } else if (config.numberPosition === 'suffix') {
        newBase = `${newBase}_${numStr}`;
      } else if (config.numberPosition === 'replace') {
        newBase = numStr;
      }
    }

    if (config.prefix) {
      newBase = `${config.prefix}${newBase}`;
    }
    if (config.suffix) {
      newBase = `${newBase}${config.suffix}`;
    }
  }

  return `${newBase}${ext}`;
}

export async function executeBatchRename(
  files: FileItem[],
  config: RenameConfig
): Promise<BatchRenameResult> {
  const renamedFiles: { originalName: string; newName: string; uri: string }[] = [];
  let successCount = 0;
  let failureCount = 0;

  const batLines: string[] = ['@echo off', 'echo Renaming files...'];
  const shLines: string[] = ['#!/bin/bash', 'echo "Renaming files..."'];

  const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const newName = computeNewName(file.originalName, i, config);

    batLines.push(`ren "${file.originalName}" "${newName}"`);
    shLines.push(`mv "${file.originalName}" "${newName}"`);

    let newUri = file.uri;

    if (Platform.OS !== 'web' && docDir) {
      try {
        const destUri = `${docDir}${Date.now()}_${newName}`;
        if (typeof FileSystem.copyAsync === 'function') {
          await FileSystem.copyAsync({ from: file.uri, to: destUri });
          newUri = destUri;
          successCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.warn(`Could not copy file ${file.originalName} locally:`, err);
        failureCount++;
      }
    } else {
      successCount++;
    }

    renamedFiles.push({
      originalName: file.originalName,
      newName,
      uri: newUri,
    });
  }

  batLines.push('echo Done!');
  shLines.push('echo "Done!"');

  return {
    renamedFiles,
    successCount,
    failureCount,
    scriptContentBat: batLines.join('\r\n'),
    scriptContentSh: shLines.join('\n'),
  };
}

export async function downloadFileOrScript(
  content: string,
  fileName: string,
  mimeType: string = 'text/plain'
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
  if (cacheDir) {
    const fileUri = `${cacheDir}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: fileName });
    }
  }
}
