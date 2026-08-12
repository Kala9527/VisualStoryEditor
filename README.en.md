# Visual Story Editor

Visual Story Editor is a visual editor for RPG stories, interactive fiction, and branching narratives. Built with Vue 3, Pinia, TypeScript, and Vite, it helps designers create, validate, preview, and export story graphs.

## Highlights

- Node-based editing for story, choice, condition, random, mutation, combat, and ending nodes.
- Runtime preview to simulate branches and state changes.
- Project import/export through JSON and Markdown.
- Local draft saving.
- Optional AI-assisted story text generation through OpenAI-compatible providers.
- Vitest coverage for runtime behavior, expressions, effects, and import/export flows.

## Structure

```text
.
├─ docs/
├─ src/
│  ├─ ai/
│  ├─ components/
│  ├─ data/
│  ├─ domain/
│  ├─ io/
│  ├─ runtime/
│  └─ stores/
├─ tests/
├─ package.json
└─ vite.config.ts
```

## Run Locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

The default URL is `http://127.0.0.1:5173/`.

## Test And Build

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

The production build is written to `dist/`. It can be deployed as a static site or packaged with `DistDesktopLauncher`.

## Deployment

Upload the `dist/` folder to any static hosting service. If deploying under a subpath, adjust Vite's `base` option. AI generation requires user-provided compatible endpoints and API keys.

## Thanks

Thank you for visiting this project. If it helps you design clearer branching stories, a Star, Fork, issue, or suggestion would be deeply appreciated.
