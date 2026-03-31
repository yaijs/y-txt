import { validateCategories, validateModelSets } from '../config/index.js';
import { localizePage, msg } from '../i18n.js';
import modelsBundled from '../models.json';
import {
  BUNDLED_PROVIDERS,
  getProviderStorageKey,
  ProviderConfig,
  validateProvidersConfig,
} from '../providers/config.js';
import toolsBundled from '../tools/tools.json';

const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const providerFieldsEl = document.getElementById('provider-fields') as HTMLDivElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const testKeystoneBtn = document.getElementById('test-keystone-btn') as HTMLButtonElement;
const openKeystoneAdminBtn = document.getElementById('open-keystone-admin-btn') as HTMLButtonElement;
const keystoneStatusEl = document.getElementById('keystone-status') as HTMLDivElement;
const keystoneWarningDetailEl = document.getElementById('keystone-warning-detail') as HTMLParagraphElement;
const keystoneHelpCardEl = document.getElementById('keystone-help-card') as HTMLDivElement;
const keystoneHelpTitleEl = document.getElementById('keystone-help-title') as HTMLHeadingElement;
const keystoneHelpBodyEl = document.getElementById('keystone-help-body') as HTMLParagraphElement;
const keystoneHelpDetailEl = document.getElementById('keystone-help-detail') as HTMLParagraphElement;
const keystoneHelpCommandWrapEl = document.getElementById('keystone-help-command-wrap') as HTMLParagraphElement;
const keystoneHelpCommandTitleEl = document.getElementById('keystone-help-command-title') as HTMLHeadingElement;
const keystoneHelpCommandEl = document.getElementById('keystone-help-command') as HTMLElement;
const keystoneHelpBrowserSelectEl = document.getElementById('keystone-help-browser-select') as HTMLSelectElement;
const keystoneHelpOsSelectEl = document.getElementById('keystone-help-os-select') as HTMLSelectElement;
const keystoneHelpFlavorSelectEl = document.getElementById('keystone-help-flavor-select') as HTMLSelectElement;
const keystoneHelpDirectDownloadEl = document.getElementById('keystone-help-direct-download') as HTMLAnchorElement;
const keystoneHelpHostEl = document.getElementById('keystone-help-host') as HTMLElement;
const keystoneHelpExtensionIdEl = document.getElementById('keystone-help-extension-id') as HTMLElement;
const keystoneHelpActionsEl = document.getElementById('keystone-help-actions') as HTMLDivElement;
const copyKeystoneHelpCommandBtn = document.getElementById('copy-keystone-help-command-btn') as HTMLButtonElement;
const keystoneHelpTerminalHintEl = document.getElementById('keystone-help-terminal-hint') as HTMLParagraphElement;
const keystoneHelpPathNoteEl = document.getElementById('keystone-help-path-note') as HTMLParagraphElement;
const keystoneInstalledPathEl = document.getElementById('keystone-installed-path') as HTMLParagraphElement;
const keystoneInstalledPathValueEl = document.getElementById('keystone-installed-path-value') as HTMLSpanElement;

const toolsTextarea = document.getElementById('tools-config') as HTMLTextAreaElement;
const modelsTextarea = document.getElementById('models-config') as HTMLTextAreaElement;
const providersTextarea = document.getElementById('providers-config') as HTMLTextAreaElement;
const saveToolsBtn = document.getElementById('save-tools-btn') as HTMLButtonElement;
const importToolsBtn = document.getElementById('import-tools-btn') as HTMLButtonElement;
const exportToolsBtn = document.getElementById('export-tools-btn') as HTMLButtonElement;
const resetToolsBtn = document.getElementById('reset-tools-btn') as HTMLButtonElement;
const saveModelsBtn = document.getElementById('save-models-btn') as HTMLButtonElement;
const importModelsBtn = document.getElementById('import-models-btn') as HTMLButtonElement;
const exportModelsBtn = document.getElementById('export-models-btn') as HTMLButtonElement;
const resetModelsBtn = document.getElementById('reset-models-btn') as HTMLButtonElement;
const saveProvidersBtn = document.getElementById('save-providers-btn') as HTMLButtonElement;
const importProvidersBtn = document.getElementById('import-providers-btn') as HTMLButtonElement;
const exportProvidersBtn = document.getElementById('export-providers-btn') as HTMLButtonElement;
const resetProvidersBtn = document.getElementById('reset-providers-btn') as HTMLButtonElement;
const toolsStatusEl = document.getElementById('tools-status') as HTMLDivElement;
const modelsStatusEl = document.getElementById('models-status') as HTMLDivElement;
const providersStatusEl = document.getElementById('providers-status') as HTMLDivElement;
const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;

