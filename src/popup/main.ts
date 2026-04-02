import { CATEGORIES as BUNDLED_CATEGORIES, Category, ToolDef } from '../tools/index.js';
import { getToolSteps, validateCategories, validateModelSets } from '../config/index.js';
import { localizePage, msg } from '../i18n.js';
import bundledModelsData from '../models.json';
import { BUNDLED_PROVIDERS, validateProvidersConfig } from '../providers/config.js';
import {
  DEFAULT_TRANSLATION_LANGUAGES,
  injectTranslationLanguageOptions,
  normalizeTranslationLanguages,
  TARGET_LANGUAGE_OPTION_ID,
  TRANSLATION_LANGUAGES_STORAGE_KEY
} from '../tools/languages.js';

const mainView = document.getElementById('main-view') as HTMLDivElement;
const historyView = document.getElementById('history-view') as HTMLDivElement;
const statsView = document.getElementById('stats-view') as HTMLDivElement;
const workspaceView = document.getElementById('workspace-view') as HTMLDivElement;
const faqView = document.getElementById('faq-view') as HTMLDivElement;
const toolListEl = document.getElementById('tool-list') as HTMLDivElement;
const missingKeyMsg = document.getElementById('missing-key-msg') as HTMLDivElement;
const setupCardEl = document.getElementById('setup-card') as HTMLDivElement;
const setupTitleEl = document.getElementById('setup-title') as HTMLHeadingElement;
const setupBodyEl = document.getElementById('setup-body') as HTMLParagraphElement;
const setupHelpEl = document.getElementById('setup-help') as HTMLParagraphElement;
const btnSetupOptions = document.getElementById('btn-setup-options') as HTMLButtonElement;
const btnSetupAdmin = document.getElementById('btn-setup-admin') as HTMLButtonElement;
const toolOptionsContainer = document.getElementById('tool-options-container') as HTMLDivElement;
const surfaceLockBanner = document.getElementById('surface-lock-banner') as HTMLDivElement;
const btnOpenSidePanel = document.getElementById('btn-open-side-panel') as HTMLButtonElement;
const sidePanelLockToggle = document.getElementById('side-panel-lock-toggle') as HTMLInputElement;

const workspaceTitle = document.getElementById('workspace-title') as HTMLHeadingElement;
const workspaceSubtitle = document.getElementById('workspace-subtitle') as HTMLSpanElement;
const workspaceInput = document.getElementById('workspace-input') as HTMLTextAreaElement;
const btnToolDescriptionToggle = document.getElementById('btn-tool-description-toggle') as HTMLButtonElement;
const toolDescriptionBox = document.getElementById('tool-description-box') as HTMLDivElement;
const workspaceResult = document.getElementById('workspace-result') as HTMLTextAreaElement;
const stagedSection = document.getElementById('staged-section') as HTMLDivElement;
const stagedContentEl = document.getElementById('staged-content') as HTMLTextAreaElement;
const stagedToggle = document.getElementById('staged-toggle') as HTMLButtonElement;
const workspaceStatus = document.getElementById('workspace-status') as HTMLDivElement;
const btnToolManagerToggle = document.getElementById('btn-tool-manager-toggle') as HTMLButtonElement;
const toolManagerPanel = document.getElementById('tool-manager-panel') as HTMLDivElement;
const toolManagerStatus = document.getElementById('tool-manager-status') as HTMLDivElement;
const toolManagerList = document.getElementById('tool-manager-list') as HTMLDivElement;
const toolManagerActions = document.getElementById('tool-manager-actions') as HTMLDivElement;
const btnToolManagerReset = document.getElementById('btn-tool-manager-reset') as HTMLButtonElement;

const btnCopyResult = document.getElementById('btn-copy-result') as HTMLButtonElement;
const btnUseResult = document.getElementById('btn-use-result') as HTMLButtonElement;
const btnSaveGeneratedTool = document.getElementById('btn-save-generated-tool') as HTMLButtonElement;
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
const btnHistoryBack = document.getElementById('btn-history-back') as HTMLButtonElement;
const btnStatsBack = document.getElementById('btn-stats-back') as HTMLButtonElement;
const btnClearHistory = document.getElementById('btn-clear-history') as HTMLButtonElement;
const btnHistory = document.getElementById('btn-history') as HTMLButtonElement;
const btnStats = document.getElementById('btn-stats') as HTMLButtonElement;
const btnTooling = document.getElementById('btn-tooling') as HTMLButtonElement;
const btnFaq = document.getElementById('btn-faq') as HTMLButtonElement;
const btnFaqBack = document.getElementById('btn-faq-back') as HTMLButtonElement;
const resultHint = document.getElementById('result-hint') as HTMLSpanElement;
const inputCharCount = document.getElementById('input-char-count') as HTMLSpanElement;
const resultCharCount = document.getElementById('result-char-count') as HTMLSpanElement;
const btnAppend = document.getElementById('btn-append') as HTMLButtonElement;
const btnOverride = document.getElementById('btn-override') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnSubmit = document.getElementById('btn-submit') as HTMLButtonElement;
const btnAbort = document.getElementById('btn-abort') as HTMLButtonElement;
const runStartedAtEl = document.getElementById('run-started-at') as HTMLSpanElement;
const runFinishedAtEl = document.getElementById('run-finished-at') as HTMLSpanElement;
const runElapsedEl = document.getElementById('run-elapsed') as HTMLSpanElement;
const btnOptions = document.getElementById('btn-options') as HTMLButtonElement;
const ACTIVE_RUN_STORAGE_KEY = 'activeRunState';
const WORKSPACE_STORAGE_KEY = 'workspaceState';
const SURFACE_LOCK_STORAGE_KEY = 'uiSurfaceLock';
const CATEGORY_COLLAPSE_STORAGE_KEY = 'categoryCollapsed';
const SIDE_PANEL_PORT_PREFIX = 'ytxt-sidepanel:';
const surface = document.body.dataset.surface === 'sidepanel' ? 'sidepanel' : 'popup';
const isSidePanelSurface = surface === 'sidepanel';
const isPopupSurface = surface === 'popup';
const sidePanelSessionId = isSidePanelSurface ? crypto.randomUUID() : null;

let activeTool: ToolDef | null = null;
let activeCategories: Category[] = [];
let activeToolIndex = new Map<string, ToolDef>();
let currentOptions: Record<string, string> = {};
let categoryAutoRun: Record<string, boolean> = {};
let categoryCollapsed: Record<string, boolean> = {};
let previousView: 'main' | 'history' = 'main';
let activeRequestId: string | null = null;
let activeRunRequestId: string | null = null;
let requestCounter = 0;
let activeRunStartedAt: Date | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let loadingWatchdogTimer: ReturnType<typeof setInterval> | null = null;
let preferredTargetLanguage = '';
let popupLocked = false;
let sidePanelPort: chrome.runtime.Port | null = null;
let toolManagerOpen = false;
let toolDescriptionOpen = false;

const TARGET_LANGUAGE_STORAGE_KEY = 'lastUsedTargetLanguage';
const LANGUAGE_NAME_BY_CODE: Record<string, string> = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  zh: 'Chinese'
};

interface HistoryEntry {
  toolId: string;
  toolName: string;
  toolIcon?: string;
  providerId?: string;
  model?: string;
  input: string;
  result: string;
  stagedContent: string;
  options: Record<string, string>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  timestamp: number;
}

interface ProviderReadyStatus {
  activeProviderId: string;
  activeProviderReady: boolean;
  anyProviderReady: boolean;
  availableProviders: string[];
}

interface KeystoneSetupStatus {
  available: boolean;
  adminUrl?: string;
  error?: string;
  missingHost?: boolean;
}

interface WorkspaceState {
  toolId: string;
  input: string;
  result: string;
  stagedContent: string;
  options: Record<string, string>;
  stagedOpen: boolean;
  runRequestId?: string;
}

interface ToolRuntimeContext {
  currentConfig: string;
  currentToolsConfig: string;
  currentModelsConfig: string;
  currentProvidersConfig: string;
  currentTranslationLanguages: string;
}

