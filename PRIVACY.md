# Privacy Policy for Y/TXT

Y/TXT is a local-first browser extension for running small LLM-powered tools against text you choose.

## Data Collection

Y/TXT does not operate any backend service and does not collect analytics, telemetry, or tracking data.

The extension does not send your data to Y/TXT-controlled servers.

## Text Processing

When you run a tool, the text you provide is sent directly to the LLM provider you selected, or through the optional local Keystone companion before that provider request is made.

Your text is processed only to complete the requested tool run.

## API Keys

Y/TXT supports two key-storage paths:

- Keystone, an optional local native companion that stores provider keys outside the browser
- local browser storage via `chrome.storage.local`

If you save a provider key in the extension itself, it stays in local browser storage on your machine and is used only for requests to the provider you configured.

For the security tradeoffs of those two paths, see [`SECURITY.md`](./SECURITY.md).

## Keystone Integration

Keystone is optional.

If Keystone is installed and connected, Y/TXT can ask Keystone to inject a provider key locally before the upstream provider request is sent.

In that mode, the extension does not need to keep that provider key in browser storage.

## Stored Local Data

Y/TXT may store the following locally on your device:

- provider configuration
- tool and model configuration
- recent run history
- in-progress workspace state
- optional staged content you add yourself

This local data is used only to make the extension work as expected across popup and side panel sessions.

## Permissions

Y/TXT uses only the permissions needed for its local workflow:

- `activeTab` to access the current page selection when you explicitly use the extension
- `scripting` to fetch selected text on demand
- `storage` to persist your local configuration and workspace
- `sidePanel` to provide the optional side panel workspace
- `nativeMessaging` to communicate with the optional local Keystone companion

## Third-Party Services

Your use of Nvidia Build, OpenAI, DeepSeek, Anthropic, or any other configured provider is also subject to that provider's own terms and privacy practices.

## Contact

If you discover a privacy or security concern, report it through the repository security process described in [`SECURITY.md`](./SECURITY.md).
