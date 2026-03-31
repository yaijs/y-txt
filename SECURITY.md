# Security Policy

## Supported Versions

Y/TXT is currently maintained on:

- the latest tagged release
- the current `main` branch

Older versions may not receive security fixes.

## Security Model

Y/TXT is a local-first browser extension.

It does not operate a Y/TXT-managed backend and does not proxy your requests through Y/TXT-controlled servers. When you run a tool, your text goes directly to the LLM provider you configured, either:

- from the extension itself, using a key stored in `chrome.storage.local`
- through the optional local Keystone companion, which injects the provider key outside the browser

That means the main trust boundary is your local browser environment:

- your browser profile
- other installed extensions
- any local malware or compromised user session
- the upstream provider you configured

Y/TXT is designed to reduce unnecessary data movement, but it cannot make a compromised browser profile trustworthy.

## API Key Handling

Y/TXT supports two key-storage paths.

### Local Browser Storage

If you save a provider key directly in Y/TXT, it is stored in `chrome.storage.local` on your machine.

This path is convenient and fully supported, but it is not the strongest security posture because the key remains inside the browser environment.

Use this path only if you are comfortable treating your browser profile as part of the secret-storage boundary.

### Keystone

Keystone is the preferred path when secret handling matters.

With Keystone:

- provider keys are stored outside the extension
- Y/TXT asks the local Keystone companion to inject the correct key at request time
- the extension does not need to keep that provider key in browser storage

This is safer because it narrows exposure from "anything that can read extension-managed storage" to "the local trusted host and its storage model".

Keystone is still local software, so it is not a magic boundary against a fully compromised machine, but it is a better separation model than storing secrets directly in the extension.

## Threat Model

Y/TXT is built for utility workflows, not high-assurance secret handling.

Assume the following:

- any text you submit to a tool is sent to the configured provider to complete that request
- any provider key stored in the browser is exposed to the security posture of that browser profile
- any installed extension with abusive behavior can become part of your risk surface
- a compromised local machine can undermine both browser storage and Keystone

Recommended mental model:

- browser storage is convenience-first
- Keystone is the safer local separation path
- strict provider-side limits are still necessary

## Billing And Usage Safety

Always set strict provider-side safety limits for any API key you use.

Recommended controls:

- per-key usage limits
- billing caps or spend alerts
- provider dashboards with narrow scopes where available
- separate keys for experimentation vs important workloads

This matters even when you trust the extension, because upstream provider usage is still billable and any local compromise can turn into unwanted API traffic.

## Permissions And Network Surface

Y/TXT uses only the permissions needed for its local workflow:

- `activeTab` to read the current selection when you explicitly invoke the extension
- `scripting` to fetch selected text on demand
- `storage` to persist local configuration and workspace state
- `sidePanel` for the persistent workspace surface
- `nativeMessaging` for the optional Keystone companion

Network traffic is limited to:

- the LLM provider endpoints you configured
- the optional local Keystone admin/bridge flow on `127.0.0.1`

## Why Keystone Is Safer

Keystone improves the security posture because it moves provider-secret handling out of the extension runtime and into a separate local companion.

That gives you:

- less direct secret exposure in the browser
- a clearer separation between UI state and secret storage
- a more defensible explanation for browser-store review and user trust

Y/TXT still works without Keystone, but Keystone is the recommended mode once you want safer local secret handling.

## Reporting A Vulnerability

Please report security issues privately before opening a public issue.

Use one of these channels:

- open a private security advisory on the GitHub repository, if available
- contact the maintainer through the repository profile or project contact details

Please include:

- a clear description of the issue
- affected version or commit
- reproduction steps
- impact assessment
- any suggested mitigation, if known

## Disclosure Guidance

Please do not publish proof-of-concept details for an unfixed vulnerability before the maintainer has had a reasonable chance to investigate and respond.
