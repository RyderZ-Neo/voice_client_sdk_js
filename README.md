
# Pipecat Voice Interview Client

Voice-based interview client using Pipecat and Daily.co WebRTC transport.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env.local` and configure:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your bot credentials:
```
VITE_BOT_START_URL=https://your-bot-api.com/start
VITE_BOT_START_PUBLIC_API_KEY=your_api_key
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

- `VITE_BOT_START_URL`: Bot start endpoint URL
- `VITE_BOT_START_PUBLIC_API_KEY`: API key for bot authentication
- `VITE_ENVIRONMENT`: Environment (local/production)
