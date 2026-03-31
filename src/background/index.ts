import {
  CompletionResult,
  buildAnthropicPayload,
  buildOpenAiCompatiblePayload,
  CompletionRequest,
  createProvider,
  extractAnthropicText,
  extractAnthropicUsage,
  extractOpenAiCompatibleText,
  extractOpenAiCompatibleUsage,
  Provider,
} from '../providers/index.js';
import modelSetsData from '../models.json';
import { ModelSets, validateModelSets } from '../config/index.js';
import { interpolate } from '../tools/index.js';
import {
  BUNDLED_PROVIDERS,
  findProviderConfig,
  getProviderStorageKey,
  ProviderConfig,
  validateProvidersConfig,
} from '../providers/config.js';

const BUNDLED_MODEL_SETS = validateModelSets(modelSetsData);
const KEYSTONE_HOST = __YTXT_KEYSTONE_HOST__;
const KEYSTONE_EXTENSION_NAME = __YTXT_EXTENSION_NAME__;
const ACTIVE_RUN_STORAGE_KEY = 'activeRunState';
const WORKSPACE_STORAGE_KEY = 'workspaceState';
const HISTORY_STORAGE_KEY = 'history';
const SURFACE_LOCK_STORAGE_KEY = 'uiSurfaceLock';
const SIDE_PANEL_PORT_PREFIX = 'ytxt-sidepanel:';

type KeystonePending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

type ProviderKeys = Record<string, string | undefined>;

let MODEL_SETS: ModelSets = BUNDLED_MODEL_SETS;
let currentProviders: ProviderConfig[] = BUNDLED_PROVIDERS;
let currentProviderInstance: Provider | null = null;
let currentProviderId = BUNDLED_PROVIDERS[0]?.id || 'openai';
let currentKeys: ProviderKeys = {};
let configurePromise: Promise<void> | null = null;
let keystonePort: chrome.runtime.Port | null = null;
let keystoneRequestCounter = 0;
const keystonePending = new Map<string, KeystonePending>();
const activeRequestControllers = new Map<string, AbortController>();

interface KeystoneProviderInfo {
  id: string;
  display_name: string;
  configured: boolean;
}

interface KeystoneSessionResult {
  base_url: string;
  token: string;
  provider_id: string;
  allowed_operation: string;
}

interface SecretStoreResult {
  keystoneAvailable: boolean;
  storedProviders: string[];
  errors: string[];
}

interface ProviderReadyStatus {
  activeProviderId: string;
  activeProviderReady: boolean;
  anyProviderReady: boolean;
  availableProviders: string[];
}

interface LlmResponse {
  text: string;
  providerId: string;
  model?: string;
  usage?: CompletionResult['usage'];
  viaKeystone: boolean;
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

interface ToolRunPayload {
  toolId: string;
  toolName: string;
  toolIcon?: string;
  input: string;
  stagedContent: string;
  options: Record<string, string>;
  stagedOpen: boolean;
  steps: ToolRunStep[];
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
  usage?: CompletionResult['usage'];
  error?: string;
}

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
  usage?: CompletionResult['usage'];
  timestamp: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickStringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([, itemValue]) => typeof itemValue === 'string')
  ) as Record<string, string>;
}

function normalizeToolRunStep(value: unknown): ToolRunStep | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (typeof value.systemPrompt !== 'string' || typeof value.userMessage !== 'string') return null;

  return {
    id: value.id,
    name: value.name,
    systemPrompt: value.systemPrompt,
    userMessage: value.userMessage,
    temperature: typeof value.temperature === 'number' ? value.temperature : undefined,
    model: typeof value.model === 'string' ? value.model : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined
  };
}

function normalizeToolRunPayload(value: unknown): ToolRunPayload | null {
  if (!isObject(value)) return null;
  if (typeof value.toolId !== 'string' || typeof value.toolName !== 'string') return null;
  if (typeof value.input !== 'string' || typeof value.stagedContent !== 'string') return null;
  if (!Array.isArray(value.steps)) return null;

  const steps = value.steps
    .map(normalizeToolRunStep)
    .filter((step): step is ToolRunStep => step !== null);

  if (!steps.length) return null;

  return {
    toolId: value.toolId,
    toolName: value.toolName,
    toolIcon: typeof value.toolIcon === 'string' ? value.toolIcon : undefined,
    input: value.input,
    stagedContent: value.stagedContent,
    options: pickStringRecord(value.options),
    stagedOpen: value.stagedOpen === true,
    steps
  };
}