const bundledTools = validateCategories(toolsBundled);
const bundledModels = validateModelSets(modelsBundled);
const bundledProviders = BUNDLED_PROVIDERS;

let currentProviders: ProviderConfig[] = bundledProviders;
let pendingImportTarget: 'tools' | 'models' | 'providers' | null = null;
let currentPlatformOs = 'unknown';

type KeyLocation = 'none' | 'keystone' | 'local' | 'both';

type ProviderField = {
  provider: ProviderConfig;
  storageKey: string;
  input: HTMLInputElement;
  hasApiKeyBadge: HTMLButtonElement;
  storageBadge: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
};

const providerFields = new Map<string, ProviderField>();

function isProviderId(value: string): boolean {
  return currentProviders.some((provider) => provider.id === value);
}

function updateClearButtonVisibility(button: HTMLButtonElement, hasStoredValue: boolean) {
  button.style.display = hasStoredValue ? '' : 'none';
}

function updateStoredKeyBadge(button: HTMLButtonElement, hasStoredValue: boolean) {
  button.style.display = hasStoredValue ? '' : 'none';
}

function updateStorageBadge(button: HTMLButtonElement, location: KeyLocation) {
  if (location === 'none') {
    button.style.display = 'none';
    return;
  }

  button.style.display = '';
  if (location === 'both') {
    button.textContent = 'keystone,storage';
    button.title = 'Stored in Keystone and browser storage';
    return;
  }
  if (location === 'keystone') {
    button.textContent = 'keystone';
    button.title = 'Stored in Keystone';
    return;
  }
  button.textContent = 'storage';
  button.title = 'Stored in browser storage';
}

async function refreshKeystoneInstalledPath(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'KEYSTONE_STATUS' });
    if (!response?.success) {
      keystoneInstalledPathEl.style.display = 'none';
      keystoneInstalledPathValueEl.textContent = '—';
      return;
    }

    const wrapperPath = typeof response.data?.wrapper_path === 'string' ? response.data.wrapper_path : '';
    const wrapperPresent = response.data?.wrapper_present === true;
    if (!wrapperPath || !wrapperPresent) {
      keystoneInstalledPathEl.style.display = 'none';
      keystoneInstalledPathValueEl.textContent = '—';
      return;
    }

    keystoneInstalledPathValueEl.textContent = wrapperPath;
    keystoneInstalledPathEl.style.display = 'block';
  } catch {
    keystoneInstalledPathEl.style.display = 'none';
    keystoneInstalledPathValueEl.textContent = '—';
  }
}

function attachShowKeyHandler(button: HTMLButtonElement, input: HTMLInputElement) {
  button.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    if (visible) input.classList.remove('key-input');
    else input.classList.add('key-input');
    button.textContent = visible ? '👁' : '🙈';
  });
}

function showStatus(el: HTMLDivElement, message: string, isError = false) {
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
}

