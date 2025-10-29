# Local Development Setup for VS Code

This guide will help you run the Chronicles of Aethermoor project locally in VS Code.

## Prerequisites

1. **Node.js** (v18+) - [Download here](https://nodejs.org/)
2. **Supabase CLI** - For running edge functions locally
3. **API Keys** - Gemini API and Hugging Face token

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

1. Copy `.env.local` and fill in your API keys:
   - Get Gemini API key from: https://makersuite.google.com/app/apikey
   - Get Hugging Face token from: https://huggingface.co/settings/tokens

2. Your `.env.local` should look like:
```env
VITE_SUPABASE_URL=https://owyqzkphwmasmnhogssd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=your_actual_gemini_key
HUGGING_FACE_ACCESS_TOKEN=hf_your_actual_token
```

## Step 3: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or via npm
npm install -g supabase
```

## Step 4: Start the Development Server

### Option A: Run Everything (Recommended for Presentation)

```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Supabase edge functions locally
supabase functions serve --env-file .env.local
```

Then open: http://localhost:8080

### Option B: Use Lovable Cloud Edge Functions (Easier)

Just run:
```bash
npm run dev
```

The app will use the deployed edge functions on Lovable Cloud automatically.

## Step 5: Presenting in VS Code

1. Open VS Code
2. Open integrated terminal (Ctrl+` or Cmd+`)
3. Split terminal for both processes
4. Run `npm run dev` in one terminal
5. Your game will be at: http://localhost:8080

## Troubleshooting

### Edge Function Errors
- Make sure `.env.local` has valid API keys
- Check Supabase CLI is installed: `supabase --version`
- Verify edge function is running: `curl http://localhost:54321/functions/v1/dungeon-master`

### Frontend Not Connecting
- Check `VITE_SUPABASE_URL` in `.env.local`
- Clear browser cache
- Restart dev server

### Image Generation Issues
- Verify Hugging Face token is valid
- Check function logs in terminal

## Project Structure

```
├── src/
│   ├── pages/Index.tsx          # Main game interface
│   ├── lib/gameEngine.ts        # Game state logic
│   └── integrations/supabase/   # Supabase client
├── supabase/
│   └── functions/
│       └── dungeon-master/      # AI game master logic
├── .env.local                   # Your local API keys
└── LOCAL_SETUP.md              # This file
```

## Notes


- Use `.env.local` for your local development
- `.gitignore` already excludes `.env*` files for security
- Edge functions run on Deno, not Node.js
