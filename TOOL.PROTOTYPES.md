# Tool Prototypes

> What once needed a framework can now fit into one sharp prompt.

This is a living reference for Y/TXT tool design.
Copy any JSON block, paste it into `Options -> Tools Config`, save it, and reopen the popup or side panel.

The examples below are intentionally practical:
- small tools stay small
- chained tools are only used when they add real structure
- translation tools use `languages: true` instead of giant embedded language option objects

## Quick Use

1. Open `Y/TXT -> Options`
2. Scroll to `Tools Config`
3. Paste a tool into an existing category or create a new one
4. Click `Save Tools`
5. Reopen the popup or side panel

For faster iteration, use the built-in footer entry `🧰 Tooling`. It opens the default `Tool Generator`, which already sees your current tools, models, providers, and shared translation languages.

## What A Tool Can Contain

| Field | Purpose |
| --- | --- |
| `id` | Unique identifier. Use letters, numbers, `_`, and keep it stable. |
| `name` | Human-facing tool label in the UI. |
| `icon` | Optional emoji for fast visual scanning. |
| `description` | Optional plain-text note shown behind the `Info` toggle in the workspace. |
| `model` | Preconfigured tier such as `default`, `fast`, `coding`, or `creative`. |
| `provider` | Optional provider override for the whole tool or a specific step. |
| `temperature` | Creativity / variance control. Lower is stricter. |
| `systemPrompt` | Strict role and output rules. |
| `userMessage` | The actual request body sent to the model. |
| `steps` | Sequential multi-step flow when one pass is not enough. |
| `options` | User-selectable or text options surfaced above the input box. |
| `languages` | Set to `true` to inject the shared Target Language selector. |

## Runtime Placeholders

These placeholders are already supported today.

### Core input placeholders

| Placeholder | Meaning |
| --- | --- |
| `{{input}}` | Current input for the active step |
| `{{previous}}` | Previous step output inside chained tools |
| `{{originalInput}}` | Untouched original source text from the first run |

### Option placeholders

Any option ID becomes a placeholder automatically.

Example:

```json
{
  "id": "tone-shift",
  "name": "Tone Shift",
  "options": [
    {
      "id": "tone",
      "label": "Tone",
      "type": "select",
      "options": ["Formal", "Friendly", "Direct"],
      "default": "Formal"
    }
  ],
  "systemPrompt": "Rewrite the text in a {{tone}} tone.",
  "userMessage": "{{input}}"
}
```

### Shared translation placeholder

If a tool sets:

```json
"languages": true
```

Y/TXT injects the shared `targetLanguage` select automatically, so the tool can use:

```text
{{targetLanguage}}
```

This keeps translation tools compact and centralized.

### Optional tool description

If a tool includes:

```json
"description": "Short explanation of what the tool does and when to use it."
```

Y/TXT shows an `Info` button next to the input label in the workspace.
Descriptions are treated as plain text and rendered with preserved line breaks, so they are safe to share and still readable for longer notes.

### Advanced config-aware placeholders

These are especially useful for the built-in `Tool Generator`, but any tool can use them:

| Placeholder | Meaning |
| --- | --- |
| `{{currentConfig}}` | Alias for the current tools config |
| `{{currentToolsConfig}}` | Current tools config as JSON |
| `{{currentModelsConfig}}` | Current models config as JSON |
| `{{currentProvidersConfig}}` | Current providers config as JSON |
| `{{currentTranslationLanguages}}` | Shared translation languages as JSON |

## Good Defaults

General guidance:
- `0.0 - 0.2`: strict review, proofreading, security, normalization
- `0.3 - 0.5`: editing, summarization, professional rewrite
- `0.6 - 0.8`: brainstorming, alternates, ideation
- `0.9+`: only when you explicitly want volatile output

Use chained `steps` when phases are genuinely different.
Do not split one obvious rewrite into three model calls just because you can.

## Recommended Prototypes

### Writing & Editing

**Professional Polish**

```json
{
  "icon": "✨",
  "id": "professional_polish",
  "name": "Professional Polish",
  "description": "Polishes business or professional writing without changing the intended meaning.",
  "systemPrompt": "You are an expert editor. Improve clarity, professionalism, tone, and flow. Fix grammar and awkward phrasing while preserving the original meaning and voice. Output only the polished version.",
  "userMessage": "Polish this text to sound professional and confident:\n\n{{input}}",
  "temperature": 0.3
}
```

**Make It Shorter**

```json
{
  "icon": "✂️",
  "id": "make_shorter",
  "name": "Make It Shorter",
  "systemPrompt": "You make text significantly shorter and tighter while keeping all important information. Remove fluff, redundancies, and weak phrases. Be ruthless but natural.",
  "userMessage": "Make this text much shorter and tighter:\n\n{{input}}",
  "temperature": 0.3
}
```