function showKeystoneHelpCard(title: string, body: string, detail: string) {
  keystoneHelpTitleEl.textContent = title;
  keystoneHelpBodyEl.textContent = body;
  keystoneHelpDetailEl.textContent = detail;
  keystoneHelpBrowserSelectEl.value = detectBrowserTarget();
  keystoneHelpOsSelectEl.value = currentPlatformOs === 'mac' || currentPlatformOs === 'win' || currentPlatformOs === 'linux'
    ? currentPlatformOs
    : 'linux';
  keystoneHelpFlavorSelectEl.value = keystoneFlavorFromHost();
  keystoneHelpExtensionIdEl.textContent = chrome.runtime.id || 'unknown';
  refreshKeystoneCommandPreview();
  const command = keystoneHelpCommandEl.textContent;
  if (command) {
    keystoneHelpCommandWrapEl.style.display = 'block';
    keystoneHelpActionsEl.style.display = 'flex';
    keystoneHelpPathNoteEl.style.display = 'block';
  } else {
    keystoneHelpCommandEl.textContent = '';
    keystoneHelpCommandWrapEl.style.display = 'none';
    keystoneHelpActionsEl.style.display = 'none';
    keystoneHelpPathNoteEl.style.display = 'none';
  }
  keystoneHelpCardEl.style.display = 'block';
}

function hideKeystoneHelpCard() {
  keystoneHelpCardEl.style.display = 'none';
}

function keystoneFlavorFromHost(): 'dev' | 'beta' | 'prod' {
  if (__YTXT_KEYSTONE_HOST__ === 'com.ytxt.keystone.beta') return 'beta';
  if (__YTXT_KEYSTONE_HOST__ === 'com.ytxt.keystone') return 'prod';
  return 'dev';
}

function detectBrowserTarget(): 'chrome' | 'chromium' | 'opera' | 'vivaldi' | 'brave' {
  const ua = navigator.userAgent;
  const navigatorWithBrave = navigator as Navigator & { brave?: unknown };
  if (ua.includes('Vivaldi')) return 'vivaldi';
  if (ua.includes('OPR/')) return 'opera';
  if (navigatorWithBrave.brave || ua.includes('Brave')) return 'brave';
  return 'chrome';
}

function buildKeystoneInstallCommand(): string {
  const extensionId = chrome.runtime.id;
  if (!extensionId) return '';
  const os = keystoneHelpOsSelectEl.value || currentPlatformOs;
  const browserTarget = keystoneHelpBrowserSelectEl.value || detectBrowserTarget();
  const flavor = keystoneHelpFlavorSelectEl.value || keystoneFlavorFromHost();
  if (os === 'linux') {
    return `./install-keystone-linux.sh ${browserTarget} ${flavor} ${extensionId}`;
  }
  return '';
}

function pathNoteForOs(os: string): string {
  if (os === 'linux') {
    return msg('keystonePathNoteLinux');
  }
  return msg('keystonePathNoteFallback');
}

function terminalHintForOs(os: string): string {
  if (os === 'linux') {
    return msg('keystoneTerminalHintLinux');
  }
  return msg('keystoneTerminalHintFallback');
}

function keystoneArtifactFilenameForOs(os: string): string {
  if (os === 'mac') return 'keystone-macos-x86_64.tar.gz';
  if (os === 'win') return 'keystone-windows-x86_64.zip';
  return 'keystone-linux-x86_64.tar.gz';
}

function keystoneArtifactUrlForOs(os: string): string {
  const filename = keystoneArtifactFilenameForOs(os);
  return `https://github.com/yaijs/keystone/releases/latest/download/${filename}`;
}

function refreshKeystoneCommandPreview() {
  const os = keystoneHelpOsSelectEl.value || currentPlatformOs;
  const flavor = keystoneHelpFlavorSelectEl.value || keystoneFlavorFromHost();
  const command = buildKeystoneInstallCommand();
  keystoneHelpCommandEl.textContent = command;
  keystoneHelpCommandTitleEl.textContent = os === 'linux'
    ? msg('keystoneConnectTerminalLinux')
    : msg('keystoneConnectTerminalFallback');
  keystoneHelpHostEl.textContent = hostIdForFlavor(flavor);
  keystoneHelpTerminalHintEl.textContent = terminalHintForOs(os);
  keystoneHelpPathNoteEl.textContent = pathNoteForOs(os);
  const artifactFilename = keystoneArtifactFilenameForOs(os);
  keystoneHelpDirectDownloadEl.href = keystoneArtifactUrlForOs(os);
  keystoneHelpDirectDownloadEl.textContent = msg('keystoneDirectDownload', artifactFilename);
}

