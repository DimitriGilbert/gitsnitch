# git-snitch

git-snitch is a pnpm/Turborepo monorepo created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack). It contains the v1 package scaffolding for a TypeScript CLI that generates standalone git activity reports, plus a TanStack Start marketing site.

## Package Manager

Use `pnpm` from the repository root. Do not use npm, yarn, bun, or parent-repository lockfiles for this workspace.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the marketing site during local development when needed:

```bash
pnpm run dev:web
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.

## Available Scripts

- `pnpm run build`: Build all workspace packages and apps that define a build task.
- `pnpm run typecheck`: Type-check all workspace packages and apps that define a typecheck task.
- `pnpm run check-types`: Better-T-Stack-compatible alias for workspace type checks.
- `pnpm run test`: Run all workspace tests that define a test task.
- `pnpm run lint`: Run workspace lint tasks when package-level lint scripts are present.
- `pnpm run dev`: Start all development tasks.
- `pnpm run dev:web`: Start only the TanStack Start marketing site.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@git-snitch/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
git-snitch/
├── apps/
│   ├── cli/         # CLI command entrypoint package
│   └── web/         # Marketing site (React + TanStack Start)
├── packages/
│   ├── config/      # Shared TypeScript configuration
│   ├── core/        # Git data, config, analysis, and report generation package
│   ├── env/         # Shared environment validation helpers
│   ├── renderer/    # Standalone report renderer package
│   └── ui/          # Shared shadcn/ui components and styles
```

## Phase 1 Package Roles

- `apps/cli` owns the future `git-snitch` command entrypoint. Phase 1 only exposes package metadata so the package has a real public contract to build and test.
- `apps/web` remains the generated Better-T-Stack TanStack Start app and serves as the required marketing site.
- `packages/core` owns future git data gathering, config loading, analysis, and report generation APIs. Phase 1 only exposes package metadata.
- `packages/renderer` owns future standalone report rendering and template build APIs. Phase 1 only exposes package metadata.
- `packages/ui` remains the only source of truth for shared shadcn/ui primitives.
