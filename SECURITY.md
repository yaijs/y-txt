# Security Policy

## Supported Versions

Y/TXT is currently maintained on the latest release and the current `main` branch.

## Security Model

Y/TXT is designed as a local-first browser extension.

Important tradeoffs:

- provider keys stored in `chrome.storage.local` are convenient, but they are not the preferred security path
- Keystone is the preferred path for users who want provider keys stored outside the browser
- any installed extension or compromised browser profile is part of your trust boundary
- all provider requests ultimately go to the provider you configured, so billing limits and scoped keys are strongly recommended

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