function hostIdForFlavor(flavor: string): string {
  if (flavor === 'beta') return 'com.ytxt.keystone.beta';
  if (flavor === 'prod') return 'com.ytxt.keystone';
  return 'com.ytxt.keystone.dev';
}

copyKeystoneHelpCommandBtn.addEventListener('click', async () => {
  const command = keystoneHelpCommandEl.textContent?.trim();
  if (!command) return;
  await navigator.clipboard.writeText(command);
  showStatus(keystoneStatusEl, msg('copiedKeystoneInstallCommand'));
});

keystoneHelpBrowserSelectEl.addEventListener('change', () => {
  refreshKeystoneCommandPreview();
});

keystoneHelpOsSelectEl.addEventListener('change', () => {
  refreshKeystoneCommandPreview();
});

keystoneHelpFlavorSelectEl.addEventListener('change', () => {
  refreshKeystoneCommandPreview();
});

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function openImportDialog(target: 'tools' | 'models' | 'providers') {
  pendingImportTarget = target;
  importFileInput.value = '';
  importFileInput.click();
}

function renderDefaultProviderSelect(selectedProviderId?: string) {
  providerSelect.innerHTML = '';
  currentProviders.forEach((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.label;
    providerSelect.appendChild(option);
  });

  providerSelect.value = isProviderId(selectedProviderId || '') ? selectedProviderId! : (currentProviders[0]?.id || '');
}

function renderProviderFields() {
  providerFields.clear();
  providerFieldsEl.innerHTML = '';

  currentProviders.forEach((provider) => {
    const storageKey = getProviderStorageKey(provider.id);

    const group = document.createElement('div');
    group.className = 'form-group';
    const linksRow = document.createElement('div');
    linksRow.className = 'api-links-row';
    let hasLinksRow = false;

    const label = document.createElement('label');
    label.htmlFor = `${provider.id}-key`;
    label.textContent = `${provider.label} API Key`;
    group.appendChild(label);

    if (provider.apiKeyUrl) {
      const link = document.createElement('a');
      link.className = 'api-link';
      link.href = provider.apiKeyUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = provider.apiKeyUrl.replace(/^https?:\/\//, '') + ' ↗';
      linksRow.appendChild(link);
      hasLinksRow = true;
    }

    if (provider.helpUrl) {
      const helpLink = document.createElement('a');
      helpLink.className = 'api-link';
      helpLink.href = provider.helpUrl;
      helpLink.target = '_blank';
      helpLink.rel = 'noopener';
      helpLink.textContent = msg('providerQuickstartLink');
      linksRow.appendChild(helpLink);
      hasLinksRow = true;
    }

    if (hasLinksRow) {
      group.appendChild(linksRow);
    }

    const keyWrap = document.createElement('div');
    keyWrap.className = 'key-wrap';

    const input = document.createElement('input');
    input.type = 'password';
    input.id = `${provider.id}-key`;
    input.placeholder = msg('replaceStoredKeyPlaceholder');
    keyWrap.appendChild(input);

    const showBtn = document.createElement('button');
    showBtn.type = 'button';
    showBtn.className = 'btn-show-key';
    showBtn.textContent = '👁';
    keyWrap.appendChild(showBtn);
    attachShowKeyHandler(showBtn, input);

    group.appendChild(keyWrap);

    const actions = document.createElement('div');
    actions.className = 'key-actions';

    const hasApiKey = document.createElement('button');
    hasApiKey.type = 'button';
    hasApiKey.className = 'btn-success static-btn';
    hasApiKey.title = msg('providerKeyPresent');
    hasApiKey.setAttribute('aria-label', msg('providerKeyPresent'));
    hasApiKey.textContent = '🔑';
    hasApiKey.style.display = 'none';

    const storageBadge = document.createElement('button');
    storageBadge.type = 'button';
    storageBadge.className = 'btn-neutral static-btn';
    storageBadge.style.display = 'none';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn-reset';
    clearBtn.textContent = msg('clearStoredKey');

    actions.appendChild(hasApiKey);
    actions.appendChild(storageBadge);
    actions.appendChild(clearBtn);
    group.appendChild(actions);

    if (provider.description) {
      const help = document.createElement('div');
      help.className = 'help-box';
      help.textContent = provider.description;
      group.appendChild(help);
    }

    providerFieldsEl.appendChild(group);
    providerFields.set(provider.id, { provider, storageKey, input, hasApiKeyBadge: hasApiKey, storageBadge, clearBtn });
  });
}

async function fetchKeystoneStatus(): Promise<Record<string, boolean>> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'KEYSTONE_PROVIDER_STATUS' });
    if (!response?.success || !Array.isArray(response.data)) {
      return Object.fromEntries(currentProviders.map((provider) => [provider.id, false]));
    }

    const map = Object.fromEntries(currentProviders.map((provider) => [provider.id, false]));
    for (const provider of response.data as Array<{ id?: string; configured?: boolean }>) {
      if (typeof provider.id === 'string' && provider.id in map) {
        map[provider.id] = provider.configured === true;
      }
    }
    return map;
  } catch {
    return Object.fromEntries(currentProviders.map((provider) => [provider.id, false]));
  }
}

