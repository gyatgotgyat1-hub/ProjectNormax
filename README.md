# ProjectNormax

Single-page chat app with promo-based usage, themes, and a Vercel serverless backend using [Pollinations](https://enter.pollinations.ai) (OpenAI-compatible, free API key).

## Local preview

```bash
npm i -g vercel
cd C:\Users\Maddox\Downloads\ProjectNormax
vercel dev
```

Set `POLLINATIONS_API_KEY` in `.env.local` when prompted.

## Deploy to Vercel

1. Push to GitHub and import on [vercel.com/new](https://vercel.com/new).
2. **Settings → Environment Variables** → add `POLLINATIONS_API_KEY` from [enter.pollinations.ai/keys](https://enter.pollinations.ai/keys).
3. Redeploy after adding the variable.

You can also name the variable `AI_API_KEY` if you prefer.

## Promo codes (public)

| Code       | Benefit    |
| ---------- | ---------- |
| `Promo10`  | 30 minutes |
| `Free100`  | 2 hours    |

Codes can be applied multiple times; each use adds time. New visitors get **45 minutes** of starter chat time.

## Settings

- Light / dark appearance
- Style presets: Normax, Ocean, Sunset, Mono
- Speed: Fast / Balanced / Quality (Pollinations model + token limits)
