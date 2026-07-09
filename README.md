<div align="center">

<img src="assets/banner.png" width="100%" style="border-radius: 12px;" />

</div>

<p align="center">
  <img src="assets/logo.png" width="120" height="120" style="border-radius: 24px;" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33.4-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white" />
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=ts,react,electron,nodejs,vite&theme=dark" alt="Tech Stack" />
</p>

---

> **Plexus** is the native work coordination layer for Thoughtseed employees. Each person gets a **native assistant runtime** that can read bounded local work context, group local AI sessions, suggest existing app actions, and send daily work events through the Thoughtseed Worker/Hermes path — all with **zero device secrets** and **email-only login**.
>
> Plexus is not a port of the founder's Paperclip setup. It is a **synthesis platform**: the native assistant is the center, and Fabric/Paperclip is an optional helper layer for enrichment, diagnostics, and vault context when available.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### ⏱ Repo-Backed Focus Sessions
Start, pause, and close work sessions against verified GitHub-backed projects. Local state is a recovery cache, while reviewable work proof lives in the project repository.

</td>
<td width="50%" valign="top">

### 📁 Project Workspace
Color-coded projects synced from TeamForge, enriched with vault context — decisions, handoffs, and active work from R2 storage.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🤖 Native Assistant Runtime
Ask a local-first assistant about today's work, grouped AI sessions, reports, project evidence, and existing Plexus actions. Model calls, context reads, and action permissions are owned by the Electron main process.

</td>
<td width="50%" valign="top">

### 📊 Daily Events + Evidence
Daily assistant events roll up focus sessions, project state, GitHub activity, blockers, hours, and missing-proof status, then queue locally or travel Plexus -> Worker/Hermes -> R2/vault.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### ⚙️ Preferences
Set focus areas, working hours, CEO referral, comms prefs. Saved to the cloud and synced into your agent context.

</td>
<td width="50%" valign="top">

### 🔮 Auto-Learning Loop
The assistant evolves from your real usage. 30-day activity patterns (projects, focus blocks, time cadence) feed back into assistant context, generating personalized suggestions, adjusting priorities, and surfacing burnout risk — without manual configuration.

</td>
</tr>
</table>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 🚀 Quick Start

```bash
git clone https://github.com/Sheshiyer/plexus-ts.git
cd plexus-ts
npm install
npm run dev
```

**Build for production:**

```bash
npm run build
```

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 🏗 Architecture

### Native assistant first, helpers optional

Plexus does **not** clone or fork `thoughtseed-paperclip`. The founder's Paperclip instance is a single-tenant reference implementation — 6 hardcoded agents, the founder's specific models, and a vault structure tuned to one person's workflow.

Plexus extracts the **organizational patterns** (bounded context, evidence-backed coordination, daily reporting, vault-based handoffs, and member-scoped bridge custody) and makes them available as a **parameterized, learning platform** where each employee gets their own native assistant that:

1. **Provisions** from the TeamForge Worker — role, projects, workspace context arrive at login
2. **Reads bounded local context** through main-process IPC — SQLite, app state, and AI session groups never flow directly through the renderer
3. **Routes model calls safely** through provider settings and fallback behavior while keeping keys out of renderer state
4. **Confirms actions explicitly** before write-capable tools such as timer starts, standup generation, or project sync
5. **Delivers daily evidence** through Plexus -> Worker/Hermes -> R2/vault, with a local queue when the Worker path is offline
6. **Uses Fabric/Paperclip optionally** for helper health, enrichment, and vault context without making it the app's runtime center

```mermaid
graph TB
    subgraph "Per-Employee Machine"
        A[🖥️ Plexus Electron] --> B[(SQLite Cache)]
        A --> C[🔌 IPC Bridge]
        C --> D[⚛️ React Renderer]
        A --> E[🧠 Native Assistant Runtime]
        E --> F[📚 Bounded Context<br/>entries + reports + sessions]
        E --> G[✅ Action Confirmations]
        A --> H[📎 Optional Helpers<br/>Fabric / Paperclip]
    end
    
    subgraph "Shared Infrastructure"
        I[🔒 Cloudflare Access] --> J[☁️ Thoughtseed Worker /v1/*]
        J --> K[(D1 Canonical)]
        J --> L[(R2 / Vault Artifacts)]
        J --> M[🕊️ Hermes]
    end
    
    A -->|JWT| I
    J -->|provision bundle| A
    J -->|KPI + projects| A
    A -->|time entries + usage signals| J
    E -->|daily assistant event| J
    E -->|fallback signed member bridge| M
    M --> L
    H -. optional enrichment .-> F
    
    subgraph "Learning Loop"
        N1[⏱ Track time] --> N2[📊 Usage signals]
        N2 --> N3[🔮 30-day patterns]
        N3 --> N4[🧠 Assistant context updated]
        N4 --> N5[💡 Personalized suggestions]
        N5 --> N1
    end
```

### What each employee gets vs. what the founder has

