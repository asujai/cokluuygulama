import { ToolDefinition } from './types';
import { CATEGORIES, getCategoryById } from './categories';
import { matchesTurkishQuery } from './turkishUtils';
import { textCounterTool } from '../tools/text-counter';
import { unitConverterTool } from '../tools/unit-converter';
import { passwordGeneratorTool } from '../tools/password-generator';
import { documentScannerTool } from '../tools/document-scanner';
import { mediaCompressorTool } from '../tools/media-compressor';
import { habitTrackerTool } from '../tools/habit-tracker';
import { hiitTabataTimerTool } from '../tools/hiit-tabata-timer';

/**
 * Master array of all registered tools.
 * To register a new tool, simply add its ToolDefinition here.
 */
export const TOOLS: ToolDefinition[] = [
  textCounterTool,
  unitConverterTool,
  passwordGeneratorTool,
  documentScannerTool,
  mediaCompressorTool,
  habitTrackerTool,
  hiitTabataTimerTool,
];

/**
 * Validates registry integrity at startup.
 * Checks for:
 * 1. Duplicate tool IDs
 * 2. Duplicate tool routes
 * 3. Invalid or missing category IDs
 */
export function validateRegistries(): void {
  const toolIds = new Set<string>();
  const toolRoutes = new Set<string>();
  const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));

  for (const tool of TOOLS) {
    // Check duplicate ID
    if (toolIds.has(tool.id)) {
      throw new Error(`[Registry Error] Duplicate tool ID found: "${tool.id}"`);
    }
    toolIds.add(tool.id);

    // Check duplicate route
    if (toolRoutes.has(tool.route)) {
      throw new Error(`[Registry Error] Duplicate tool route found: "${tool.route}"`);
    }
    toolRoutes.add(tool.route);

    // Check category exists
    if (!validCategoryIds.has(tool.categoryId)) {
      throw new Error(
        `[Registry Error] Tool "${tool.id}" references unknown categoryId: "${tool.categoryId}"`
      );
    }
  }

  // Also check duplicate category IDs
  const categoryIds = new Set<string>();
  for (const cat of CATEGORIES) {
    if (categoryIds.has(cat.id)) {
      throw new Error(`[Registry Error] Duplicate category ID found: "${cat.id}"`);
    }
    categoryIds.add(cat.id);
  }
}

// Run validation immediately upon module evaluation in development
if (__DEV__) {
  try {
    validateRegistries();
  } catch (error) {
    console.error('[Registry Integrity Failure]', error);
  }
}

export function getAllTools(): ToolDefinition[] {
  return TOOLS;
}

export function getAllEnabledTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.enabled);
}

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id && t.enabled);
}

export function getToolByRoute(route: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.route === route && t.enabled);
}

export function isToolEnabled(id: string): boolean {
  const tool = TOOLS.find((t) => t.id === id);
  return !!tool && tool.enabled;
}

export function getToolsByCategory(categoryId: string): ToolDefinition[] {
  return getAllEnabledTools().filter((tool) => tool.categoryId === categoryId);
}

export function searchTools(query: string): ToolDefinition[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const enabledTools = getAllEnabledTools();

  return enabledTools.filter((tool) => {
    // Match in tool name
    if (matchesTurkishQuery(tool.name, trimmed)) {
      return true;
    }
    // Match in tool description
    if (matchesTurkishQuery(tool.description, trimmed)) {
      return true;
    }
    // Match in category name
    const category = getCategoryById(tool.categoryId);
    if (category && matchesTurkishQuery(category.name, trimmed)) {
      return true;
    }
    // Match in keywords
    if (tool.keywords.some((keyword) => matchesTurkishQuery(keyword, trimmed))) {
      return true;
    }
    return false;
  });
}
