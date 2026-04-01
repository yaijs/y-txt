import type { Category, ToolDef, ToolOption } from './types.js';

export const TRANSLATION_LANGUAGES_STORAGE_KEY = 'translationLanguages';
export const TARGET_LANGUAGE_OPTION_ID = 'targetLanguage';

export const DEFAULT_TRANSLATION_LANGUAGES = [
  'English',
  'German',
  'Spanish',
  'French',
  'Italian',
  'Japanese',
  'Chinese'
];

export function normalizeTranslationLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_TRANSLATION_LANGUAGES];
  }

  const seen = new Set<string>();
  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry) return false;
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return normalized.length ? normalized : [...DEFAULT_TRANSLATION_LANGUAGES];
}

export function createTargetLanguageOption(languages: string[]): ToolOption {
  const normalized = normalizeTranslationLanguages(languages);
  return {
    id: TARGET_LANGUAGE_OPTION_ID,
    label: 'Target Language',
    type: 'select',
    options: normalized,
    default: normalized[0]
  };
}

function withInjectedLanguageOption(tool: ToolDef, languages: string[]): ToolDef {
  if (!tool.languages) return tool;

  const targetLanguageOption = createTargetLanguageOption(languages);
  const remainingOptions = (tool.options || []).filter((option) => option.id !== TARGET_LANGUAGE_OPTION_ID);

  return {
    ...tool,
    options: [targetLanguageOption, ...remainingOptions]
  };
}

export function injectTranslationLanguageOptions(categories: Category[], languages: string[]): Category[] {
  return categories.map((category) => ({
    ...category,
    tools: category.tools.map((tool) => withInjectedLanguageOption(tool, languages))
  }));
}
