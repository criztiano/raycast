# GitHub File Download

Download files from GitHub directly to your `~/Downloads` folder — just copy the URL, trigger the command, done.

![Raycast](https://img.shields.io/badge/Raycast-Extension-FF6363?style=flat-square&logo=raycast&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

## Features

- **Paste & Go** — Copy a GitHub file URL, run the command, file lands in `~/Downloads`
- **Multiple URL Formats** — Supports `github.com/…/blob/…`, `github.com/…/raw/…`, and `raw.githubusercontent.com` links
- **Uses `gh` CLI Auth** — No extra tokens needed, works with your existing GitHub CLI session
- **Instant Feedback** — HUD notification confirms the download

## Install

1. Clone this repo
2. Run `npm install && npm run dev`
3. Open Raycast and search **"Download GitHub File"**

### Prerequisites

- [Raycast](https://raycast.com) installed
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`)

## Usage

1. **Copy** a GitHub file URL to your clipboard, e.g.:
   ```
   https://github.com/owner/repo/blob/main/src/index.ts
   ```
2. **Open Raycast** and run **"Download GitHub File"**
3. File is saved to `~/Downloads` and a notification confirms it ✅

### Supported URL Formats

| Format | Example |
|--------|---------|
| Blob | `https://github.com/owner/repo/blob/main/path/file.ext` |
| Raw | `https://github.com/owner/repo/raw/main/path/file.ext` |
| Raw CDN | `https://raw.githubusercontent.com/owner/repo/main/path/file.ext` |

## Development

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Lint
npm run lint

# Build
npm run build
```

## How It Works

1. Reads the clipboard for a GitHub file URL
2. Parses the URL to extract `owner`, `repo`, `branch`, and `path`
3. Calls `gh api /repos/{owner}/{repo}/contents/{path}?ref={branch}` to fetch the file
4. Decodes the base64 response and saves to `~/Downloads`
5. Shows a macOS HUD notification

## License

MIT — see [LICENSE](LICENSE) for details.