async function persistRunState(runState: ActiveRunState): Promise<void> {
  await chrome.storage.local.set({
    [ACTIVE_RUN_STORAGE_KEY]: runState,
    [WORKSPACE_STORAGE_KEY]: {
      toolId: runState.toolId,
      input: runState.input,
      result: runState.result,
      stagedContent: runState.stagedContent,
      options: runState.options,
      stagedOpen: runState.stagedOpen,
      runRequestId: runState.requestId
    }
  });
}

async function addToHistory(entry: HistoryEntry): Promise<void> {
  const stored = await chrome.storage.local.get(HISTORY_STORAGE_KEY) as { history?: unknown };
  const history = Array.isArray(stored.history) ? stored.history.slice(0, 49) : [];
  history.unshift(entry);
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: history });
}

async function setSidePanelLock(sessionId: string): Promise<void> {
  await chrome.storage.local.set({
    [SURFACE_LOCK_STORAGE_KEY]: {
      owner: 'sidepanel',
      sessionId,
      updatedAt: Date.now()
    }
  });
}

async function clearSidePanelLock(sessionId: string): Promise<void> {
  const stored = await chrome.storage.local.get(SURFACE_LOCK_STORAGE_KEY) as { uiSurfaceLock?: unknown };
  const lock = stored[SURFACE_LOCK_STORAGE_KEY];
  if (
    typeof lock === 'object' &&
    lock !== null &&
    (lock as { owner?: unknown }).owner === 'sidepanel' &&
    (lock as { sessionId?: unknown }).sessionId === sessionId
  ) {
    await chrome.storage.local.remove(SURFACE_LOCK_STORAGE_KEY);
  }
}

function normalizeProviderId(value: unknown): string | null {
  return typeof value === 'string' && Boolean(findProviderConfig(currentProviders, value))
    ? value
    : null;
}

function getProviderConfig(providerId: string): ProviderConfig {
  const provider = findProviderConfig(currentProviders, providerId);
  if (!provider) {
    throw new Error(`Unknown provider "${providerId}".`);
  }
  return provider;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new Error('Request aborted.');
}

async function configureClient() {
  const baseSettings = (await chrome.storage.local.get(
    ['provider', 'customModels', 'customProviders']
  )) as Record<string, string>;

  if (baseSettings.customProviders) {
    try {
      currentProviders = validateProvidersConfig(JSON.parse(baseSettings.customProviders));
    } catch {
      currentProviders = BUNDLED_PROVIDERS;
    }
  } else {
    currentProviders = BUNDLED_PROVIDERS;
  }

  const providerStorageKeys = currentProviders.map((provider) => getProviderStorageKey(provider.id));
  const settings = (await chrome.storage.local.get([
    'provider',
    'customModels',
    ...providerStorageKeys
  ])) as Record<string, string>;

  if (settings.customModels) {
    try {
      MODEL_SETS = validateModelSets(JSON.parse(settings.customModels));
    } catch {
      MODEL_SETS = BUNDLED_MODEL_SETS;
    }
  } else {
    MODEL_SETS = BUNDLED_MODEL_SETS;
  }

  const normalizedProvider = normalizeProviderId(settings.provider) || currentProviders[0]?.id || 'openai';
  if (settings.provider !== normalizedProvider) {
    await chrome.storage.local.set({ provider: normalizedProvider });
  }
  currentProviderId = normalizedProvider;

  currentKeys = Object.fromEntries(
    currentProviders.map((provider) => [getProviderStorageKey(provider.id), settings[getProviderStorageKey(provider.id)]])
  );

  const currentProviderConfig = findProviderConfig(currentProviders, currentProviderId);
  currentProviderInstance = currentProviderConfig
    ? createProvider(currentProviderConfig, currentKeys)
    : null;
}

