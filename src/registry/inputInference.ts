import { ToolDefinition } from './types';
import { getAllEnabledTools } from './tools';

export type SupportedInputType = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'document' | 'file';

export function inferInputType(
  mimeType?: string,
  fileName?: string,
  rawType?: string
): SupportedInputType {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  const raw = (rawType || '').toLowerCase();

  if (raw === 'image' || mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|svg)$/i.test(name)) {
    return 'image';
  }
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (raw === 'video' || mime.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|3gp|flv)$/i.test(name)) {
    return 'video';
  }
  if (raw === 'audio' || mime.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(name)) {
    return 'audio';
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    /\.(txt|csv|json|srt|md|log|html|css|js|ts)$/i.test(name)
  ) {
    return 'text';
  }
  if (
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('powerpoint') ||
    mime.includes('officedocument') ||
    /\.(doc|docx|xls|xlsx|ppt|pptx|odt)$/i.test(name)
  ) {
    return 'document';
  }
  return 'file';
}

export function getToolsForInputType(inputType: SupportedInputType): ToolDefinition[] {
  const allTools = getAllEnabledTools();
  return allTools.filter((tool) => {
    if (!tool.supportedInputTypes || tool.supportedInputTypes.length === 0) {
      return false;
    }
    const supported = tool.supportedInputTypes;
    if (supported.includes(inputType)) return true;
    if (supported.includes('file')) return true;
    if (inputType === 'pdf' && (supported.includes('document') || supported.includes('file'))) return true;
    if (inputType === 'document' && (supported.includes('pdf') || supported.includes('file'))) return true;
    if (inputType === 'image' && supported.includes('media')) return true;
    if (inputType === 'video' && supported.includes('media')) return true;
    return false;
  });
}
