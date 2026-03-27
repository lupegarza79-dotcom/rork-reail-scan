# REAiL Browser Extension

Chrome-compatible extension that shows a real-time verification badge on every page using the REAiL scan engine.

## Features

- **Floating badge** on every page (bottom-right corner) showing VERIFIED / UNVERIFIED / HIGH_RISK / Unknown
- **Popup panel** when clicking the extension icon — shows score, flags, and link to full report
- **Browser badge text** on the extension icon (✓ / ? / !) with color coding
- **Local cache** (30 min TTL) to avoid repeated API calls
- **Rescan** button to force a fresh scan
- **Settings** panel to configure API base URL and anon key

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `/extension` folder from this repo
5. The REAiL icon appears in the toolbar

## Configuration

1. Click the REAiL icon in the toolbar
2. Expand **⚙️ Extension Settings**
3. Enter:
   - **API Base URL**: `https://<REF>.supabase.co/functions/v1`
   - **Anon Key**: Your legacy anon public JWT (starts with `eyJhbGci...`)
4. Click **Save Configuration**

## How It Works

1. On every page load, the content script sends the current URL to the background worker
2. The background worker calls `GET /quick-scan?url=<url>` with auth headers
3. Results are cached locally for 30 minutes
4. The floating badge and toolbar icon update with the verdict

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (Manifest V3) |
| `background.js` | Service worker — API calls, caching, badge updates |
| `content.js` | Content script — injects floating badge on pages |
| `badge.css` | Styles for the floating badge |
| `popup.html` | Popup UI when clicking extension icon |
| `popup.js` | Popup logic — displays results, handles settings |

## Required Icons

Place icon files in `extension/icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## Permissions

- `activeTab` — Access current tab URL
- `storage` — Save API configuration
- `host_permissions: <all_urls>` — Call REAiL API from any page

## API Endpoint Used

```
GET /quick-scan?url=<encoded_url>
Headers:
  Authorization: Bearer <anon_key>
  apikey: <anon_key>
  X-Device-Id: reail-extension
```

Response:
```json
{
  "badge": "VERIFIED" | "UNVERIFIED" | "HIGH_RISK" | null,
  "score": 85,
  "top_red_flags": ["Suspicious redirect pattern"],
  "scan_id": "uuid",
  "cache_hit": true,
  "domain": "example.com"
}
```
