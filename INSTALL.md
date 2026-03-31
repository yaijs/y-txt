# Y/TXT Install

Y/TXT is loaded as an unpacked browser extension.

## From GitHub Release

1. Download the latest `y-txt-...-extension.zip` asset from GitHub Releases.
2. Unzip it to a local folder.
3. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Vivaldi: `vivaldi://extensions`
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select the extracted extension folder.

You select the directory itself, not a specific file.

## From Source

```bash
npm install
npm run build
```

Then enable `Developer mode`, click `Load unpacked`, and select `dist/`.

## Notes

- The same built extension files work across Linux, macOS, and Windows.
- Keystone is optional. Y/TXT can run with locally stored provider keys if Keystone is not installed.
