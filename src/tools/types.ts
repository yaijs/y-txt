export interface ToolOption {
  id: string;
  label: string;
  type: 'select' | 'text';
  options?: string[];
  default?: string;
}

export interface ToolPromptDef {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  provider?: string;
  temperature?: number;
}

export interface ToolStepDef extends ToolPromptDef {
  id: string;
  name: string;
}

export interface ToolDef extends Partial<ToolPromptDef> {
  id: string;
  name: string;
  icon?: string;
  options?: ToolOption[];
  steps?: ToolStepDef[];
}

export interface Category {
  id: string;
  label: string;
  tools: ToolDef[];
}