interface GeneratedToolCandidate extends Record<string, unknown> {
  id: string;
  name: string;
  systemPrompt?: string;
  userMessage?: string;
  steps?: unknown[];
  description?: string;
}

function unwrapJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

type RunStatus = 'running' | 'completed' | 'error' | 'aborted';

interface ToolRunStep {
  id: string;
  name: string;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  model?: string;
  provider?: string;
}

interface ActiveRunState {
  requestId: string;
  toolId: string;
  toolName: string;
  toolIcon?: string;
  input: string;
  result: string;
  stagedContent: string;
  options: Record<string, string>;
  stagedOpen: boolean;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  stepIndex: number;
  stepCount: number;
  currentStepName?: string;
  providerId?: string;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  error?: string;
}

interface SurfaceLockState {
  owner: 'sidepanel';
  sessionId: string;
  updatedAt: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickStringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([, optionValue]) => typeof optionValue === 'string')
  ) as Record<string, string>;
}

function createToolIndex(categories: Category[]): Map<string, ToolDef> {
  return new Map(categories.flatMap(category => category.tools.map(tool => [tool.id, tool] as const)));
}

function setCategories(categories: Category[]): void {
  activeCategories = categories.filter(category => category.tools.length > 0);
  activeToolIndex = createToolIndex(activeCategories);
}

function getBrowserLanguageCandidates(): string[] {
  const locales = new Set<string>();

  const pushLocale = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      locales.add(value.trim());
    }
  };

  pushLocale(chrome.i18n?.getUILanguage?.());
  navigator.languages.forEach(pushLocale);
  pushLocale(navigator.language);
  pushLocale(Intl.DateTimeFormat().resolvedOptions().locale);

  return [...locales];
}

function getTargetLanguageFromLocale(locale: string, allowedOptions: string[]): string | null {
  const normalizedAllowed = new Map(allowedOptions.map(option => [option.toLowerCase(), option]));
  const baseCode = locale.toLowerCase().split(/[-_]/)[0];
  const mappedName = LANGUAGE_NAME_BY_CODE[baseCode];
  if (mappedName) {
    const matchedOption = normalizedAllowed.get(mappedName.toLowerCase());
    if (matchedOption) return matchedOption;
  }

  return null;
}

function resolveInitialTargetLanguage(optionValues: string[], toolDefault?: string): string {
  const normalizedAllowed = new Map(optionValues.map(option => [option.toLowerCase(), option]));
  const storedPreference = normalizedAllowed.get(preferredTargetLanguage.toLowerCase());
  if (storedPreference) return storedPreference;

  for (const locale of getBrowserLanguageCandidates()) {
    const matched = getTargetLanguageFromLocale(locale, optionValues);
    if (matched) return matched;
  }

  return toolDefault && normalizedAllowed.has(toolDefault.toLowerCase())
    ? normalizedAllowed.get(toolDefault.toLowerCase()) as string
    : optionValues[0] ?? '';
}

function updateToolOptionsVisibility(): void {
  toolOptionsContainer.classList.toggle('is-visible', toolOptionsContainer.childElementCount > 0);
}

function getToolingTool(): ToolDef | null {
  return activeToolIndex.get('tool-generator')
    ?? activeCategories.find((category) => category.id === 'tooling')?.tools[0]
    ?? null;
}

function isToolGeneratorActive(): boolean {
  return activeTool?.id === 'tool-generator' && currentOptions.configTarget === 'tool';
}

function updateGeneratedToolAction(): void {
  const visible = isToolGeneratorActive() && workspaceResult.value.trim().length > 0;
  btnSaveGeneratedTool.style.display = visible ? '' : 'none';
  btnSaveGeneratedTool.disabled = !visible;
}

function updateToolDescriptionVisibility(): void {
  const description = activeTool?.description?.trim();
  const visible = Boolean(description);
  btnToolDescriptionToggle.style.display = visible ? '' : 'none';
  btnToolDescriptionToggle.textContent = toolDescriptionOpen ? msg('toolDescriptionHideButton') : msg('toolDescriptionInfoButton');
  toolDescriptionBox.classList.toggle('is-open', visible && toolDescriptionOpen);
  toolDescriptionBox.textContent = visible ? description || '' : '';
}

function isToolingWorkspaceActive(): boolean {
  return activeTool?.id === 'tool-generator';
}

function updateToolManagerVisibility(): void {
  const visible = isToolingWorkspaceActive();
  btnToolManagerToggle.style.display = visible ? 'block' : 'none';
  btnToolManagerToggle.textContent = toolManagerOpen ? msg('hideToolManagerButton') : msg('manageToolsButton');
  toolManagerPanel.classList.toggle('is-open', visible && toolManagerOpen);
}

function parseGeneratedToolCandidate(raw: string): GeneratedToolCandidate {
  const normalized = unwrapJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error(msg('generatedToolInvalidJson'));
  }

  if (!isObject(parsed)) {
    throw new Error(msg('generatedToolInvalidShape'));
  }

  if (
    typeof parsed.id !== 'string' ||
    typeof parsed.name !== 'string'
  ) {
    throw new Error(msg('generatedToolInvalidShape'));
  }

  const hasDirectPrompt = typeof parsed.systemPrompt === 'string' && typeof parsed.userMessage === 'string';
  const hasSteps = Array.isArray(parsed.steps) && parsed.steps.length > 0;
  if (!hasDirectPrompt && !hasSteps) {
    throw new Error(msg('generatedToolInvalidShape'));
  }

  return {
    ...parsed,
    id: parsed.id,
    name: parsed.name,
    systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : undefined,
    userMessage: typeof parsed.userMessage === 'string' ? parsed.userMessage : undefined,
    steps: Array.isArray(parsed.steps) ? parsed.steps : undefined,
    description: typeof parsed.description === 'string' ? parsed.description : undefined
  };
}

function isStagedSectionOpen(): boolean {
  return stagedSection.classList.contains('is-open');
}

function setStagedSectionOpen(isOpen: boolean): void {
  stagedSection.classList.toggle('is-open', isOpen);
  stagedToggle.setAttribute('aria-expanded', String(isOpen));
}

async function setLastUsedTargetLanguage(value: string): Promise<void> {
  preferredTargetLanguage = value;
  await chrome.storage.local.set({ [TARGET_LANGUAGE_STORAGE_KEY]: value });
}

function autoResizeResult() {
  workspaceResult.style.height = 'auto';
  workspaceResult.style.height = `${workspaceResult.scrollHeight}px`;
}

function updateInputUI(value: string) {
  workspaceInput.value = value;
  inputCharCount.textContent = String(value.length);
}

function updateResultUI(value: string) {
  workspaceResult.value = isToolGeneratorActive() ? unwrapJsonFence(value) : value;
  resultCharCount.textContent = String(workspaceResult.value.length);
  autoResizeResult();
  updateGeneratedToolAction();
}

function setResultHint(label: string, color = 'var(--muted)') {
  resultHint.textContent = label;
  resultHint.style.color = color;
  resultHint.style.display = label ? 'inline' : 'none';
}

function formatClockTime(date: Date | null): string {
  if (!date) return '--:--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateRunMeta(startedAt: Date | null, finishedAt: Date | null) {
  runStartedAtEl.textContent = formatClockTime(startedAt);
  runFinishedAtEl.textContent = formatClockTime(finishedAt);
  if (!startedAt) {
    runElapsedEl.textContent = '--';
    return;
  }
  const end = finishedAt || new Date();
  const elapsedMs = Math.max(0, end.getTime() - startedAt.getTime());
  runElapsedEl.textContent = (elapsedMs / 1000).toFixed(1) + 's';
}

function setRunningState(isRunning: boolean) {
  btnSubmit.disabled = isRunning;
  btnAbort.style.display = isRunning ? '' : 'none';
  btnAbort.disabled = !isRunning;
  document.body.classList.toggle('is-loading', isRunning);
  btnSubmit.textContent = isRunning
    ? msg('running')
    : activeTool?.steps && activeTool.steps.length > 1
      ? msg('runStepTool', String(activeTool.steps.length))
      : msg('runTool');
}