async function refreshKeystoneWarning(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'KEYSTONE_HELLO' });
    if (response?.success) {
      hideKeystoneHelpCard();
      keystoneWarningDetailEl.innerHTML = 'Keystone is available. Keep keys there when possible. If you need help reconnecting it later, jump to the <a href="#keystone-card">Keystone section</a>.';
      return;
    }

    const message = typeof response?.error === 'string' ? response.error : '';
    if (message.includes('Specified native messaging host not found')) {
      showKeystoneHelpCard(
        'Keystone Not Found',
        'The Native Messaging host is not installed for this browser right now.',
        'Install the packaged Keystone release first, then run the browser-integration command below and test the connection again.'
      );
    }
  } catch {
    // fall through to fallback text
  }

  keystoneWarningDetailEl.innerHTML = 'Keystone is not currently available, so Y/TXT will fall back to local browser storage. Use low-limit keys and see the <a href="#keystone-card">Keystone section</a> below to reconnect it.';
}

function keyLocation(hasKeystone: boolean, hasLocal: boolean): KeyLocation {
  if (hasKeystone && hasLocal) return 'both';
  if (hasKeystone) return 'keystone';
  if (hasLocal) return 'local';
  return 'none';
}

async function refreshKeyStates(localResult?: Record<string, string>): Promise<void> {
  const localKeys = currentProviders.map((provider) => getProviderStorageKey(provider.id));
  const local = localResult || await chrome.storage.local.get(localKeys) as Record<string, string>;
  const keystone = await fetchKeystoneStatus();

  providerFields.forEach((field, providerId) => {
    const location = keyLocation(Boolean(keystone[providerId]), Boolean(local[field.storageKey]));
    const hasStoredValue = location !== 'none';
    updateStoredKeyBadge(field.hasApiKeyBadge, hasStoredValue);
    updateStorageBadge(field.storageBadge, location);
    updateClearButtonVisibility(field.clearBtn, hasStoredValue);
  });
}

function buildSaveStatus(storedProviders: string[], fallbackProviders: string[], keystoneErrors: string[]): string {
  if (storedProviders.length && !fallbackProviders.length) {
    return `Settings saved. Stored in Keystone for ${storedProviders.join(', ')}.`;
  }

  if (storedProviders.length && fallbackProviders.length) {
    return `Settings saved. Keystone: ${storedProviders.join(', ')}. Local fallback: ${fallbackProviders.join(', ')}.`;
  }

  if (fallbackProviders.length) {
    return keystoneErrors.length
      ? `Settings saved locally. Keystone unavailable or failed: ${keystoneErrors.join(' | ')}`
      : msg('settingsSavedLocalOnly');
  }

  return msg('settingsSavedSimple');
}

