import type { Category, ToolDef, ToolOption, ToolPromptDef, ToolStepDef } from '../tools/types.js';

export interface ModelConfig {
  model: string;
  temperature?: number | null;
}

export type ModelEntry = string | ModelConfig;
export type ModelProviderMap = Record<string, ModelEntry>;
export type ModelSets = Record<string, ModelProviderMap>;

const PLACEHOLDER_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  if (typeof value !== 'string') throw new Error(`${path} must be a string.`);
  return value;
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${path} must be a valid number.`);
  }
  return value;
}

function requirePlaceholderId(value: unknown, path: string): string {
  const id = requireString(value, path);
  if (!PLACEHOLDER_ID_PATTERN.test(id)) {
    throw new Error(`${path} must match ${PLACEHOLDER_ID_PATTERN.toString()}.`);
  }
  return id;
}

function validatePromptDef(value: Record<string, unknown>, path: string): ToolPromptDef {
  return {
    systemPrompt: requireString(value.systemPrompt, `${path}.systemPrompt`),
    userMessage: requireString(value.userMessage, `${path}.userMessage`),
    model: optionalString(value.model, `${path}.model`),
    provider: optionalString(value.provider, `${path}.provider`),
    temperature: optionalNumber(value.temperature, `${path}.temperature`)
  };
}

function validateToolOption(value: unknown, path: string): ToolOption {
  if (!isObject(value)) throw new Error(`${path} must be an object.`);

  const type = requireString(value.type, `${path}.type`);
  if (type !== 'select' && type !== 'text') {
    throw new Error(`${path}.type must be "select" or "text".`);
  }

  const option: ToolOption = {
    id: requirePlaceholderId(value.id, `${path}.id`),
    label: requireString(value.label, `${path}.label`),
    type
  };

  if (value.default !== undefined) {
    option.default = requireString(value.default, `${path}.default`);
  }

  if (type === 'select') {
    if (!Array.isArray(value.options) || value.options.length === 0) {
      throw new Error(`${path}.options must be a non-empty array for select options.`);
    }
    option.options = value.options.map((entry, index) => requireString(entry, `${path}.options[${index}]`));
  }

  return option;
}

function validateToolStep(value: unknown, path: string): ToolStepDef {
  if (!isObject(value)) throw new Error(`${path} must be an object.`);

  return {
    id: requirePlaceholderId(value.id, `${path}.id`),
    name: requireString(value.name, `${path}.name`),
    ...validatePromptDef(value, path)
  };
}

function validateTool(value: unknown, path: string): ToolDef {
  if (!isObject(value)) throw new Error(`${path} must be an object.`);

  const tool: ToolDef = {
    id: requireString(value.id, `${path}.id`),
    name: requireString(value.name, `${path}.name`),
    icon: optionalString(value.icon, `${path}.icon`),
    description: optionalString(value.description, `${path}.description`)
  };

  if (value.languages !== undefined) {
    if (typeof value.languages !== 'boolean') {
      throw new Error(`${path}.languages must be a boolean.`);
    }
    tool.languages = value.languages;
  }

  if (value.options !== undefined) {
    if (!Array.isArray(value.options)) throw new Error(`${path}.options must be an array.`);
    tool.options = value.options.map((option, index) => validateToolOption(option, `${path}.options[${index}]`));
  }

  const hasDirectPrompt = value.systemPrompt !== undefined || value.userMessage !== undefined;
  const hasSteps = value.steps !== undefined;

  if (hasDirectPrompt && hasSteps) {
    throw new Error(`${path} cannot define both direct prompts and steps.`);
  }

  if (hasSteps) {
    if (!Array.isArray(value.steps) || value.steps.length === 0) {
      throw new Error(`${path}.steps must be a non-empty array.`);
    }

    const stepIds = new Set<string>();
    tool.steps = value.steps.map((step, index) => {
      const validatedStep = validateToolStep(step, `${path}.steps[${index}]`);
      if (stepIds.has(validatedStep.id)) {
        throw new Error(`${path}.steps contains a duplicate id "${validatedStep.id}".`);
      }
      stepIds.add(validatedStep.id);
      return validatedStep;
    });
  } else {
    Object.assign(tool, validatePromptDef(value, path));
  }

  return tool;
}

export function validateCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) throw new Error('Tools config must be a JSON array of categories.');

  const categoryIds = new Set<string>();
  const toolIds = new Set<string>();

  return value.map((entry, categoryIndex) => {
    const path = `categories[${categoryIndex}]`;
    if (!isObject(entry)) throw new Error(`${path} must be an object.`);

    const categoryId = requireString(entry.id, `${path}.id`);
    if (categoryIds.has(categoryId)) throw new Error(`Duplicate category id "${categoryId}".`);
    categoryIds.add(categoryId);

    if (!Array.isArray(entry.tools)) throw new Error(`${path}.tools must be an array.`);

    const category: Category = {
      id: categoryId,
      label: requireString(entry.label, `${path}.label`),
      flatList: entry.flatList === true,
      tools: entry.tools.map((tool, toolIndex) => {
        const validatedTool = validateTool(tool, `${path}.tools[${toolIndex}]`);
        if (toolIds.has(validatedTool.id)) {
          throw new Error(`Duplicate tool id "${validatedTool.id}".`);
        }
        toolIds.add(validatedTool.id);
        return validatedTool;
      })
    };

    return category;
  });
}

function validateModelEntry(value: unknown, path: string): ModelEntry {
  if (typeof value === 'string') {
    if (value.trim() === '') throw new Error(`${path} must not be empty.`);
    return value;
  }

  if (!isObject(value)) throw new Error(`${path} must be a string or object.`);

  const temperature = value.temperature;
  if (
    temperature !== undefined &&
    temperature !== null &&
    (typeof temperature !== 'number' || Number.isNaN(temperature))
  ) {
    throw new Error(`${path}.temperature must be a number or null.`);
  }

  return {
    model: requireString(value.model, `${path}.model`),
    temperature: temperature as number | null | undefined
  };
}

export function validateModelSets(value: unknown): ModelSets {
  if (!isObject(value)) throw new Error('Models config must be a JSON object.');

  const validated: ModelSets = {};

  for (const [setName, providerMap] of Object.entries(value)) {
    if (!isObject(providerMap)) {
      throw new Error(`models.${setName} must be an object of provider entries.`);
    }

    const validatedProviderMap: ModelProviderMap = {};
    for (const [providerId, entry] of Object.entries(providerMap)) {
      validatedProviderMap[providerId] = validateModelEntry(entry, `models.${setName}.${providerId}`);
    }

    if (Object.keys(validatedProviderMap).length === 0) {
      throw new Error(`models.${setName} must define at least one provider entry.`);
    }

    validated[setName] = validatedProviderMap;
  }

  if (Object.keys(validated).length === 0) {
    throw new Error('Models config must define at least one model set.');
  }

  return validated;
}

export function getToolSteps(tool: ToolDef): ToolStepDef[] {
  if (tool.steps && tool.steps.length > 0) return tool.steps;

  if (!tool.systemPrompt || !tool.userMessage) {
    throw new Error(`Tool "${tool.name}" is missing prompt content.`);
  }

  return [{
    id: 'result',
    name: tool.name,
    systemPrompt: tool.systemPrompt,
    userMessage: tool.userMessage,
    model: tool.model,
    provider: tool.provider,
    temperature: tool.temperature
  }];
}
