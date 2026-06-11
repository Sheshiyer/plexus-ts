<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&text=Plexus&fontSize=70&fontAlignY=35&desc=Time%20Tracker%20for%20Thoughtseed&descAlignY=55&fontColor=ffffff" width="100%" />

</div>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33.2-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white" />
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=ts,react,electron,nodejs,vite&theme=dark" alt="Tech Stack" />
</p>

---

> **Plexus** is the native time-tracking cockpit for Thoughtseed agents. Start timers, manage projects, generate reports — then bridge everything into Paperclip, MultiCA, TeamForge, and R2 for org-wide visibility.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### ⏱ One-Click Timer
Start, stop, and switch between projects instantly. Running timers persist across app restarts.

</td>
<td width="50%" valign="top">

### 📁 Project Management
Color-coded projects with client names, hourly rates, and billable flags.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📝 Manual & Timed Entries
Log time manually for back-filling or use the live timer for real-time tracking.

</td>
<td width="50%" valign="top">

### 📊 Daily / Weekly / Monthly Reports
Instant visual breakdowns with billable vs non-billable splits and project aggregates.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🔌 Paperclip Bridge
Sync time entries directly into the Paperclip vault so agents can read member work.

</td>
<td width="50%" valign="top">

### 🌉 MultiCA → TeamForge → R2
Push reports upstream to cofounders and archive monthly snapshots to Cloudflare R2.

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

```mermaid
graph LR
    A[🖥️ Electron Main] --> B[(SQLite DB)]
    A --> C[🔌 IPC Bridge]
    C --> D[⚛️ React Renderer]
    D --> E[⏱ Timer UI]
    D --> F[📊 Reports]
    A --> G[📎 Paperclip]
    A --> H[🌉 MultiCA]
    A --> I[☁️ R2 Archive]
```

### Process Model

| Process | Responsibility | Port |
|---------|---------------|------|
| **Main** | SQLite, file I/O, bridge APIs, timer ticker | — |
| **Preload** | Typed `contextBridge` exposing `window.plexus` | — |
| **Renderer** | React UI, charts, user interactions | Vite dev |

Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 📂 Project Structure

```
plexus-ts/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # contextBridge preload script
│   ├── renderer/       # React UI (Vite)
│   │   ├── components/
│   │   │   ├── Timer.tsx
│   │   │   ├── ProjectManager.tsx
│   │   │   ├── TimeEntryList.tsx
│   │   │   ├── Reports.tsx
│   │   │   └── BridgePanel.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── db/             # SQLite schema & queries
│   ├── bridge/         # Paperclip, MultiCA, R2 adapters
│   └── shared/         # Types & contracts
├── dist/               # Compiled output
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 🔌 Bridge Integrations

### Paperclip
Writes markdown time-reports into `vault/communications/time-reports/{memberId}-{month}.md` so CEO, Synthesist, and other agents can read employee work.

### MultiCA
Pushes structured `time_report` messages to the upstream bridge endpoint. Cofounders see aggregated member time in the MultiCA dashboard.

### TeamForge
MultiCA forwards meso-level time insights into TeamForge, feeding standup KPIs and sprint planning.

### R2 (Cloudflare)
Monthly JSON snapshots are archived to R2 for durable, long-term storage and compliance.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 🛡 Security

- Renderer is **untrusted** — no Node access
- All IPC payloads validated in main process
- SQLite WAL mode for atomic writes
- Settings stored in `~/.plexus/plexus.db`
- No remote content loaded with Node privileges

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=1" width="100%" />

## 📜 License

MIT © Thoughtseed

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%" />

**Built with ❤️ by Thoughtseed**

</div>
