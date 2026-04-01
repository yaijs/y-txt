export function msg(key: string, substitutions?: string | string[]): string {
  const value = chrome.i18n?.getMessage(key, substitutions as string | string[] | undefined);
  return value || key;
}

function applyMessage(el: Element, value: string): void {
  if (el.hasAttribute('data-i18n-html')) {
    el.innerHTML = value;
    return;
  }

  el.textContent = value;
}

export function localizePage(root: ParentNode = document): void {
  const uiLanguage = chrome.i18n?.getUILanguage?.();
  if (uiLanguage) {
    document.documentElement.lang = uiLanguage;
  }

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    applyMessage(el, msg(key));
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    el.placeholder = msg(key);
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    if (el === document.documentElement) return;
    el.setAttribute('title', msg(key));
  });

  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (!key) return;
    el.setAttribute('aria-label', msg(key));
  });

  const titleKey = document.documentElement.getAttribute('data-i18n-title');
  if (titleKey) {
    document.title = msg(titleKey);
  }
}