**TL;DR**

```json
{
  "icon": "⚡",
  "id": "tldr",
  "name": "TL;DR",
  "systemPrompt": "Extract the single most important point. Output one short, clear sentence with no filler.",
  "userMessage": "TL;DR this:\n\n{{input}}",
  "temperature": 0
}
```

### Translation

**Compact Translation Tool**

```json
{
  "icon": "🌐",
  "id": "translate_compact",
  "name": "Translate",
  "languages": true,
  "systemPrompt": "You are an expert translator. Translate the text authentically to {{targetLanguage}}. Preserve the exact formatting, spacing, line breaks, and markdown. Output only the translated text.",
  "userMessage": "Translate this exactly to {{targetLanguage}}:\n\n{{input}}",
  "temperature": 0.2
}
```

**Proofread -> Translate**

```json
{
  "icon": "🔁",
  "id": "proofread_translate",
  "name": "Proofread -> Translate",
  "description": "First cleans up the source text, then translates it into the selected target language.",
  "languages": true,
  "steps": [
    {
      "id": "proofread",
      "name": "Proofread",
      "systemPrompt": "You are an elite proofreader. Fix spelling, grammar, and punctuation while preserving exact formatting, spacing, line breaks, and markdown. Output only the corrected text.",
      "userMessage": "Fix this:\n\n{{input}}"
    },
    {
      "id": "translate",
      "name": "Translate",
      "systemPrompt": "You are an expert translator. Translate the text authentically to {{targetLanguage}}. Preserve exact formatting, spacing, line breaks, and markdown. Output only the translated text.",
      "userMessage": "Translate this to {{targetLanguage}}:\n\n{{previous}}"
    }
  ]
}
```

### Developer Tools

**Brutal Code Review**

```json
{
  "icon": "🔍",
  "id": "brutal_code_review",
  "name": "Brutal Code Review",
  "model": "coding",
  "temperature": 0.2,
  "systemPrompt": "You are a brutally honest senior engineer. Identify bad practices, security risks, performance issues, and readability problems. Be direct, concrete, and constructive.",
  "userMessage": "Review this code harshly:\n\n{{input}}"
}
```

**DRY + KISS Review**

```json
{
  "icon": "🌵",
  "id": "dry_kiss_review",
  "name": "DRY + KISS Review",
  "model": "coding",
  "temperature": 0.1,
  "systemPrompt": "Focus strictly on DRY and KISS. Identify unnecessary duplication and avoidable complexity. Suggest cleaner, simpler alternatives.",
  "userMessage": "Review this code for DRY and KISS violations:\n\n{{input}}"
}
```

### Productivity

**Meeting Notes -> Actions**

```json
{
  "icon": "📋",
  "id": "meeting_to_actions",
  "name": "Meeting -> Actions",
  "systemPrompt": "Extract clear, actionable tasks from meeting notes. Include owner when present and a reasonable deadline when inferable. Ignore small talk.",
  "userMessage": "Convert these meeting notes into action items:\n\n{{input}}",
  "temperature": 0.1
}
```

## Built-In Meta Tool

The default footer entry `🧰 Tooling` opens the built-in `Tool Generator`.

Its job is to help you create:
- a new tool object
- a models config snippet
- a provider config object

It already sees your live config through:
- `{{currentConfig}}`
- `{{currentModelsConfig}}`
- `{{currentProvidersConfig}}`
- `{{currentTranslationLanguages}}`

That makes it a good first stop when you want to:
- add a new custom tool without writing raw JSON from scratch
- refactor a duplicated translation tool into a shared-language version
- sketch a new model tier or provider entry in the existing style

## Design Rules That Age Well

- Keep tool IDs stable once you start using them in history.
- Add a `description` when the tool's intent is not obvious from the name alone.
- Put strict output rules in `systemPrompt`, not only in `userMessage`.
- Prefer one excellent pass over three vague chained passes.
- Reuse shared language config with `languages: true`.
- If a tool is really a workflow, name the steps clearly.
- If the output must be directly reusable, say `Output only ...` explicitly.

## What Not To Do

- Do not embed huge static language objects in every translation tool.
- Do not create duplicate IDs across categories.
- Do not use very high temperature for proofreading or review tasks.
- Do not let a “generator” tool return explanations around JSON if you want to paste the result directly.

## Final Note

The best Y/TXT tools feel small, sharp, and obvious in hindsight.
If a tool needs a paragraph of explanation just to understand what it does, tighten it.
