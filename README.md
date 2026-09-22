# ProjectNormax

Single-page chat app with promo-based usage, themes, and a Vercel serverless backend powered by [Groq](https://console.groq.com) (free tier, OpenAI-compatible API).

## Local preview

Static files work locally; chat requires the API route (use Vercel CLI):

```bash
npm i -g vercel
cd C:\Users\Maddox\Downloads\ProjectNormax
vercel dev
```

Set `GROQ_API_KEY` in `.env.local` when prompted or in the Vercel dashboard.

## Deploy to Vercel

1. Push this folder to GitHub (or import the folder in [vercel.com/new](https://vercel.com/new)).
2. In **Project → Settings → Environment Variables**, add:
   - `GROQ_API_KEY` — create a free key at [console.groq.com](https://console.groq.com).
3. Deploy. The `/api/chat` route runs as a serverless function.

## Promo codes (public)

| Code       | Benefit        |
| ---------- | -------------- |
| `Promo10`  | 30 minutes     |
| `Free100`  | 2 hours        |

Each public code can be redeemed once per browser (stored in `localStorage`).

## Settings

- **Light / dark** appearance
- **Style** presets: Normax, Ocean, Sunset, Mono
- **Speed**: maps to Groq models and token limits (Fast / Balanced / Quality)
