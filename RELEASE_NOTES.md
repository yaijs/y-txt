# Y/TXT v1.1.0

Y/TXT is a Chrome extension for running small LLM-powered text tools directly against selected page content without leaving the current tab.

## Highlights

- Run prompt-defined tools against selected text from the popup or the side panel
- Live-edit bundled tools, model sets, and provider mappings from the Options page
- Support for staged context, recent runs, and a persistent shared workspace across popup and side panel
- Chained tools with multi-step prompt pipelines
- Built-in provider adapters for Nvidia Build, OpenAI, Anthropic, and DeepSeek
- Context-menu driven side-panel workflow for reliable selection capture without needing the popup first
- Built-in Tooling flow for generating, saving, categorizing, and deleting tools from inside the extension
- Optional per-tool descriptions plus payload/meta debugging previews in the workspace
- Policy pages published through GitHub Pages for stable Privacy and Security links

## Setup And Admin

- Keystone-first key storage model with fallback to `chrome.storage.local`
- On-demand selection capture using `activeTab` and `scripting` instead of always-on content injection
- Side panel workspace for longer-lived runs, result tracking, and persistent editing without popup blur
- Schema validation for tool and model configuration editors
- Import/export flow for tools and models as JSON backups
- GitHub Release artifact packaged as a downloadable unpacked-extension zip
- Stable unpacked-extension ID for local Keystone integration during development

## Current Scope

- Ships with ten bundled tools across general writing, utility, and code-oriented workflows
- Supports Chrome extension loading as an unpacked MV3 build from `dist/`
- Designed for small text transformations, reviews, audits, and chained prompt workflows inside the browser
- Popup remains the quick surface, while the side panel acts as the deeper shared workspace

## Notes For Release

- Keystone remains optional for basic use and review; the extension still works with extension-managed keys when Keystone is unavailable
- Current host permissions are limited to the supported AI provider endpoints plus `http://127.0.0.1/*` for Keystone loopback sessions
- Installation is via `Developer mode` plus `Load unpacked` after extracting the release zip
