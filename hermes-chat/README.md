# ⚡ Hermes Chat — every free AI, one box

Free-tier AI chat with **automatic daily-limit switching**, **model teams**, **MCP + custom AI connections**,
**unlimited chunked uploads** (kept until YOU delete), and an **app builder agent**.

Built for Kali ARM (and anywhere Node 18+ runs).

## Features

| Want | How Hermes does it |
|---|---|
| Every AI model, free, daily-limited | Groq · Gemini · OpenRouter-free · Together · HuggingFace · Ollama-local · Custom/MCP-added |
| Auto-switch when a limit finishes | `src/lib/router.ts` tracks daily usage per model; on 429/quota/5xx/error it fails over to the next free model and tells you it switched |
| Free ≈ paid | Quality-boost system prompt on every call + team vote/pipeline/debate synthesis |
| Build apps for me | **Builder** tab: prompt (+ attached files) → full file tree in `data/builds/`, with Fix/iterate loop |
| Upload files, no size limit | 5 MB chunked resumable uploads streamed to disk (never all in RAM). Files persist until deleted — per-file **Delete** + **Delete all** buttons |
| Connect GitHub / apps / MCP | **Links** tab: add any OpenAI-compatible AI (joins router) or MCP server (handshake-tested); GitHub PAT → browse repos, pull files into builds |
| Multi-model teams | **Teams** tab: group models as vote / pipeline / debate; select team in chat top bar |
| Build from prompt AND files | Attach files (right panel) → they join chat context and builder context |

## Quick start (Kali)

```bash
cd hermes-chat
cp .env.example .env   # then add free keys (any subset works)
npm install
npm run dev            # http://localhost:3000  (also reachable on your LAN IP)
```

Production:

```bash
npm run build && npm start
```

### Free keys (get any — router uses whatever exists)

- Groq: https://console.groq.com — `GROQ_API_KEY`
- Gemini: https://aistudio.google.com — `GEMINI_API_KEY`
- OpenRouter: https://openrouter.ai — `OPENROUTER_API_KEY` (use `:free` models)
- Together: https://together.ai — `TOGETHER_API_KEY`
- HuggingFace: https://huggingface.co — `HF_TOKEN`

### Fully free, no keys: Ollama (local)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull llama3.1
# Hermes auto-detects it at OLLAMA_BASE_URL (default http://localhost:11434)
```

### Your existing Odysseus note

Your `~/odysseus` venv install already succeeded — Hermes is standalone and does **not**
need Docker. If you want Docker later on Kali: `sudo apt install -y docker.io docker-compose-plugin`
(just `docker-cli` has no daemon; `podman-docker` conflicts with it). Hermes runs with plain `npm`.

## How the router works

1. Registry = env providers + UI-added MCP/LLM endpoints + Ollama locals (`src/lib/providers.ts`).
2. Each reply bumps `data/usage.json` for `today → model`.
3. Chain order: your preferred model → highest quality free → Ollama last-resort.
4. Any 429 / quota / 5xx / empty / timeout → next model, up to the whole chain.
5. Zero providers reachable → clearly-marked **demo echo** (setup instructions) so the UI never dead-ends.

Tune caps in `.env`: `LIMIT_GROQ_PER_DAY`, `LIMIT_GEMINI_PER_DAY`, `LIMIT_OPENROUTER_FREE_PER_DAY`, …

## API map

- `GET /api/models` — registry + today's quotas
- `POST /api/chat` — `{ messages, modelId?, teamId?, fileIds?[] }` → `{ text, modelId, tried[], switched }`
- `GET/POST/DELETE /api/chats` — conversation history
- `POST /api/uploads/init|chunk|complete`, `GET/DELETE /api/uploads`, `GET/DELETE /api/uploads/[id]`
- `GET/POST /api/mcp`, `POST(test)/DELETE /api/mcp/[id]`
- `GET/POST /api/teams`, `DELETE /api/teams/[id]`
- `GET/POST /api/builder`, `GET/POST(fix)/DELETE /api/builder/[id]`
- `GET/POST /api/connections/github` — connect / repos / file

## Data layout

```
data/
  usage.json        daily counters (auto-resets by date key)
  chats.json        conversations
  uploads.json      metadata · uploads/files/ = bytes (kept until deleted)
  mcp.json          your added AIs + MCP servers
  teams.json        model teams
  builds/           generated apps (meta.json + files)
```

## Troubleshooting

- **Demo mode reply**: no provider reachable — add a key to `.env` and restart, or start Ollama.
- **Ollama model 404**: `ollama pull <name>` first (registry lists common names; pull what you use).
- **Port in use**: `npm run dev -- -p 3001` or `PORT=3001 npm run dev`.
- **Large uploads stall**: same chunk size both ends — default 5 MB in `.env` (`UPLOAD_CHUNK_BYTES`).
- **Kali Node too old**: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs`.