function ensureLoadingWatchdog(): void {
  if (loadingWatchdogTimer) return;

  loadingWatchdogTimer = setInterval(() => {
    const isVisuallyLoading = document.body.classList.contains('is-loading');
    if (!isVisuallyLoading) return;
    if (activeRequestId || activeRunRequestId) return;

    setRunningState(false);
    if (workspaceStatus.textContent === msg('aborting')) {
      workspaceStatus.textContent = msg('aborted');
    }
  }, 1200);
}

async function saveWorkspaceState(): Promise<void> {
  if (!activeTool) return;

  const state: WorkspaceState = {
    toolId: activeTool.id,
    input: workspaceInput.value,
    result: workspaceResult.value,
    stagedContent: stagedContentEl.value,
    options: { ...currentOptions },
    stagedOpen: isStagedSectionOpen(),
    runRequestId: activeRunRequestId ?? undefined
  };

  await chrome.storage.local.set({ [WORKSPACE_STORAGE_KEY]: state });
}

async function clearWorkspaceState(): Promise<void> {
  await chrome.storage.local.remove(WORKSPACE_STORAGE_KEY);
}

async function clearActiveRunState(): Promise<void> {
  await chrome.storage.local.remove(ACTIVE_RUN_STORAGE_KEY);
}

async function loadCategoryAutoRun(): Promise<Record<string, boolean>> {
  const stored = await chrome.storage.local.get('categoryAutoRun') as { categoryAutoRun?: unknown };
  if (!isObject(stored.categoryAutoRun)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(stored.categoryAutoRun).filter(([, value]) => typeof value === 'boolean')
  ) as Record<string, boolean>;
}

async function setCategoryAutoRun(categoryId: string, enabled: boolean): Promise<void> {
  categoryAutoRun = {
    ...categoryAutoRun,
    [categoryId]: enabled
  };
  await chrome.storage.local.set({ categoryAutoRun });
}

async function loadCategoryCollapsed(): Promise<Record<string, boolean>> {
  const stored = await chrome.storage.local.get(CATEGORY_COLLAPSE_STORAGE_KEY) as { categoryCollapsed?: unknown };
  if (!isObject(stored.categoryCollapsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(stored.categoryCollapsed).filter(([, value]) => typeof value === 'boolean')
  ) as Record<string, boolean>;
}

async function setCategoryCollapsed(categoryId: string, collapsed: boolean): Promise<void> {
  categoryCollapsed = {
    ...categoryCollapsed,
    [categoryId]: collapsed
  };
  await chrome.storage.local.set({ [CATEGORY_COLLAPSE_STORAGE_KEY]: categoryCollapsed });
}

function normalizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!isObject(value)) return null;

  if (typeof value.toolId === 'string') {
    return {
      toolId: value.toolId,
      toolName: typeof value.toolName === 'string' ? value.toolName : value.toolId,
      toolIcon: typeof value.toolIcon === 'string' ? value.toolIcon : undefined,
      providerId: typeof value.providerId === 'string' ? value.providerId : undefined,
      model: typeof value.model === 'string' ? value.model : undefined,
      input: typeof value.input === 'string' ? value.input : '',
      result: typeof value.result === 'string' ? value.result : '',
      stagedContent: typeof value.stagedContent === 'string' ? value.stagedContent : '',
      options: pickStringRecord(value.options),
      usage: isObject(value.usage) ? {
        inputTokens: typeof value.usage.inputTokens === 'number' ? value.usage.inputTokens : undefined,
        outputTokens: typeof value.usage.outputTokens === 'number' ? value.usage.outputTokens : undefined,
        totalTokens: typeof value.usage.totalTokens === 'number' ? value.usage.totalTokens : undefined,
      } : undefined,
      timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now()
    };
  }

  if (isObject(value.tool) && typeof value.tool.id === 'string' && typeof value.tool.name === 'string') {
    return {
      toolId: value.tool.id,
      toolName: value.tool.name,
      toolIcon: typeof value.tool.icon === 'string' ? value.tool.icon : undefined,
      providerId: typeof value.providerId === 'string' ? value.providerId : undefined,
      model: typeof value.model === 'string' ? value.model : undefined,
      input: typeof value.input === 'string' ? value.input : '',
      result: typeof value.result === 'string' ? value.result : '',
      stagedContent: typeof value.stagedContent === 'string' ? value.stagedContent : '',
      options: pickStringRecord(value.options),
      usage: isObject(value.usage) ? {
        inputTokens: typeof value.usage.inputTokens === 'number' ? value.usage.inputTokens : undefined,
        outputTokens: typeof value.usage.outputTokens === 'number' ? value.usage.outputTokens : undefined,
        totalTokens: typeof value.usage.totalTokens === 'number' ? value.usage.totalTokens : undefined,
      } : undefined,
      timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now()
    };
  }

  return null;
}

function normalizeWorkspaceState(value: unknown): WorkspaceState | null {
  if (!isObject(value)) return null;

  if (typeof value.toolId === 'string') {
    return {
      toolId: value.toolId,
      input: typeof value.input === 'string' ? value.input : '',
      result: typeof value.result === 'string' ? value.result : '',
      stagedContent: typeof value.stagedContent === 'string' ? value.stagedContent : '',
      options: pickStringRecord(value.options),
      stagedOpen: value.stagedOpen === true,
      runRequestId: typeof value.runRequestId === 'string' ? value.runRequestId : undefined
    };
  }

  if (isObject(value.tool) && typeof value.tool.id === 'string') {
    return {
      toolId: value.tool.id,
      input: typeof value.input === 'string' ? value.input : '',
      result: typeof value.result === 'string' ? value.result : '',
      stagedContent: typeof value.stagedContent === 'string' ? value.stagedContent : '',
      options: pickStringRecord(value.options),
      stagedOpen: value.stagedOpen === true,
      runRequestId: typeof value.runRequestId === 'string' ? value.runRequestId : undefined
    };
  }

  return null;
}

function normalizeActiveRunState(value: unknown): ActiveRunState | null {
  if (!isObject(value)) return null;
  if (typeof value.requestId !== 'string' || typeof value.toolId !== 'string' || typeof value.toolName !== 'string') {
    return null;
  }

  const status = value.status;
  if (status !== 'running' && status !== 'completed' && status !== 'error' && status !== 'aborted') {
    return null;
  }

  return {
    requestId: value.requestId,
    toolId: value.toolId,
    toolName: value.toolName,
    toolIcon: typeof value.toolIcon === 'string' ? value.toolIcon : undefined,
    input: typeof value.input === 'string' ? value.input : '',
    result: typeof value.result === 'string' ? value.result : '',
    stagedContent: typeof value.stagedContent === 'string' ? value.stagedContent : '',
    options: pickStringRecord(value.options),
    stagedOpen: value.stagedOpen === true,
    status,
    startedAt: typeof value.startedAt === 'number' ? value.startedAt : Date.now(),
    finishedAt: typeof value.finishedAt === 'number' ? value.finishedAt : undefined,
    stepIndex: typeof value.stepIndex === 'number' ? value.stepIndex : 1,
    stepCount: typeof value.stepCount === 'number' ? value.stepCount : 1,
    currentStepName: typeof value.currentStepName === 'string' ? value.currentStepName : undefined,
    providerId: typeof value.providerId === 'string' ? value.providerId : undefined,
    model: typeof value.model === 'string' ? value.model : undefined,
    usage: isObject(value.usage) ? {
      inputTokens: typeof value.usage.inputTokens === 'number' ? value.usage.inputTokens : undefined,
      outputTokens: typeof value.usage.outputTokens === 'number' ? value.usage.outputTokens : undefined,
      totalTokens: typeof value.usage.totalTokens === 'number' ? value.usage.totalTokens : undefined,
    } : undefined,
    error: typeof value.error === 'string' ? value.error : undefined
  };
}

function normalizeSurfaceLockState(value: unknown): SurfaceLockState | null {
  if (!isObject(value)) return null;
  if (value.owner !== 'sidepanel') return null;
  if (typeof value.sessionId !== 'string' || typeof value.updatedAt !== 'number') return null;

  return {
    owner: 'sidepanel',
    sessionId: value.sessionId,
    updatedAt: value.updatedAt
  };
}