| Dimension | Founder (thoughtseed-paperclip) | Employee (Plexus) |
|-----------|--------------------------------|-------------------|
| **Runtime center** | Paperclip local agent org | Plexus native assistant service |
| **Agents** | Fixed 6 Krebs agents, founder-tuned | Assistant-first UX with optional helper/agent enrichment |
| **Models** | Founder's model choices (kimi-k2.6, qwen3-coder, etc.) | Provider-routed assistant model settings with fallback behavior |
| **Skills** | Founder's full skill routing map | Explicit Plexus tool intents, split into read-only and confirm-required actions |
| **Vault** | Founder's vault with all project data | Employee-scoped daily events and artifacts via Worker/Hermes -> R2/vault |
| **Config source** | Local `.env` + `manifest.yaml` | Worker-provisioned after email login — zero device secrets |
| **Learning** | Weekly self-evolution on founder's patterns | Continuous auto-learning from tracked time, focus, session groups, and cadence |
| **Daily report** | CEO aggregates, Hermes dispatches (cron) | Assistant queues/sends daily events through Worker/Hermes; local queue on outage |
| **Tasks** | Huly integration (founder-managed) | Worker/Fabric task surfaces remain optional helper context |

### Zero-Secrets Model

All configuration and credentials flow from the TeamForge Worker after Cloudflare Access login. Nothing sensitive is stored on the device.

| Layer | Responsibility | Auth |
|-------|---------------|------|
| **Cloudflare Access** | OTP email login, JWT issuance | Team app / Operators app |
| **TeamForge Worker** | Member provisioning, KPI, preferences, time entries, project data | CF Access JWT |
| **Plexus (Electron)** | Local SQLite cache, timer, UI, native assistant runtime, usage signal capture | Receives JWT from Access |
| **Native Assistant** | Bounded local context, session grouping, model routing, action confirmation, daily queue | Main-process runtime, Worker-provisioned config |
| **Optional Helpers** | Paperclip/Fabric health, vault enrichment, diagnostics | Local helper runtime when installed/enabled |
| **R2 + D1** | Canonical project data, time entries, vault artifacts, OTA releases | Worker-mediated |

Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

### The Learning Loop

```
Employee works → Plexus captures usage signals (project, duration, focus blocks, cadence)
    → Signals accumulate in D1 via Worker
    → usage-evolution.sh aggregates 30-day patterns
    → Assistant context updated with insights + suggestions
    → Assistant adapts suggestions, daily context, and task priority
    → Employee sees personalized suggestions in next session
    → Cycle repeats — no manual tuning required
```

This is the core differentiator: the assistant runtime is not static infrastructure. It is a **living system that gets better at serving each employee** through their actual work, not through configuration.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 📂 Project Structure

```
plexus-ts/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # IPC handlers, auth, timer logic
│   │   ├── fabric.ts      # Optional helper health + enrichment reader
│   │   ├── teamforge.ts   # Worker API client, member provisioning
│   │   └── db.ts          # SQLite schema & queries
│   ├── preload/           # contextBridge preload script
│   ├── renderer/          # React UI (Vite)
│   │   ├── components/
│   │   │   ├── Timer.tsx
│   │   │   ├── AgentFabricPanel.tsx   # Optional helper health + bridge status
│   │   │   ├── PreferencesPanel.tsx   # ⚙️ Member preferences
│   │   │   └── ...
│   │   └── App.tsx
│   ├── shared/
│   │   └── types.ts       # Shared TypeScript contracts
│   └── db/                # SQLite migrations
├── dist/                  # Compiled output
├── assets/                # Icons, banner, logo
├── package.json
└── README.md
```

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 🔌 Integrations

### Native Assistant Runtime
Each employee's Plexus provisions a **native assistant runtime** — not a copy of the founder's agents, but a local-first assistant adapted to their role, projects, session history, and evolving work patterns. The Electron main process owns context reads, model calls, action permissions, daily event queueing, and bridge token custody. The renderer receives typed snapshots, suggestions, streams, and confirmation prompts.

### Optional Fabric/Paperclip Helpers
Fabric/Paperclip remains useful, but it is no longer the center of the assistant architecture. When installed and enabled, helpers can enrich assistant context with vault status, helper health, and local agent signals. When disabled or offline, Focus Session, Reports, daily event queueing, and assistant setup still remain usable.

- **Provisioning** — Worker returns the employee's project set, role, workspace, and feature flags
- **Preferences** — focus areas, working hours, and comms style flow into agent context
- **Usage learning** — 30-day tracked-time patterns continuously reshape agent behavior
- **Daily event loop** — assistant reads bounded local context, queues daily events locally, and sends Plexus -> Worker/Hermes -> R2/vault when online
- **Task context** — Worker/Fabric task surfaces can enrich suggestions without becoming required runtime dependencies

### TeamForge Control Plane
Cloudflare Worker at `plexus-api.thoughtseed.space` is the canonical source for all member data — time entries, KPIs, preferences, project data, and R2 vault artifacts. The Worker also brokers Cloudflare Realtime SFU sessions for live media. No device secrets required.