async function clearStoredKey(providerId: string) {
  const field = providerFields.get(providerId);
  if (!field) return;

  await chrome.storage.local.remove(field.storageKey);
  await chrome.runtime.sendMessage({ type: 'CLEAR_PROVIDER_SECRET', providerId });
  field.input.value = '';
  await refreshKeyStates();
  showStatus(statusEl, msg('storedKeyRemoved'));
  await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
}

function attachClearHandlers() {
  providerFields.forEach((field, providerId) => {
    field.clearBtn.onclick = () => { void clearStoredKey(providerId); };
  });
}

async function loadSettings() {
  try {
    const platformInfo = await chrome.runtime.getPlatformInfo();
    currentPlatformOs = platformInfo.os;
  } catch {
    currentPlatformOs = 'unknown';
  }
  const result = await chrome.storage.local.get(
    ['provider', 'customTools', 'customModels', 'customProviders']
  ) as Record<string, string>;

  try {
    currentProviders = result.customProviders
      ? validateProvidersConfig(JSON.parse(result.customProviders))
      : bundledProviders;
  } catch (error) {
    currentProviders = bundledProviders;
    showStatus(providersStatusEl, `Stored providers config was invalid and has been ignored: ${(error as Error).message}`, true);
  }

  renderDefaultProviderSelect(result.provider);
  renderProviderFields();
  attachClearHandlers();
  await refreshKeyStates();
  await refreshKeystoneWarning();
  await refreshKeystoneInstalledPath();

  providersTextarea.value = result.customProviders
    ? JSON.stringify(currentProviders, null, 2)
    : JSON.stringify(bundledProviders, null, 2);

  try {
    toolsTextarea.value = result.customTools
      ? JSON.stringify(validateCategories(JSON.parse(result.customTools)), null, 2)
      : JSON.stringify(bundledTools, null, 2);
  } catch (error) {
    toolsTextarea.value = JSON.stringify(bundledTools, null, 2);
    showStatus(toolsStatusEl, `Stored tools config was invalid and has been ignored: ${(error as Error).message}`, true);
  }

  try {
    modelsTextarea.value = result.customModels
      ? JSON.stringify(validateModelSets(JSON.parse(result.customModels)), null, 2)
      : JSON.stringify(bundledModels, null, 2);
  } catch (error) {
    modelsTextarea.value = JSON.stringify(bundledModels, null, 2);
    showStatus(modelsStatusEl, `Stored models config was invalid and has been ignored: ${(error as Error).message}`, true);
  }
}

localizePage();
void loadSettings();

saveBtn.addEventListener('click', async () => {
  const storageKeys = currentProviders.map((provider) => getProviderStorageKey(provider.id));
  const existing = await chrome.storage.local.get(storageKeys) as Record<string, string>;
  const entered = Object.fromEntries(
    currentProviders.map((provider) => {
      const field = providerFields.get(provider.id);
      return [provider.id, field?.input.value.trim() || ''];
    })
  ) as Record<string, string>;

  const keystoneResponse = await chrome.runtime.sendMessage({
    type: 'STORE_PROVIDER_SECRETS',
    payload: entered,
  });

  const storedProviders = keystoneResponse?.success
    ? new Set<string>((keystoneResponse.data?.storedProviders as string[] | undefined) || [])
    : new Set<string>();
  const keystoneErrors = keystoneResponse?.success
    ? ((keystoneResponse.data?.errors as string[] | undefined) || [])
    : [keystoneResponse?.error || 'Keystone storage failed.'];

  const fallbackProviders: string[] = [];
  const defaultProviderId = isProviderId(providerSelect.value) ? providerSelect.value : (currentProviders[0]?.id || '');
  const nextValues: Record<string, string> = { provider: defaultProviderId };

  currentProviders.forEach((provider) => {
    const field = providerFields.get(provider.id);
    if (!field) return;

    const newValue = entered[provider.id];
    if (newValue) {
      if (storedProviders.has(provider.id)) {
        nextValues[field.storageKey] = '';
      } else {
        nextValues[field.storageKey] = newValue;
        fallbackProviders.push(provider.id);
      }
    } else {
      nextValues[field.storageKey] = existing[field.storageKey] || '';
    }

    field.input.value = '';
  });

  await chrome.storage.local.set(nextValues);
  await refreshKeyStates(nextValues);
  showStatus(statusEl, buildSaveStatus([...storedProviders], fallbackProviders, keystoneErrors));
  await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
});

testKeystoneBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'KEYSTONE_HELLO' });
    if (!response?.success) {
      throw new Error(response?.error || 'Keystone connection failed.');
    }

    const result = response.data?.result || response.data;
    const extensionId = result?.extension_id_seen || 'unknown';
    const pairingStatus = result?.pairing_status || 'unknown';
    showStatus(
      keystoneStatusEl,
      `Connected to Keystone. extension_id_seen=${extensionId}, pairing_status=${pairingStatus}`
    );
    hideKeystoneHelpCard();
    await refreshKeyStates();
    await refreshKeystoneWarning();
    await refreshKeystoneInstalledPath();
  } catch (error) {
    const message = (error as Error).message || 'Keystone connection failed.';
    showStatus(keystoneStatusEl, `Keystone test failed: ${message}`, true);
    if (message.includes('Specified native messaging host not found')) {
      showKeystoneHelpCard(
        'Keystone Reinstall Needed',
        'The Native Messaging host is not installed for this browser right now.',
        'Install or reinstall the packaged Keystone release, then run the browser-integration command below and test the connection again.'
      );
    }
    await refreshKeystoneWarning();
    await refreshKeystoneInstalledPath();
  }
});

openKeystoneAdminBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'KEYSTONE_OPEN_SETTINGS' });
    if (!response?.success) {
      throw new Error(response?.error || 'Keystone admin URL unavailable.');
    }

    const result = response.data?.result || response.data;
    const url = typeof result?.url === 'string' ? result.url : '';
    if (!url) {
      throw new Error('Keystone did not return an admin URL.');
    }

    window.open(url, '_blank', 'noopener');
    showStatus(keystoneStatusEl, `Opened Keystone Admin: ${url}`);
    hideKeystoneHelpCard();
    await refreshKeystoneInstalledPath();
  } catch (error) {
    const message = (error as Error).message || 'Keystone admin URL unavailable.';
    if (message.includes('Specified native messaging host not found')) {
      showStatus(
        keystoneStatusEl,
        'Open Keystone Admin failed: Keystone is not installed for this browser right now. Reinstall it in the Keystone section below, then try again.',
        true
      );
      showKeystoneHelpCard(
        'Keystone Reinstall Needed',
        'This browser cannot open Keystone Admin because the Native Messaging host is currently missing.',
        'Install or reinstall Keystone first. After that, Open Keystone Admin will work again and Y/TXT can use Keystone-backed secrets.'
      );
      return;
    }
    showStatus(keystoneStatusEl, `Open Keystone Admin failed: ${message}`, true);
  }
});

saveToolsBtn.addEventListener('click', () => {
  try {
    const parsed = validateCategories(JSON.parse(toolsTextarea.value));
    chrome.storage.local.set({ customTools: JSON.stringify(parsed) }, () => {
      showStatus(toolsStatusEl, msg('toolsSavedReopen'));
    });
  } catch (e) {
    showStatus(toolsStatusEl, `Invalid JSON: ${(e as Error).message}`, true);
  }
});