function ensureConfigured(): Promise<void> {
  if (!configurePromise) {
    configurePromise = configureClient();
  }
  return configurePromise;
}

function resolveModel(
  providerId: string,
  modelRef: string | undefined
): { providerId: string; model: string | undefined; temperature: number | null | undefined } {
  const key = modelRef || 'default';
  const set = MODEL_SETS[key];
  if (!set) return { providerId, model: modelRef, temperature: undefined };

  const entry = set[providerId];
  if (!entry) {
    throw new Error(`Model set "${key}" does not define an entry for provider "${providerId}".`);
  }
  if (typeof entry === 'string') return { providerId, model: entry, temperature: undefined };

  return { providerId, model: entry.model, temperature: entry.temperature };
}

function rejectAllKeystonePending(message: string) {
  const error = new Error(message);
  for (const pending of keystonePending.values()) {
    pending.reject(error);
  }
  keystonePending.clear();
}

function attachKeystonePort(port: chrome.runtime.Port) {
  port.onMessage.addListener((message) => {
    const id = typeof message?.id === 'string' ? message.id : String(message?.id ?? '');
    const pending = keystonePending.get(id);
    if (!pending) return;

    keystonePending.delete(id);
    if (message?.error?.message) {
      pending.reject(new Error(message.error.message));
      return;
    }
    pending.resolve(message?.result ?? message);
  });

  port.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message || 'Keystone disconnected.';
    keystonePort = null;
    rejectAllKeystonePending(error);
  });
}

function getKeystonePort(): chrome.runtime.Port {
  if (keystonePort) return keystonePort;
  keystonePort = chrome.runtime.connectNative(KEYSTONE_HOST);
  attachKeystonePort(keystonePort);
  return keystonePort;
}

function callKeystone(method: string, params: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = `keystone-${++keystoneRequestCounter}`;
    keystonePending.set(id, { resolve, reject });

    try {
      const port = getKeystonePort();
      port.postMessage({ id, method, params });
    } catch (error) {
      keystonePending.delete(id);
      reject(error as Error);
    }
  });
}

async function keystoneHello() {
  return await callKeystone('bridge.hello', {
    protocol_version: '1.0',
    extension_name: KEYSTONE_EXTENSION_NAME
  });
}

async function ensureKeystonePairing() {
  const hello = await keystoneHello();
  if (hello?.pairing_status === 'paired') return hello;

  await callKeystone('bridge.pair', {
    extension_name: KEYSTONE_EXTENSION_NAME,
    requested_providers: currentProviders.map((provider) => provider.id)
  });

  return await keystoneHello();
}

async function listKeystoneProviders(): Promise<KeystoneProviderInfo[]> {
  await ensureKeystonePairing();
  const result = await callKeystone('vault.list_providers', {});
  return Array.isArray(result?.providers) ? result.providers : [];
}

async function isKeystoneConfigured(providerId: string): Promise<boolean> {
  try {
    const providers = await listKeystoneProviders();
    return providers.some((provider) => provider.id === providerId && provider.configured);
  } catch {
    return false;
  }
}

async function openKeystoneSession(
  providerId: string,
  operation: 'chat.completions' | 'messages'
): Promise<KeystoneSessionResult> {
  await ensureKeystonePairing();
  return await callKeystone('llm.open_session', {
    provider_id: providerId,
    operation
  }) as KeystoneSessionResult;
}