async function loadHistory(): Promise<HistoryEntry[]> {
  const res = await chrome.storage.local.get('history') as { history?: unknown[] };
  const history = Array.isArray(res.history)
    ? res.history.map(normalizeHistoryEntry).filter((entry): entry is HistoryEntry => entry !== null)
    : [];

  await chrome.storage.local.set({ history });
  return history;
}

async function buildToolRuntimeContext(): Promise<ToolRuntimeContext> {
  const stored = await chrome.storage.local.get([
    'customTools',
    'customModels',
    'customProviders',
    TRANSLATION_LANGUAGES_STORAGE_KEY
  ]) as Record<string, unknown>;

  const toolsConfig = (() => {
    if (typeof stored.customTools === 'string') {
      try {
        return validateCategories(JSON.parse(stored.customTools));
      } catch {
        // fall through to bundled defaults
      }
    }
    return validateCategories(BUNDLED_CATEGORIES);
  })();

  const modelsConfig = (() => {
    if (typeof stored.customModels === 'string') {
      try {
        return validateModelSets(JSON.parse(stored.customModels));
      } catch {
        // fall through to bundled defaults
      }
    }
    return validateModelSets(bundledModelsData);
  })();

  const providersConfig = (() => {
    if (typeof stored.customProviders === 'string') {
      try {
        return validateProvidersConfig(JSON.parse(stored.customProviders));
      } catch {
        // fall through to bundled defaults
      }
    }
    return BUNDLED_PROVIDERS;
  })();

  const translationLanguages = normalizeTranslationLanguages(stored[TRANSLATION_LANGUAGES_STORAGE_KEY]);

  return {
    currentConfig: JSON.stringify(toolsConfig, null, 2),
    currentToolsConfig: JSON.stringify(toolsConfig, null, 2),
    currentModelsConfig: JSON.stringify(modelsConfig, null, 2),
    currentProvidersConfig: JSON.stringify(providersConfig, null, 2),
    currentTranslationLanguages: JSON.stringify(
      translationLanguages.length ? translationLanguages : DEFAULT_TRANSLATION_LANGUAGES,
      null,
      2
    )
  };
}

async function loadEffectiveToolCategories(): Promise<Category[]> {
  const stored = await chrome.storage.local.get(['customTools', TRANSLATION_LANGUAGES_STORAGE_KEY]) as Record<string, unknown>;
  const translationLanguages = normalizeTranslationLanguages(stored[TRANSLATION_LANGUAGES_STORAGE_KEY]);

  if (typeof stored.customTools === 'string') {
    try {
      return injectTranslationLanguageOptions(
        validateCategories(JSON.parse(stored.customTools)),
        translationLanguages
      );
    } catch {
      // fall through to bundled defaults
    }
  }

  return injectTranslationLanguageOptions(validateCategories(BUNDLED_CATEGORIES), translationLanguages);
}

async function saveGeneratedToolToStorage(): Promise<void> {
  const candidate = parseGeneratedToolCandidate(workspaceResult.value.trim());
  const stored = await chrome.storage.local.get('customTools') as { customTools?: unknown };
  const categories = (() => {
    if (typeof stored.customTools === 'string') {
      try {
        return validateCategories(JSON.parse(stored.customTools));
      } catch {
        // fall through to bundled defaults
      }
    }
    return validateCategories(BUNDLED_CATEGORIES);
  })().map((category) => ({
    ...category,
    tools: category.tools.map((tool) => ({ ...tool }))
  }));

  const duplicate = categories.some((category) => category.tools.some((tool) => tool.id === candidate.id));
  if (duplicate) {
    throw new Error(msg('generatedToolExists'));
  }

  let tooledCategory = categories.find((category) => category.id === 'tooled');
  if (!tooledCategory) {
    tooledCategory = {
      id: 'tooled',
      label: 'Tooled',
      tools: []
    };
    categories.push(tooledCategory);
  }

  tooledCategory.tools.push(candidate as ToolDef);

  let validated: Category[];
  try {
    validated = validateCategories(categories);
  } catch {
    throw new Error(msg('generatedToolInvalidConfig'));
  }

  await chrome.storage.local.set({ customTools: JSON.stringify(validated, null, 2) });
  setCategories(await loadEffectiveToolCategories());
}

async function deleteToolFromStorage(categoryId: string, toolId: string): Promise<void> {
  const stored = await chrome.storage.local.get('customTools') as { customTools?: unknown };
  const categories = (() => {
    if (typeof stored.customTools === 'string') {
      try {
        return validateCategories(JSON.parse(stored.customTools));
      } catch {
        // fall through to bundled defaults
      }
    }
    return validateCategories(BUNDLED_CATEGORIES);
  })().map((category) => ({
    ...category,
    tools: category.tools.map((tool) => ({ ...tool }))
  }));

  const nextCategories = categories
    .map((category) => {
      if (category.id !== categoryId) return category;
      return {
        ...category,
        tools: category.tools.filter((tool) => tool.id !== toolId)
      };
    })
    .filter((category) => category.id !== 'tooled' || category.tools.length > 0);

  const validated = validateCategories(nextCategories);
  await chrome.storage.local.set({ customTools: JSON.stringify(validated, null, 2) });
  setCategories(await loadEffectiveToolCategories());
}

async function resetToolsToDefault(): Promise<void> {
  await chrome.storage.local.remove('customTools');
  setCategories(await loadEffectiveToolCategories());
}

async function renderToolManager(): Promise<void> {
  toolManagerList.innerHTML = '';
  toolManagerStatus.style.display = 'none';
  toolManagerStatus.textContent = '';
  toolManagerActions.style.display = 'none';

  const categories = (await loadEffectiveToolCategories()).filter((category) => category.id !== 'tooling');
  const hasEntries = categories.some((category) => category.tools.length > 0);

  if (!hasEntries) {
    toolManagerStatus.textContent = msg('toolManagerEmpty');
    toolManagerStatus.style.display = 'block';
    toolManagerActions.style.display = 'flex';
    return;
  }

  categories.forEach((category) => {
    if (!category.tools.length) return;

    const categoryEl = document.createElement('div');
    categoryEl.className = 'tool-manager-category';

    const titleEl = document.createElement('div');
    titleEl.className = 'tool-manager-category-title';
    titleEl.textContent = category.label;
    categoryEl.appendChild(titleEl);

    category.tools.forEach((tool) => {
      const row = document.createElement('div');
      row.className = 'tool-manager-item';

      const name = document.createElement('div');
      name.className = 'tool-manager-name';
      name.textContent = tool.name;
      row.appendChild(name);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'tool-manager-delete';
      deleteBtn.textContent = msg('deleteToolButton');
      deleteBtn.addEventListener('click', async () => {
        try {
          await deleteToolFromStorage(category.id, tool.id);
          toolManagerStatus.textContent = msg('toolDeleted');
          toolManagerStatus.style.display = 'block';
          await renderToolManager();
        } catch {
          toolManagerStatus.textContent = msg('toolDeleteFailed');
          toolManagerStatus.style.display = 'block';
        }
      });
      row.appendChild(deleteBtn);

      categoryEl.appendChild(row);
    });

    toolManagerList.appendChild(categoryEl);
  });

  toolManagerActions.style.display = 'flex';
}

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveWorkspaceState();
  }, 400);
}

function showMain() {
  mainView.style.display = 'block';
  historyView.style.display = 'none';
  statsView.style.display = 'none';
  faqView.style.display = 'none';
  workspaceView.style.display = 'none';
}

function showHistory() {
  mainView.style.display = 'none';
  historyView.style.display = 'block';
  statsView.style.display = 'none';
  faqView.style.display = 'none';
  workspaceView.style.display = 'none';
}

function showStats() {
  mainView.style.display = 'none';
  historyView.style.display = 'none';
  statsView.style.display = 'block';
  faqView.style.display = 'none';
  workspaceView.style.display = 'none';
}

