import type { Category } from './types.js';
import toolsData from './tools.json';

export * from './types.js';

export const CATEGORIES: Category[] = toolsData as Category[];

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
