# Voice Server (ConversationRelay)

This is a **persistent WebSocket server** that handles Twilio's [ConversationRelay](https://www.twilio.com/docs/voice/conversational-ai/conversation-relay) protocol for the phone call channel. Unlike serverless functions, this server must run continuously to maintain WebSocket connections with Twilio during live calls.

## What it does

- Runs a WebSocket server on port 8080 (internal; exposed via Fly.io; override with `PORT`)
- Validates the Twilio signature on the WebSocket handshake, then accepts incoming ConversationRelay connections from Twilio's Voice API
- Twilio performs speech-to-text and text-to-speech; this server just runs a short scripted conversation (asks the caller's name, then their comic idea) by exchanging text messages
- Publishes comic generation jobs to the same **QStash worker** as the SMS channel, so comics are delivered via text message
- Does **not** call OpenAI or need OpenAI credentials — image generation happens later in the shared QStash worker, not here

## Local development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   By default, it listens on `http://localhost:8080`.

3. **Expose via a tunnel** (for testing with Twilio):
   ```bash
   ngrok http 8080
   ```
   This gives you a public URL like `https://abc123.ngrok.io`. Convert to WebSocket: `wss://abc123.ngrok.io`.

4. **Set environment variables** in your `.env`:
   - `CONVERSATION_RELAY_WS_URL=wss://abc123.ngrok.io` (the tunnel's wss URL)
   - `TWILIO_AUTH_TOKEN=<your_token>`
   - `QSTASH_TOKEN=<your_token>`
   - `UPSTASH_REDIS_REST_URL=<your_url>`
   - `UPSTASH_REDIS_REST_TOKEN=<your_token>`
   - `PUBLIC_BASE_URL=<your_public_url>`

## Deployment

1. **Deploy to Fly.io:**
   ```bash
   fly launch --copy-config=false --dockerfile Dockerfile
   fly deploy
   ```

2. **Set secrets** (Fly.io encrypted environment variables):
   ```bash
   fly secrets set TWILIO_AUTH_TOKEN=<your_token>
   fly secrets set QSTASH_TOKEN=<your_token>
   fly secrets set UPSTASH_REDIS_REST_URL=<your_url>
   fly secrets set UPSTASH_REDIS_REST_TOKEN=<your_token>
   fly secrets set PUBLIC_BASE_URL=<your_public_url>
   fly secrets set CONVERSATION_RELAY_WS_URL=<your_voice_server_wss_url>
   ```
   Note: `CONVERSATION_RELAY_WS_URL` should be the public `wss://` URL of your deployed voice server (from `fly info`).

3. **The deployment keeps the process alive:**
   - `auto_stop_machines = false` + `min_machines_running = 1` in `fly.toml` ensure the WebSocket server never stops, so live calls aren't dropped.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `TWILIO_AUTH_TOKEN` | Authenticate requests from Twilio |
| `QSTASH_TOKEN` | Publish comic generation jobs to QStash |
| `UPSTASH_REDIS_REST_URL` | Redis cache for rate limiting / state |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication |
| `PUBLIC_BASE_URL` | Public origin for Twilio signature validation |
| `CONVERSATION_RELAY_WS_URL` | Public `wss://` URL of this server (for the Next.js app to connect) |

## Notes

- The voice server and the Next.js app both use the **same Twilio account** and the **same QStash worker**. The voice server does not use OpenAI directly (image generation runs in the shared QStash worker).
- Comics generated via voice are delivered via the SMS/MMS channel (same number, so you get the comic texted to you).
- WebSocket connections are long-lived; the server must stay running throughout a call.
- **URL must match exactly:** `CONVERSATION_RELAY_WS_URL` (set here AND in the Next.js app), the `url="..."` in the `/api/twilio/voice` TwiML, and the value Twilio dials must all be byte-identical — the WebSocket handshake signature is validated against this URL, so any trailing-slash/scheme/host difference rejects every call with a 403.