function showFaq() {
  mainView.style.display = 'none';
  historyView.style.display = 'none';
  statsView.style.display = 'none';
  faqView.style.display = 'block';
  workspaceView.style.display = 'none';
}

function showWorkspace() {
  mainView.style.display = 'none';
  historyView.style.display = 'none';
  statsView.style.display = 'none';
  faqView.style.display = 'none';
  workspaceView.style.display = 'block';
}

function buildOptionsUI(tool: ToolDef, overrideValues?: Record<string, string>) {
  toolOptionsContainer.innerHTML = '';
  currentOptions = {};
  updateToolOptionsVisibility();

  if (!tool.options || tool.options.length === 0) return;

  tool.options.forEach((opt) => {
    const overriddenVal = overrideValues?.[opt.id];
    const resolvedDefault = opt.id === TARGET_LANGUAGE_OPTION_ID && opt.type === 'select' && opt.options
      ? resolveInitialTargetLanguage(opt.options, opt.default)
      : opt.default ?? '';
    currentOptions[opt.id] = overriddenVal ?? resolvedDefault;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:0.2rem;';

    const controlId = `tool-option-${tool.id}-${opt.id}`;
    const label = document.createElement('label');
    label.htmlFor = controlId;
    label.textContent = opt.label;
    label.style.cssText = 'font-size:0.82rem; color:var(--muted);';
    wrap.appendChild(label);

    if (opt.type === 'select' && opt.options) {
      const select = document.createElement('select');
      select.id = controlId;
      select.style.cssText = 'padding:8px; border-radius:6px; background:var(--bg); color:var(--text); border:1px solid var(--border);';
      opt.options.forEach((val) => {
        const optionEl = document.createElement('option');
        optionEl.value = val;
        optionEl.textContent = val;
        if (val === currentOptions[opt.id]) optionEl.selected = true;
        select.appendChild(optionEl);
      });
      select.addEventListener('change', (e) => {
        const nextValue = (e.target as HTMLSelectElement).value;
        currentOptions[opt.id] = nextValue;
        if (opt.id === TARGET_LANGUAGE_OPTION_ID) {
          void setLastUsedTargetLanguage(nextValue);
        }
        updateGeneratedToolAction();
        void saveWorkspaceState();
      });
      wrap.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.id = controlId;
      input.type = 'text';
      input.value = currentOptions[opt.id];
      input.style.cssText = 'padding:8px; border-radius:6px; background:var(--bg); color:var(--text); border:1px solid var(--border);';
      input.addEventListener('input', (e) => {
        currentOptions[opt.id] = (e.target as HTMLInputElement).value;
        updateGeneratedToolAction();
        debouncedSave();
      });
      wrap.appendChild(input);
    }

    toolOptionsContainer.appendChild(wrap);
  });

  updateToolOptionsVisibility();
}

function openWorkspace(
  tool: ToolDef,
  input: string,
  result: string,
  options: Record<string, string>,
  stagedContent = '',
  stagedOpen = false,
  runRequestId: string | null = null
) {
  activeTool = tool;
  toolManagerOpen = false;
  toolDescriptionOpen = false;
  activeRunRequestId = runRequestId;
  activeRequestId = null;
  activeRunStartedAt = null;
  workspaceTitle.textContent = [tool.icon, tool.name].filter(Boolean).join(' ');
  workspaceSubtitle.textContent = buildToolRuntimeHint(tool);
  workspaceSubtitle.title = workspaceSubtitle.textContent;
  workspaceStatus.textContent = '';
  setResultHint('');
  buildOptionsUI(tool, options);
  updateInputUI(input);
  stagedContentEl.value = stagedContent;
  setStagedSectionOpen(stagedOpen);
  showWorkspace();
  updateResultUI(result);
  updateRunMeta(null, null);
  setRunningState(false);
  btnSaveGeneratedTool.textContent = msg('saveGeneratedToolButton');
  btnSaveGeneratedTool.title = msg('generatedToolSaveTitle');
  toolManagerStatus.style.display = 'none';
  toolManagerStatus.textContent = '';
  updateToolDescriptionVisibility();
  updateToolManagerVisibility();
}

function applyRunState(runState: ActiveRunState): void {
  if (!activeTool || runState.toolId !== activeTool.id) return;
  if (!activeRunRequestId || runState.requestId !== activeRunRequestId) return;

  activeRunRequestId = runState.requestId;
  activeRunStartedAt = new Date(runState.startedAt);
  updateResultUI(runState.result);
  updateRunMeta(
    new Date(runState.startedAt),
    typeof runState.finishedAt === 'number' ? new Date(runState.finishedAt) : null
  );

  if (runState.status === 'running') {
    activeRequestId = runState.requestId;
    activeRunRequestId = runState.requestId;
    setRunningState(true);
    workspaceStatus.textContent = runState.currentStepName
      ? msg('runningStep', [runState.currentStepName, String(runState.stepIndex), String(runState.stepCount)])
      : msg('running');
    setResultHint(runState.result ? msg('partialHint') : '', '#f59e0b');
    return;
  }

  activeRequestId = null;
  activeRunRequestId = null;
  setRunningState(false);

  if (runState.status === 'completed') {
    const changed = runState.result.trim() !== workspaceInput.value.trim();
    workspaceStatus.textContent = runState.stepCount > 1 ? msg('completedSteps', String(runState.stepCount)) : '';
    setResultHint(changed ? msg('modifiedHint') : msg('noChangesHint'), changed ? '#10b981' : 'var(--muted)');
    return;
  }

  if (runState.status === 'aborted') {
    workspaceStatus.textContent = msg('aborted');
  } else {
    workspaceStatus.textContent = msg('errorPrefix', runState.error || msg('unknownError'));
  }

  if (runState.result) {
    setResultHint(msg('partialHint'), '#f59e0b');
  } else {
    setResultHint('');
  }
}

async function openSidePanel(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const response = await chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    windowId: tab?.windowId
  });

  if (!response?.success) {
    throw new Error(response?.error || msg('failedOpenSidePanel'));
  }
}

async function closeSidePanel(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const response = await chrome.runtime.sendMessage({
    type: 'CLOSE_SIDE_PANEL',
    windowId: tab?.windowId
  });

  if (!response?.success) {
    throw new Error(response?.error || msg('failedCloseSidePanel'));
  }
}

function setPopupLocked(locked: boolean): void {
  if (!isPopupSurface) return;

  const changed = popupLocked !== locked;
  popupLocked = locked;
  surfaceLockBanner.style.display = locked ? 'block' : 'none';
  sidePanelLockToggle.checked = locked;
  if (locked) {
    mainView.style.display = 'none';
    historyView.style.display = 'none';
    statsView.style.display = 'none';
    faqView.style.display = 'none';
    workspaceView.style.display = 'none';
    return;
  }

  if (changed) {
    window.location.reload();
  }
}

async function refreshPopupLockState(): Promise<void> {
  if (!isPopupSurface) return;
  const stored = await chrome.storage.local.get(SURFACE_LOCK_STORAGE_KEY) as { uiSurfaceLock?: unknown };
  let lockState = normalizeSurfaceLockState(stored[SURFACE_LOCK_STORAGE_KEY]);

  const runtimeWithContexts = chrome.runtime as typeof chrome.runtime & {
    getContexts?: (filter: { contextTypes: string[] }) => Promise<Array<{ contextType?: string }>>;
  };

  if (lockState && runtimeWithContexts.getContexts) {
    try {
      const contexts = await runtimeWithContexts.getContexts({ contextTypes: ['SIDE_PANEL'] });
      if (!contexts.length) {
        await chrome.storage.local.remove(SURFACE_LOCK_STORAGE_KEY);
        lockState = null;
      }
    } catch {
      // ignore unsupported or transient getContexts failures and fall back to storage state
    }
  }

  setPopupLocked(Boolean(lockState));
}

function connectSidePanelHeartbeat(): void {
  if (!isSidePanelSurface || !sidePanelSessionId || sidePanelPort) return;
  sidePanelPort = chrome.runtime.connect({ name: `${SIDE_PANEL_PORT_PREFIX}${sidePanelSessionId}` });
}