async function fetchViaKeystone(path: string, token: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Keystone upstream request failed (${response.status}): ${details}`);
  }

  return await response.json();
}

async function tryKeystoneCompletion(
  providerConfig: ProviderConfig,
  request: CompletionRequest,
  signal?: AbortSignal
): Promise<CompletionResult | null> {
  throwIfAborted(signal);
  if (!(await isKeystoneConfigured(providerConfig.id))) {
    return null;
  }

  throwIfAborted(signal);
  if (providerConfig.type === 'anthropic') {
    const session = await openKeystoneSession(providerConfig.id, 'messages');
    throwIfAborted(signal);
    const payload = buildAnthropicPayload(request, request.modelOverride || providerConfig.defaultModel);
    const data = await fetchViaKeystone(`${session.base_url}/v1/messages`, session.token, payload, signal);
    return {
      text: extractAnthropicText(data),
      usage: extractAnthropicUsage(data)
    };
  }

  const session = await openKeystoneSession(providerConfig.id, 'chat.completions');
  throwIfAborted(signal);
  const payload = buildOpenAiCompatiblePayload(
    request,
    request.modelOverride || providerConfig.defaultModel,
    providerConfig.systemMode || 'system'
  );
  const data = await fetchViaKeystone(`${session.base_url}/v1/chat/completions`, session.token, payload, signal);
  return {
    text: extractOpenAiCompatibleText(data),
    usage: extractOpenAiCompatibleUsage(data)
  };
}

async function localProviderHasKey(providerId: string): Promise<boolean> {
  return Boolean(currentKeys[getProviderStorageKey(providerId)]);
}

async function providerReady(providerId: string): Promise<boolean> {
  if (await isKeystoneConfigured(providerId)) return true;
  return await localProviderHasKey(providerId);
}

async function listAvailableProviders(): Promise<string[]> {
  const availableProviders: string[] = [];

  for (const provider of currentProviders) {
    if (await providerReady(provider.id)) {
      availableProviders.push(provider.id);
    }
  }

  return availableProviders;
}

async function persistDefaultProvider(providerId: string): Promise<void> {
  currentProviderId = providerId;
  const providerConfig = findProviderConfig(currentProviders, providerId);
  currentProviderInstance = providerConfig ? createProvider(providerConfig, currentKeys) : null;
  await chrome.storage.local.set({ provider: providerId });
}

async function resolveDefaultProvider(): Promise<ProviderConfig> {
  const availableProviders = await listAvailableProviders();
  if (availableProviders.includes(currentProviderId)) {
    return getProviderConfig(currentProviderId);
  }

  const fallbackProviderId = availableProviders[0] || currentProviders[0]?.id;
  if (!fallbackProviderId) {
    throw new Error('No providers are configured.');
  }

  if (fallbackProviderId !== currentProviderId) {
    await persistDefaultProvider(fallbackProviderId);
  }

  return getProviderConfig(fallbackProviderId);
}

async function providerReadyStatus(): Promise<ProviderReadyStatus> {
  const availableProviders = await listAvailableProviders();
  const resolvedDefaultProviderId = availableProviders.includes(currentProviderId)
    ? currentProviderId
    : (availableProviders[0] || currentProviderId);

  if (resolvedDefaultProviderId && resolvedDefaultProviderId !== currentProviderId) {
    await persistDefaultProvider(resolvedDefaultProviderId);
  }

  return {
    activeProviderId: resolvedDefaultProviderId,
    activeProviderReady: availableProviders.includes(resolvedDefaultProviderId),
    anyProviderReady: availableProviders.length > 0,
    availableProviders
  };
}

async function storeSecretsInKeystone(secrets: Record<string, string>): Promise<SecretStoreResult> {
  try {
    await ensureKeystonePairing();
  } catch (error) {
    return {
      keystoneAvailable: false,
      storedProviders: [],
      errors: [(error as Error).message]
    };
  }

  const storedProviders: string[] = [];
  const errors: string[] = [];

  for (const provider of currentProviders) {
    const secret = secrets[provider.id]?.trim();
    if (!secret) continue;

    try {
      await callKeystone('vault.set_secret', {
        provider: provider.id,
        secret
      });
      storedProviders.push(provider.id);
    } catch (error) {
      errors.push(`${provider.id}: ${(error as Error).message}`);
    }
  }

  return {
    keystoneAvailable: true,
    storedProviders,
    errors
  };
}

async function clearKeystoneSecret(providerId: string): Promise<void> {
  try {
    await ensureKeystonePairing();
    await callKeystone('vault.delete_secret', { provider: providerId });
  } catch {
    // ignore missing Keystone during local fallback cleanup
  }
}

async function executeToolRun(
  requestId: string,
  payload: ToolRunPayload,
  signal?: AbortSignal
): Promise<ActiveRunState> {
  const startedAt = Date.now();
  const stepCount = payload.steps.length;
  const stepOutputs: Record<string, string> = {};
  let currentInput = payload.input;
  let lastResponse: LlmResponse | null = null;

  let runState: ActiveRunState = {
    requestId,
    toolId: payload.toolId,
    toolName: payload.toolName,
    toolIcon: payload.toolIcon,
    input: payload.input,
    result: '',
    stagedContent: payload.stagedContent,
    options: payload.options,
    stagedOpen: payload.stagedOpen,
    status: 'running',
    startedAt,
    stepIndex: 1,
    stepCount,
    currentStepName: payload.steps[0]?.name
  };

  await persistRunState(runState);

  try {
    for (let stepIndex = 0; stepIndex < payload.steps.length; stepIndex += 1) {
      throwIfAborted(signal);
      const step = payload.steps[stepIndex];

      runState = {
        ...runState,
        status: 'running',
        stepIndex: stepIndex + 1,
        currentStepName: step.name
      };
      await persistRunState(runState);

      const vars = {
        ...payload.options,
        ...stepOutputs,
        input: currentInput,
        previous: currentInput,
        originalInput: payload.input
      };

      const response = await handleLLMRequest({
        systemPrompt: interpolate(step.systemPrompt, vars),
        userMessage: interpolate(step.userMessage, vars),
        temperature: step.temperature,
        modelOverride: step.model,
        providerOverride: step.provider,
        stagedContent: payload.stagedContent
      }, signal);

      stepOutputs[step.id] = response.text;
      currentInput = response.text;
      lastResponse = response;

      runState = {
        ...runState,
        result: currentInput,
        providerId: response.providerId,
        model: response.model,
        usage: response.usage
      };
      await persistRunState(runState);
    }

    runState = {
      ...runState,
      status: 'completed',
      result: currentInput,
      finishedAt: Date.now(),
      providerId: lastResponse?.providerId,
      model: lastResponse?.model,
      usage: lastResponse?.usage
    };
    await persistRunState(runState);

    await addToHistory({
      toolId: payload.toolId,
      toolName: payload.toolName,
      toolIcon: payload.toolIcon,
      providerId: lastResponse?.providerId,
      model: lastResponse?.model,
      input: payload.input,
      result: currentInput,
      stagedContent: payload.stagedContent,
      options: payload.options,
      usage: lastResponse?.usage,
      timestamp: Date.now()
    });

    return runState;
  } catch (error) {
    const message = (error as Error).message;
    runState = {
      ...runState,
      status: /abort/i.test(message) ? 'aborted' : 'error',
      result: currentInput,
      finishedAt: Date.now(),
      providerId: lastResponse?.providerId,
      model: lastResponse?.model,
      usage: lastResponse?.usage,
      error: message
    };
    await persistRunState(runState);
    throw error;
  }
}

configurePromise = configureClient();

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith(SIDE_PANEL_PORT_PREFIX)) return;

  const sessionId = port.name.slice(SIDE_PANEL_PORT_PREFIX.length);
  if (!sessionId) return;

  void setSidePanelLock(sessionId);

  port.onDisconnect.addListener(() => {
    void clearSidePanelLock(sessionId);
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'OPEN_SIDE_PANEL') {
    const options = {} as chrome.sidePanel.OpenOptions;
    if (typeof request.windowId === 'number') {
      options.windowId = request.windowId;
    }

    chrome.sidePanel.open(options)
      .then(() => sendResponse({ success: true }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'CLOSE_SIDE_PANEL') {
    const sidePanelApi = chrome.sidePanel as typeof chrome.sidePanel & {
      close?: (options: chrome.sidePanel.CloseOptions) => Promise<void>;
    };

    if (!sidePanelApi.close) {
      sendResponse({ success: false, error: 'This browser does not support programmatic side panel closing.' });
      return false;
    }

    const options = {} as chrome.sidePanel.CloseOptions;
    if (typeof request.windowId === 'number') {
      options.windowId = request.windowId;
    }

    sidePanelApi.close(options)
      .then(() => sendResponse({ success: true }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'KEYSTONE_HELLO') {
    keystoneHello()
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'KEYSTONE_OPEN_SETTINGS') {
    callKeystone('bridge.open_settings', {})
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'KEYSTONE_PROVIDER_STATUS') {
    listKeystoneProviders()
      .then((providers) => sendResponse({ success: true, data: providers }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'STORE_PROVIDER_SECRETS') {
    storeSecretsInKeystone(request.payload || {})
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'CLEAR_PROVIDER_SECRET') {
    if (typeof request.providerId !== 'string' || !findProviderConfig(currentProviders, request.providerId)) {
      sendResponse({ success: false, error: 'Unknown provider.' });
      return false;
    }

    clearKeystoneSecret(request.providerId)
      .then(() => sendResponse({ success: true }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'CANCEL_REQUEST') {
    const requestId = typeof request.requestId === 'string' ? request.requestId : '';
    const controller = activeRequestControllers.get(requestId);
    if (!controller) {
      sendResponse({ success: true, data: false });
      return false;
    }

    controller.abort();
    sendResponse({ success: true, data: true });
    return false;
  }

  if (request.type === 'PROVIDER_READY') {
    ensureConfigured()
      .then(() => providerReadyStatus())
      .then((status) => sendResponse({ success: true, data: status }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'SETTINGS_UPDATED') {
    configurePromise = configureClient();
    configurePromise
      .then(() => sendResponse({ success: true }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'LLM_REQUEST') {
    ensureConfigured()
      .then(() => {
        const requestId = typeof request.requestId === 'string' ? request.requestId : `request-${Date.now()}`;
        const controller = new AbortController();
        activeRequestControllers.set(requestId, controller);

        return handleLLMRequest(request.payload, controller.signal)
          .finally(() => {
            activeRequestControllers.delete(requestId);
          });
      })
      .then(result => sendResponse({ success: true, data: result }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));

    return true;
  }

  if (request.type === 'RUN_TOOL') {
    ensureConfigured()
      .then(async () => {
        const requestId = typeof request.requestId === 'string' ? request.requestId : `tool-run-${Date.now()}`;
        const payload = normalizeToolRunPayload(request.payload);
        if (!payload) {
          throw new Error('Invalid tool run payload.');
        }

        const controller = new AbortController();
        activeRequestControllers.set(requestId, controller);

        return await executeToolRun(requestId, payload, controller.signal)
          .finally(() => {
            activeRequestControllers.delete(requestId);
          });
      })
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));

    return true;
  }

  return false;
});

async function handleLLMRequest(payload: any, signal?: AbortSignal): Promise<LlmResponse> {
  const { systemPrompt, userMessage, temperature: toolTemperature, modelOverride, providerOverride, stagedContent } = payload;
  const effectiveProviderConfig = normalizeProviderId(providerOverride)
    ? getProviderConfig(providerOverride)
    : await resolveDefaultProvider();
  const resolved = resolveModel(effectiveProviderConfig.id, modelOverride);
  const resolvedProviderConfig = getProviderConfig(resolved.providerId);

  const effectiveTemperature: number | undefined =
    resolved.temperature === null ? undefined
    : resolved.temperature !== undefined ? resolved.temperature
    : toolTemperature;

  const request: CompletionRequest = {
    systemPrompt,
    userMessage,
    temperature: effectiveTemperature,
    modelOverride: resolved.model,
    stagedContent
  };

  const viaKeystone = await tryKeystoneCompletion(resolvedProviderConfig, request, signal);
  if (viaKeystone !== null) {
    return {
      text: viaKeystone.text,
      usage: viaKeystone.usage,
      providerId: resolved.providerId,
      model: resolved.model,
      viaKeystone: true
    };
  }

  throwIfAborted(signal);
  const providerInstance = resolved.providerId === currentProviderId
    ? currentProviderInstance
    : createProvider(resolvedProviderConfig, currentKeys);

  if (!providerInstance) {
    throw new Error(`No provider credential is configured locally or in Keystone for provider "${resolved.providerId}". Please check options.`);
  }

  const result = await providerInstance.generateCompletion(request, signal);
  return {
    text: result.text,
    usage: result.usage,
    providerId: resolved.providerId,
    model: resolved.model,
    viaKeystone: false
  };
}