### Thoughtseed Bridge / Hermes
Member-scoped bridge path for daily assistant events, heartbeats, evidence, and downstream directives. Plexus must never store the Worker admin `BRIDGE_TOKEN`; it stores only scoped per-member bridge tokens in the main process. Daily events target Worker/Hermes and land in R2/vault when the remote path confirms them; offline Worker state remains a local queue until retried.

### Cloudflare Access
Email-only OTP login. Zero passwords. Zero tokens stored locally. The `CF_Authorization` cookie is issued by Access and validated by the Worker.

### Cloudflare Realtime (SFU)
WebRTC media transport for team video/audio/screen-share. Worker brokers all SFU API calls — clients never hold Cloudflare secrets. Room state, participants, and meeting records live in D1.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 🧪 Assistant Runtime Smoke Prep

Manual renderer checks for the native assistant rollout live in [`docs/evidence/assistant-runtime-smoke-checklist.md`](docs/evidence/assistant-runtime-smoke-checklist.md). That checklist separates deterministic local UI proof from live Worker/Hermes/R2 proof so docs do not imply a remote path was verified before credentials and endpoints are available.

## 🚦 Production Readiness Gate

Use [`docs/RELEASE_EVIDENCE.md`](docs/RELEASE_EVIDENCE.md) before claiming a Plexus binary is production-ready. The executable local gate is:

```bash
npm run verify:all
```

That gate now includes lint, typecheck, placeholder scan, production dependency audit, Electron fuse verification, renderer CSP verification, release evidence policy checks, all Vitest suites, deterministic smoke checks, and the renderer build. Signed OTA releases still require the Release workflow and live signed upgrade proof. Live Paperclip admin proof remains an explicit manual evidence command, `npm run smoke:admin-fabric-paperclip`, and is not part of CI-safe `smoke:all`.

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

### v0.5.2 — Release-Proof Gate (2026-07-09)

- Added production dependency audit, renderer CSP, release evidence, Electron fuse, and deterministic smoke gates to `verify:all`.
- Split live Paperclip admin proof from CI-safe deterministic smoke checks.
- Added `docs/RELEASE_EVIDENCE.md` and `docs/SECURITY_AUDIT_WAIVERS.md` for production-ready claims.

### v0.4.0 — Co-working (2026-06-17)

- 👥 New Co-working tab — ambient presence floor + project rooms + persistent lounge
- 🟢 Avatar rings encode context (timing / online / in-lounge / idle)
- 🎙 Persistent ambient voice strip replaces formal meeting closeout
- 🚪 Exit controls for lounge/project-room joins with single-active-room transitions
- 🧵 All driven by existing `/v1/realtime/*` infrastructure — no new endpoints
- 🎨 35 new theme classes + gpt-image-2 visual reference committed

### v0.3.4 — Tray fix (2026-06-17)

- 🍎 macOS tray icon now renders on packaged installs (asarUnpack + explicit setTemplateImage + isEmpty guard)

### v0.3.3 — Clio (2026-06-17)

- 🔐 Auth recovery: full CF Access partition clear on logout (fixes “OTP already used” on fresh codes)
- 📊 Reports KPI no longer renders as NaN (handler unwrap + `?? 0` guards)
- 🧩 Packaged-app Paperclip binary detection (checks Homebrew/Bun paths directly)
- 🧹 Removed retired-repo enrichment panels (Organization / Agent Skills / Task Feed / Project Vault)

### v0.3.2 — Agent Fabric Enrichment (2026-06-16)

- 🧩 Paperclip install detection + dynamic port discovery
- 🏢 Org config, agent-skill, and task-feed panels from the local fabric
- 🗂 Per-project vault detail wired into Projects
- 🩹 Hardened onboarding / KPI / vault fetches (error surfacing + auto-refresh)
- 🧹 Removed dead `PlexusViz` component

### v0.3.1 — Permissions + WebRTC (2026-06-16)

- 🎙 macOS media entitlements (mic + camera) for packaged builds
- 📡 WebRTC session manager for Cloudflare Realtime SFU
- 🔐 Onboarding permissions panel with auto-request
- 🖥 Screen recording settings launcher

### v0.3.0 — Realtime Workspace (2026-06-15)

- 🎥 Realtime tab with room lobby, audio/video controls, multi-screen-share
- 📞 Meeting records linked to projects and time entries
- 🔄 OTA update proven end-to-end (0.2.0 → 0.3.0)

### v0.2.0 — Agent Fabric Release (2026-06-12)

- 🤖 Agent Fabric Panel with live health tiles
- 📊 Auto-generated standup + KPI from canonical D1
- ⚙️ Preferences UI synced to agent context
- 🔮 Usage-learning insights + agent suggestions
- 🔒 Zero-device-secrets architecture via Cloudflare Access
- 🧹 Legacy bridge fully retired

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 🛡 Security

- Renderer is **untrusted** — no Node access
- All IPC payloads validated in main process
- SQLite WAL mode for atomic writes
- Settings stored in `~/.plexus/plexus.db`
- No remote content loaded with Node privileges
- **Zero secrets**: all auth flows through Cloudflare Access; credentials never stored on disk

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 📜 License

MIT © Thoughtseed

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%" />

**Built with ❤️ by Thoughtseed**

</div>