function buildToolRuntimeHint(tool: ToolDef): string {
  const steps = getToolSteps(tool);
  const providers = [...new Set(steps.map((step) => step.provider || 'default'))];
  const models = [...new Set(steps.map((step) => step.model || 'default'))];
  const providerLabel = providers.length === 1 ? providers[0] : providers.join(', ');
  const modelLabel = models.length === 1 ? models[0] : models.join(', ');
  return msg('providerRuntimeHint', [providerLabel, modelLabel]);
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return msg('timeNow');
  if (diff < 3_600_000) return msg('timeMinutesAgo', String(Math.floor(diff / 60_000)));
  if (diff < 86_400_000) return msg('timeHoursAgo', String(Math.floor(diff / 3_600_000)));
  return new Date(ts).toLocaleDateString();
}

function averagePerRun(total: number, runs: number): string {
  if (!runs) return '0';
  return (total / runs).toFixed(1);
}

function renderHistoryView(entries: HistoryEntry[]) {
  const list = document.getElementById('history-list') as HTMLDivElement;
  list.innerHTML = '';

  if (!entries.length) {
    list.innerHTML = `<p style="color:var(--muted); font-size:0.85rem; text-align:center; margin-top:2rem;">${msg('noHistoryYet')}</p>`;
    return;
  }

  entries.forEach((entry) => {
    const tool = activeToolIndex.get(entry.toolId);
    const toolName = tool?.name ?? entry.toolName;
    const toolIcon = tool?.icon ?? entry.toolIcon;
    const truncate = (s: string, n: number) => {
      const normalized = s.replace(/\n+/g, ' ');
      return normalized.length > n ? `${normalized.slice(0, n)}…` : normalized;
    };

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-header">
        <span class="history-tool">${toolIcon ? `${toolIcon} ` : ''}${toolName}</span>
        <span class="history-time">${formatTime(entry.timestamp)}</span>
      </div>
      <div class="history-input">${truncate(entry.input, 70)}</div>
      <div class="history-result">${truncate(entry.result, 70)}</div>
    `;

    if (tool) {
      item.addEventListener('click', () => {
        previousView = 'history';
        openWorkspace(tool, entry.input, entry.result, entry.options, entry.stagedContent);
      });
    } else {
      item.style.opacity = '0.6';
      item.title = msg('toolNoLongerExists');
    }

    list.appendChild(item);
  });
}

function renderStatsView(entries: HistoryEntry[]) {
  const list = document.getElementById('stats-list') as HTMLDivElement;
  const summary = document.getElementById('stats-summary') as HTMLDivElement;
  list.innerHTML = '';

  if (!entries.length) {
    summary.textContent = msg('noRunsYet');
    list.innerHTML = `<p style="color:var(--muted); font-size:0.85rem; text-align:center; margin-top:2rem;">${msg('noStatsYet')}</p>`;
    return;
  }

  type Aggregate = {
    toolId: string;
    toolName: string;
    toolIcon?: string;
    runs: number;
    runsWithUsage: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    lastRunAt: number;
    lastProviderId?: string;
    lastModel?: string;
  };

  const aggregates = new Map<string, Aggregate>();
  let runsWithUsage = 0;
  let totalTokens = 0;

  for (const entry of entries) {
    const aggregate = aggregates.get(entry.toolId) ?? {
      toolId: entry.toolId,
      toolName: entry.toolName,
      toolIcon: entry.toolIcon,
      runs: 0,
      runsWithUsage: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      lastRunAt: entry.timestamp,
      lastProviderId: entry.providerId,
      lastModel: entry.model
    };

    aggregate.runs += 1;
    if (entry.usage) {
      aggregate.inputTokens += entry.usage.inputTokens || 0;
      aggregate.outputTokens += entry.usage.outputTokens || 0;
      aggregate.totalTokens += entry.usage.totalTokens || 0;
      if (entry.usage.totalTokens || entry.usage.inputTokens || entry.usage.outputTokens) {
        aggregate.runsWithUsage += 1;
        runsWithUsage += 1;
        totalTokens += entry.usage.totalTokens || 0;
      }
    }
    if (entry.timestamp >= aggregate.lastRunAt) {
      aggregate.lastRunAt = entry.timestamp;
      aggregate.lastProviderId = entry.providerId;
      aggregate.lastModel = entry.model;
    }

    aggregates.set(entry.toolId, aggregate);
  }

  summary.textContent = msg('statsSummary', [
    String(entries.length),
    String(aggregates.size),
    String(runsWithUsage),
    String(totalTokens)
  ]);

  Array.from(aggregates.values())
    .sort((a, b) => b.runs - a.runs || b.totalTokens - a.totalTokens)
    .forEach((aggregate) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-header">
          <span class="history-tool">${aggregate.toolIcon ? `${aggregate.toolIcon} ` : ''}${aggregate.toolName}</span>
          <span class="history-time">${msg('statsRuns', String(aggregate.runs))}</span>
        </div>
        <div class="history-input">${msg('statsLatest', [aggregate.lastProviderId || 'unknown', aggregate.lastModel ? ` / ${aggregate.lastModel}` : '', formatTime(aggregate.lastRunAt)])}</div>
        <div class="history-input">${msg('statsInputTokens', [String(aggregate.inputTokens), averagePerRun(aggregate.inputTokens, aggregate.runsWithUsage)])}</div>
        <div class="history-input">${msg('statsOutputTokens', [String(aggregate.outputTokens), averagePerRun(aggregate.outputTokens, aggregate.runsWithUsage)])}</div>
        <div class="history-result">${msg('statsTotalTokens', String(aggregate.totalTokens))}</div>
      `;
      list.appendChild(item);
    });
}

async function loadCategories(): Promise<Category[]> {
  const res = await chrome.storage.local.get(['customTools', TRANSLATION_LANGUAGES_STORAGE_KEY]) as Record<string, unknown>;
  const translationLanguages = normalizeTranslationLanguages(res[TRANSLATION_LANGUAGES_STORAGE_KEY]);
  await chrome.storage.local.set({ [TRANSLATION_LANGUAGES_STORAGE_KEY]: translationLanguages });
  if (!res.customTools) return injectTranslationLanguageOptions(validateCategories(BUNDLED_CATEGORIES), translationLanguages);

  try {
    return injectTranslationLanguageOptions(
      validateCategories(JSON.parse(res.customTools as string)),
      translationLanguages
    );
  } catch (error) {
    console.warn('Invalid custom tools, falling back to bundled defaults.', error);
    return injectTranslationLanguageOptions(validateCategories(BUNDLED_CATEGORIES), translationLanguages);
  }
}

async function checkApiKey(): Promise<ProviderReadyStatus> {
  const response = await chrome.runtime.sendMessage({ type: 'PROVIDER_READY' });
  if (!response?.success || !isObject(response.data)) {
    return {
      activeProviderId: 'unknown',
      activeProviderReady: false,
      anyProviderReady: false,
      availableProviders: []
    };
  }

  return {
    activeProviderId: typeof response.data.activeProviderId === 'string' ? response.data.activeProviderId : 'unknown',
    activeProviderReady: response.data.activeProviderReady === true,
    anyProviderReady: response.data.anyProviderReady === true,
    availableProviders: Array.isArray(response.data.availableProviders)
      ? response.data.availableProviders.filter((value: unknown): value is string => typeof value === 'string')
      : []
  };
}

async function checkKeystoneSetup(): Promise<KeystoneSetupStatus> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'KEYSTONE_OPEN_SETTINGS' });
    if (!response?.success) {
      return {
        available: false,
        error: typeof response?.error === 'string' ? response.error : 'Keystone unavailable.',
        missingHost: typeof response?.error === 'string' && response.error.includes('Specified native messaging host not found')
      };
    }

    const result = response.data?.result || response.data;
    return {
      available: true,
      adminUrl: typeof result?.url === 'string' ? result.url : undefined
    };
  } catch (error) {
    return {
      available: false,
      error: (error as Error).message,
      missingHost: (error as Error).message.includes('Specified native messaging host not found')
    };
  }
}