resetToolsBtn.addEventListener('click', () => {
  chrome.storage.local.remove('customTools', () => {
    toolsTextarea.value = JSON.stringify(bundledTools, null, 2);
    showStatus(toolsStatusEl, msg('resetDefaultStatus'));
  });
});

importToolsBtn.addEventListener('click', () => {
  openImportDialog('tools');
});

exportToolsBtn.addEventListener('click', () => {
  downloadJson('y-txt-tools.json', toolsTextarea.value);
  showStatus(toolsStatusEl, msg('toolsExported'));
});

saveModelsBtn.addEventListener('click', () => {
  try {
    const parsed = validateModelSets(JSON.parse(modelsTextarea.value));
    chrome.storage.local.set({ customModels: JSON.stringify(parsed) }, () => {
      showStatus(modelsStatusEl, msg('savedWithBang'));
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
    });
  } catch (e) {
    showStatus(modelsStatusEl, `Invalid JSON: ${(e as Error).message}`, true);
  }
});

resetModelsBtn.addEventListener('click', () => {
  chrome.storage.local.remove('customModels', () => {
    modelsTextarea.value = JSON.stringify(bundledModels, null, 2);
    showStatus(modelsStatusEl, msg('resetDefaultStatus'));
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
  });
});

importModelsBtn.addEventListener('click', () => {
  openImportDialog('models');
});

exportModelsBtn.addEventListener('click', () => {
  downloadJson('y-txt-models.json', modelsTextarea.value);
  showStatus(modelsStatusEl, msg('modelsExported'));
});

saveProvidersBtn.addEventListener('click', () => {
  try {
    const parsed = validateProvidersConfig(JSON.parse(providersTextarea.value));
    chrome.storage.local.set({ customProviders: JSON.stringify(parsed) }, async () => {
      currentProviders = parsed;
      renderDefaultProviderSelect(providerSelect.value);
      renderProviderFields();
      attachClearHandlers();
      await refreshKeyStates();
      showStatus(providersStatusEl, msg('savedWithBang'));
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
    });
  } catch (e) {
    showStatus(providersStatusEl, `Invalid JSON: ${(e as Error).message}`, true);
  }
});

resetProvidersBtn.addEventListener('click', () => {
  chrome.storage.local.remove('customProviders', async () => {
    currentProviders = bundledProviders;
    providersTextarea.value = JSON.stringify(bundledProviders, null, 2);
    renderDefaultProviderSelect(providerSelect.value);
    renderProviderFields();
    attachClearHandlers();
    await refreshKeyStates();
    showStatus(providersStatusEl, msg('resetDefaultStatus'));
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
  });
});

importProvidersBtn.addEventListener('click', () => {
  openImportDialog('providers');
});

exportProvidersBtn.addEventListener('click', () => {
  downloadJson('y-txt-providers.json', providersTextarea.value);
  showStatus(providersStatusEl, msg('providersExported'));
});

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files?.[0];
  if (!file || !pendingImportTarget) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (pendingImportTarget === 'tools') {
      toolsTextarea.value = JSON.stringify(validateCategories(parsed), null, 2);
      showStatus(toolsStatusEl, msg('toolsImportedSaveApply'));
    } else if (pendingImportTarget === 'models') {
      modelsTextarea.value = JSON.stringify(validateModelSets(parsed), null, 2);
      showStatus(modelsStatusEl, msg('modelsImportedSaveApply'));
    } else {
      providersTextarea.value = JSON.stringify(validateProvidersConfig(parsed), null, 2);
      showStatus(providersStatusEl, msg('providersImportedSaveApply'));
    }
  } catch (error) {
    if (pendingImportTarget === 'tools') {
      showStatus(toolsStatusEl, `Import failed: ${(error as Error).message}`, true);
    } else if (pendingImportTarget === 'models') {
      showStatus(modelsStatusEl, `Import failed: ${(error as Error).message}`, true);
    } else {
      showStatus(providersStatusEl, `Import failed: ${(error as Error).message}`, true);
    }
  } finally {
    pendingImportTarget = null;
    importFileInput.value = '';
  }
});
