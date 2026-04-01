import providersData from './providers.json';
import type { OpenAiCompatibleSystemMode } from './index.js';

export type ProviderType = 'openai-compatible' | 'anthropic';

export interface ProviderConfig {
  id: string;
  label: string;
  type: ProviderType;
  baseUrl: string;
  defaultModel: string;
  systemMode?: OpenAiCompatibleSystemMode;
  apiKeyUrl?: string;
  helpUrl?: string;
  description?: string;
  overrideConfig?: Record<string, unknown>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${path} must be a string.`);
  }
  return value;
}

function optionalObject(value: unknown, path: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value;
}

export function validateProvidersConfig(value: unknown): ProviderConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Providers config must be a non-empty JSON array.');
  }

  const ids = new Set<string>();

  return value.map((entry, index) => {
    const path = `providers[${index}]`;
    if (!isObject(entry)) {
      throw new Error(`${path} must be an object.`);
    }

    const id = requireString(entry.id, `${path}.id`);
    if (ids.has(id)) {
      throw new Error(`Duplicate provider id "${id}".`);
    }
    ids.add(id);

    const type = requireString(entry.type, `${path}.type`);
    if (type !== 'openai-compatible' && type !== 'anthropic') {
      throw new Error(`${path}.type must be "openai-compatible" or "anthropic".`);
    }

    const systemMode = optionalString(entry.systemMode, `${path}.systemMode`);
    if (
      systemMode !== undefined &&
      systemMode !== 'system' &&
      systemMode !== 'inline_user'
    ) {
      throw new Error(`${path}.systemMode must be "system" or "inline_user".`);
    }

    return {
      id,
      label: requireString(entry.label, `${path}.label`),
      type,
      baseUrl: requireString(entry.baseUrl, `${path}.baseUrl`).replace(/\/+$/, ''),
      defaultModel: requireString(entry.defaultModel, `${path}.defaultModel`),
      systemMode,
      apiKeyUrl: optionalString(entry.apiKeyUrl, `${path}.apiKeyUrl`),
      helpUrl: optionalString(entry.helpUrl, `${path}.helpUrl`),
      description: optionalString(entry.description, `${path}.description`),
      overrideConfig: optionalObject(entry.overrideConfig, `${path}.overrideConfig`),
    };
  });
}

export const BUNDLED_PROVIDERS = validateProvidersConfig(providersData);

export function getProviderStorageKey(providerId: string): string {
  return `${providerId}Key`;
}

export function findProviderConfig(
  providers: ProviderConfig[],
  providerId: string
): ProviderConfig | undefined {
  return providers.find((provider) => provider.id === providerId);
}