function showSetupCard(title: string, body: string, help: string, adminUrl?: string) {
  setupTitleEl.textContent = title;
  setupBodyEl.textContent = body;
  setupHelpEl.textContent = help;
  btnSetupAdmin.style.display = adminUrl ? '' : 'none';
  if (adminUrl) {
    btnSetupAdmin.dataset.url = adminUrl;
  } else {
    delete btnSetupAdmin.dataset.url;
  }
  setupCardEl.style.display = 'block';
}

function hideSetupCard() {
  setupCardEl.style.display = 'none';
}

async function fetchSelection(): Promise<string> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        resolve('');
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          const activeElement = document.activeElement;

          if (activeElement instanceof HTMLTextAreaElement) {
            const start = activeElement.selectionStart ?? 0;
            const end = activeElement.selectionEnd ?? 0;
            return start !== end ? activeElement.value.slice(start, end) : '';
          }

          if (activeElement instanceof HTMLInputElement) {
            const selectableTypes = new Set(['text', 'search', 'url', 'tel', 'email', 'password']);
            if (selectableTypes.has(activeElement.type)) {
              const start = activeElement.selectionStart ?? 0;
              const end = activeElement.selectionEnd ?? 0;
              return start !== end ? activeElement.value.slice(start, end) : '';
            }
          }

          const selection = window.getSelection()?.toString() || '';
          return selection;
        }
      }, (results) => {
        if (chrome.runtime.lastError) {
          resolve('');
          return;
        }

        resolve(typeof results?.[0]?.result === 'string' ? results[0].result : '');
      });
    });
  });
}

async function submitActiveTool(): Promise<void> {
  if (!activeTool) return;

  const targetText = workspaceInput.value.trim();
  if (!targetText) {
    workspaceStatus.textContent = msg('pleaseProvideInput');
    return;
  }

  const requestId = `tool-run-${++requestCounter}`;
  activeRequestId = requestId;
  activeRunRequestId = requestId;
  activeRunStartedAt = new Date();
  updateRunMeta(activeRunStartedAt, null);
  setRunningState(true);
  workspaceStatus.textContent = activeTool.steps && activeTool.steps.length > 1
    ? msg('runningStep', [activeTool.steps[0]?.name || 'step', '1', String(activeTool.steps.length)])
    : msg('running');
  setResultHint('');
  updateResultUI('');
  await saveWorkspaceState();

  try {
    const context = await buildToolRuntimeContext();
    const steps: ToolRunStep[] = getToolSteps(activeTool).map((step) => ({
      id: step.id,
      name: step.name,
      systemPrompt: step.systemPrompt,
      userMessage: step.userMessage,
      temperature: step.temperature,
      model: step.model,
      provider: step.provider
    }));

    const response = await chrome.runtime.sendMessage({
      type: 'RUN_TOOL',
      requestId,
      payload: {
        toolId: activeTool.id,
        toolName: activeTool.name,
        toolIcon: activeTool.icon,
        input: workspaceInput.value,
        stagedContent: stagedContentEl.value.trim(),
        options: { ...currentOptions },
        context,
        stagedOpen: isStagedSectionOpen(),
        steps
      }
    });

    if (!response?.success) {
      throw new Error(response?.error || msg('unknownError'));
    }

    const runState = normalizeActiveRunState(response.data);
    if (runState) {
      applyRunState(runState);
    }
  } catch (error) {
    const message = (error as Error).message;
    updateRunMeta(activeRunStartedAt, new Date());
    activeRequestId = null;
    activeRunRequestId = null;
    activeRunStartedAt = null;
    setRunningState(false);
    workspaceStatus.textContent = /abort/i.test(message) ? msg('aborted') : msg('errorPrefix', message);
    if (workspaceResult.value) {
      setResultHint(msg('partialHint'), '#f59e0b');
    }
  }
}

async function hydrateStoredWorkspace(): Promise<void> {
  const stored = await chrome.storage.local.get([WORKSPACE_STORAGE_KEY, ACTIVE_RUN_STORAGE_KEY]) as {
    workspaceState?: unknown;
    activeRunState?: unknown;
  };
  const state = normalizeWorkspaceState(stored.workspaceState);
  const runState = normalizeActiveRunState(stored.activeRunState);

  if (state) {
    await chrome.storage.local.set({ [WORKSPACE_STORAGE_KEY]: state });
    const tool = activeToolIndex.get(state.toolId);
    if (tool) {
      previousView = 'main';
      openWorkspace(tool, state.input, state.result, state.options, state.stagedContent, state.stagedOpen, state.runRequestId ?? null);
      if (runState && state.runRequestId === runState.requestId) {
        applyRunState(runState);
      }
      return;
    }
  }

  if (runState?.status === 'running') {
    const tool = activeToolIndex.get(runState.toolId);
    if (tool) {
      previousView = 'main';
      openWorkspace(tool, runState.input, runState.result, runState.options, runState.stagedContent, runState.stagedOpen, runState.requestId);
      applyRunState(runState);
      await saveWorkspaceState();
    }
    return;
  }

  if (runState) {
    await clearActiveRunState();
  }
}

async function loadLastUsedTargetLanguage(): Promise<string> {
  const stored = await chrome.storage.local.get(TARGET_LANGUAGE_STORAGE_KEY) as Record<string, unknown>;
  return typeof stored[TARGET_LANGUAGE_STORAGE_KEY] === 'string'
    ? stored[TARGET_LANGUAGE_STORAGE_KEY] as string
    : '';
}

(async function init() {
  ensureLoadingWatchdog();
  localizePage();

  const manifest = chrome.runtime.getManifest();
  (document.getElementById('app-name') as HTMLElement).textContent = manifest.name;
  (document.getElementById('app-version') as HTMLElement).textContent = `v${manifest.version}`;
  (document.getElementById('app-description') as HTMLElement).textContent = manifest.description ?? '';

  if (isSidePanelSurface) {
    btnOpenSidePanel.style.display = 'none';
    surfaceLockBanner.style.display = 'none';
    connectSidePanelHeartbeat();
  } else {
    await refreshPopupLockState();
  }

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    (document.getElementById('current-url') as HTMLElement).textContent = url || '—';
  });

  const providerStatus = await checkApiKey();

  if (!providerStatus.anyProviderReady) {
    const keystoneStatus = await checkKeystoneSetup();
    toolListEl.style.display = 'none';
    showSetupCard(
      msg('providerSetupNeededTitle'),
      msg('providerSetupNeededBody'),
      keystoneStatus.available
        ? msg('providerSetupHelpWithKeystone')
        : msg('providerSetupHelpWithoutKeystone'),
      keystoneStatus.available ? keystoneStatus.adminUrl : undefined
    );
    missingKeyMsg.style.display = 'none';
    missingKeyMsg.innerHTML = msg('missingKeyMsg');
    return;
  }

  hideSetupCard();
  toolListEl.style.display = 'block';
  missingKeyMsg.style.display = 'none';

  preferredTargetLanguage = await loadLastUsedTargetLanguage();
  categoryAutoRun = await loadCategoryAutoRun();
  categoryCollapsed = isPopupSurface ? await loadCategoryCollapsed() : {};
  setCategories(await loadCategories());
  toolListEl.innerHTML = '';

  activeCategories.forEach((category) => {
    if (category.id === 'tooling') {
      return;
    }

    const categoryEl = document.createElement('div');
    categoryEl.className = 'tool-category';

    const categoryLabel = document.createElement('div');
    categoryLabel.className = 'category-label';
    const categoryLabelMain = document.createElement('div');
    categoryLabelMain.className = 'category-label-main';
    const autoRunId = `category-auto-run-${category.id}`;
    const autoRun = document.createElement('input');
    autoRun.type = 'checkbox';
    autoRun.id = autoRunId;
    autoRun.checked = categoryAutoRun[category.id] === true;
    autoRun.title = msg('categoryAutoRunTitle');
    autoRun.addEventListener('change', () => {
      void setCategoryAutoRun(category.id, autoRun.checked);
    });

    const labelText = document.createElement('label');
    labelText.className = 'category-label-text';
    labelText.htmlFor = autoRunId;
    labelText.textContent = category.label;

    categoryLabelMain.appendChild(autoRun);
    categoryLabelMain.appendChild(labelText);
    categoryLabel.appendChild(categoryLabelMain);
    categoryEl.appendChild(categoryLabel);

    const btnGrid = document.createElement('div');
    btnGrid.className = 'tool-btn-grid';
    if (category.flatList) {
      btnGrid.classList.add('flat-list');
    }
    if (isPopupSurface && categoryCollapsed[category.id] === true) {
      btnGrid.classList.add('is-collapsed');
    }

    if (isPopupSurface) {
      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'category-collapse-btn';
      const syncCollapseUi = () => {
        const collapsed = btnGrid.classList.contains('is-collapsed');
        collapseBtn.textContent = collapsed ? msg('expandCategorySymbol') : msg('collapseCategorySymbol');
        collapseBtn.title = collapsed ? msg('expandCategoryTitle') : msg('collapseCategoryTitle');
      };
      syncCollapseUi();
      collapseBtn.addEventListener('click', () => {
        btnGrid.classList.toggle('is-collapsed');
        syncCollapseUi();
        void setCategoryCollapsed(category.id, btnGrid.classList.contains('is-collapsed'));
      });
      categoryLabel.appendChild(collapseBtn);
    }

    category.tools.forEach((tool) => {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      if (category.flatList) {
        btn.classList.add('tool-btn-flat');
      }
      btn.innerHTML = tool.icon ? `<span>${tool.icon}</span> ${tool.name}` : tool.name;

      btn.addEventListener('click', async () => {
        previousView = 'main';
        const selection = await fetchSelection();
        openWorkspace(tool, '', '', {});
        updateInputUI(selection);
        await saveWorkspaceState();
        if (autoRun.checked && selection.trim()) {
          await submitActiveTool();
        }
      });

      btnGrid.appendChild(btn);
    });

    categoryEl.appendChild(btnGrid);
    toolListEl.appendChild(categoryEl);
  });

  await hydrateStoredWorkspace();
})();

stagedToggle.addEventListener('click', () => {
  setStagedSectionOpen(!isStagedSectionOpen());
  void saveWorkspaceState();
});

btnOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

btnOpenSidePanel.addEventListener('click', async () => {
  await openSidePanel();
});

sidePanelLockToggle.addEventListener('change', async () => {
  if (!isPopupSurface) return;

  if (sidePanelLockToggle.checked) {
    await openSidePanel();
    return;
  }

  await closeSidePanel();
});

btnSetupOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

btnSetupAdmin.addEventListener('click', () => {
  const url = btnSetupAdmin.dataset.url;
  if (!url) return;
  window.open(url, '_blank', 'noopener');
});

btnFaq.addEventListener('click', () => showFaq());
btnFaqBack.addEventListener('click', () => showMain());

btnCopyResult.addEventListener('click', () => {
  if (!workspaceResult.value) return;
  void navigator.clipboard.writeText(workspaceResult.value);
  btnCopyResult.textContent = msg('copiedCheckmark');
  setTimeout(() => {
    btnCopyResult.textContent = '📋';
  }, 1500);
});

btnUseResult.addEventListener('click', async () => {
  if (!workspaceResult.value) return;
  updateInputUI(workspaceResult.value);
  setResultHint('');
  await saveWorkspaceState();
});

btnToolDescriptionToggle.addEventListener('click', () => {
  toolDescriptionOpen = !toolDescriptionOpen;
  updateToolDescriptionVisibility();
});

btnToolManagerToggle.addEventListener('click', async () => {
  if (!isToolingWorkspaceActive()) return;
  toolManagerOpen = !toolManagerOpen;
  updateToolManagerVisibility();
  if (toolManagerOpen) {
    await renderToolManager();
  }
});

btnToolManagerReset.addEventListener('click', async () => {
  try {
    await resetToolsToDefault();
    toolManagerStatus.textContent = msg('toolsResetToDefault');
    toolManagerStatus.style.display = 'block';
    await renderToolManager();
  } catch {
    toolManagerStatus.textContent = msg('toolDeleteFailed');
    toolManagerStatus.style.display = 'block';
  }
});

btnSaveGeneratedTool.addEventListener('click', async () => {
  if (!isToolGeneratorActive()) return;

  try {
    await saveGeneratedToolToStorage();
    workspaceStatus.textContent = msg('generatedToolSaved');
    setResultHint(msg('generatedToolSaved'), '#10b981');
    if (toolManagerOpen) {
      await renderToolManager();
    }
    btnSaveGeneratedTool.textContent = '✓';
    btnSaveGeneratedTool.title = msg('generatedToolSaved');
    setTimeout(() => {
      btnSaveGeneratedTool.textContent = msg('saveGeneratedToolButton');
      btnSaveGeneratedTool.title = msg('generatedToolSaveTitle');
      updateGeneratedToolAction();
    }, 1500);
  } catch (error) {
    const message = error instanceof Error ? error.message : msg('generatedToolInvalidConfig');
    workspaceStatus.textContent = message;
    setResultHint(message, '#f59e0b');
  }
});

btnHistory.addEventListener('click', async () => {
  renderHistoryView(await loadHistory());
  showHistory();
});

btnStats.addEventListener('click', async () => {
  renderStatsView(await loadHistory());
  showStats();
});

btnTooling.addEventListener('click', async () => {
  const tool = getToolingTool();
  if (!tool) return;

  previousView = 'main';
  openWorkspace(tool, '', '', {});
  updateInputUI('');
  await saveWorkspaceState();
});

btnHistoryBack.addEventListener('click', () => showMain());
btnStatsBack.addEventListener('click', () => showMain());

btnClearHistory.addEventListener('click', async () => {
  await chrome.storage.local.remove('history');
  renderHistoryView([]);
  renderStatsView([]);
});

btnBack.addEventListener('click', async () => {
  await clearWorkspaceState();
  await clearActiveRunState();
  activeTool = null;
  activeRequestId = null;
  activeRunRequestId = null;
  activeRunStartedAt = null;
  if (previousView === 'history') {
    renderHistoryView(await loadHistory());
    showHistory();
  } else {
    showMain();
  }
});

btnAppend.addEventListener('click', async () => {
  const selection = await fetchSelection();
  updateInputUI(`${workspaceInput.value}${workspaceInput.value && selection ? '\n\n' : ''}${selection}`);
  await saveWorkspaceState();
});

btnOverride.addEventListener('click', async () => {
  updateInputUI(await fetchSelection());
  await saveWorkspaceState();
});

btnReset.addEventListener('click', async () => {
  updateInputUI('');
  updateResultUI('');
  workspaceStatus.textContent = '';
  setResultHint('');
  await saveWorkspaceState();
});

btnAbort.addEventListener('click', async () => {
  if (!activeRequestId) return;
  btnAbort.disabled = true;
  workspaceStatus.textContent = msg('aborting');
  const response = await chrome.runtime.sendMessage({ type: 'CANCEL_REQUEST', requestId: activeRequestId });
  if (response?.success && response.data === false) {
    btnAbort.disabled = false;
    workspaceStatus.textContent = msg('nothingToAbort');
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  if (changes[ACTIVE_RUN_STORAGE_KEY]) {
    const runState = normalizeActiveRunState(changes[ACTIVE_RUN_STORAGE_KEY].newValue);
    if (runState && activeTool && activeRunRequestId && runState.requestId === activeRunRequestId) {
      applyRunState(runState);
    }
  }

  if (changes[SURFACE_LOCK_STORAGE_KEY] && isPopupSurface) {
    const lockState = normalizeSurfaceLockState(changes[SURFACE_LOCK_STORAGE_KEY].newValue);
    setPopupLocked(Boolean(lockState));
  }
});


workspaceInput.addEventListener('input', () => {
  inputCharCount.textContent = String(workspaceInput.value.length);
  debouncedSave();
});

stagedContentEl.addEventListener('input', () => {
  debouncedSave();
});

btnSubmit.addEventListener('click', async () => {
  await submitActiveTool();
});
