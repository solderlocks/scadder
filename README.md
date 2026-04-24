# Scadder

**An npm-style OpenSCAD dependency manager, serverless browser-based customizer, and viewer.**

[![npm version](https://img.shields.io/npm/v/scadder)](https://www.npmjs.com/package/scadder)
[![npm downloads](https://img.shields.io/npm/dt/scadder)](https://www.npmjs.com/package/scadder)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Scadder brings `npm`-style dependency resolution to OpenSCAD. Install models and their full dependency trees with one command, lock them to a commit hash, and update on demand. The [web viewer](https://scadder.dev) lets you customize, render, and share models directly in a browser, no account required.

```bash
npm install -g scadder
scadder install parametric-sign
```

---

## CLI Package Manager

> The full CLI reference is in [README-npm.md](README-npm.md). What follows is the essentials.

<img width="2074" height="885" alt="scadder-cli-screenshot-cropped-scaled" src="https://github.com/user-attachments/assets/7413723c-e9d5-489e-8999-ad885aa14af0" />

*Installing a Gridfinity model and its 41 nested dependencies in a single command.*

### Install a model

Navigate to any OpenSCAD project directory and run:

```bash
scadder install parametric-sign
```

Scadder fetches the model and recursively resolves every `include` and `use` dependency, dropping them into a `.scadder_modules/` folder — the same pattern as `node_modules`. A `scadder.json` lockfile is generated automatically, pinning each dependency to a specific GitHub commit SHA so your project never breaks from an upstream change.

### Install from any URL

Not restricted to the community library. Pass any `.scad` URL and the crawler handles the rest:

```bash
scadder install https://github.com/openscad/openscad/blob/master/examples/Parametric/sign.scad
```

*(The host must have a permissive CORS policy — `raw.githubusercontent.com` and most static file servers work fine.)*

### Monolithic frameworks (BOSL2, NopSCADlib, etc.)

Standard components install locally to `.scadder_modules/`. Massive monolithic frameworks are treated as **peer dependencies** — installing them per-project would create multi-megabyte duplicates and cause global namespace collisions inside OpenSCAD. Scadder expects them in your OS-level OpenSCAD libraries directory or `OPENSCADPATH`.

If a missing framework is detected during a crawl:

```
⚠️ Missing Peer Dependency: [BOSL2]. Install it manually or re-run with --install-globals
```

To have Scadder automatically download and install missing frameworks into your OS-level libraries folder:

```bash
scadder install <model-id> -g
```

If the framework already exists globally, Scadder detects it and skips the download. It will never overwrite directories in your `OPENSCADPATH`.

### Updating dependencies

Fast-forward all locked dependencies to their latest upstream commits:

```bash
scadder update all
```

Or target a specific package:

```bash
scadder update <package-name>
```

---

## Web Customizer & Viewer

**[→ Open the live viewer](https://scadder.dev)**

<img width="2074" height="2075" alt="scadder-screenshot-3b" src="https://github.com/user-attachments/assets/3ce2b7b9-f751-435e-98cc-0f00df068e15" />

A fully serverless, WASM-powered customizer. Paste a GitHub URL to any `.scad` file, tweak its parameters, and export an STL. No install, account, or server required.

**URL-serialized state.** Adjust a slider or edit the raw `.scad` directly. The diff is compressed and written into the URL so you can share an exact configuration with someone and they'll see what you see.

**Recursive dependency crawling.** The same crawler powering the CLI runs in-browser, recursively fetching `include` and `use` files from GitHub so renders don't break on models with deep dependency trees.

**Intelligent parameter controls.** Parameters are rendered as sliders, text inputs, dropdowns, or checkboxes based on their type and the inline comments in the `.scad` source. Ranges and step sizes are inferred automatically. JSDoc-style docblock comments (`@name`, `@description`) are surfaced in the UI as field labels and tooltips.

**Discuss any model.** Comments are handled by [Giscus](https://giscus.app/), which backs the discussion thread onto GitHub Discussions. No database to maintain.

**Mobile-friendly.** Actually usable on a phone. Tweak parameters and export STLs while standing next to your printer.

### Why serverless?

There's no central database to go down, no compute limits, and no server costs to maintain. Models are fetched directly from GitHub and rendered in-browser via OpenSCAD WASM. You can fork this repo, point it at your own `config.json`, and have a standalone viewer and discussion board for your own library in minutes.

---

## Project Structure

This is a monorepo. The dependency resolution and AST parsing logic is environment-agnostic and shared between the CLI and the web viewer via `/core/`.

```
/core   Environment-agnostic dependency resolution and AST parsing logic
/web    The serverless web customizer and viewer
/cli    The local package manager and terminal utility
```

---

## Running Locally / Self-Hosting the Viewer

You don't need to install anything to use the [live viewer](https://scadder.dev). To run it locally or host your own instance:

```bash
git clone https://github.com/solderlocks/scadder.git
npm install
npm run dev
# → http://localhost:3001/web/
```

Fork the repo and update `config.json` to point to your own model library and GitHub Discussions repo.

---

## Acknowledgements & Licensing

Scadder is released under the **[GPLv3 License](LICENSE)**. Fork it, remix it, build on it — but keep it open. If you use or modify this code, your version must remain open source as well.

If you use Scadder in your own projects, please attribute the original work by linking back to this repository and [jscottk.net](https://jscottk.net/).

The web viewer's WASM rendering layer builds directly on the foundational work of the [OpenSCAD.cloud](https://openscad.cloud/) team. This project would not exist without their work porting OpenSCAD to WebAssembly.

**AI Disclosure:** This project was developed with assistance from AI coding agents (Antigravity / Claude) to accelerate implementation, documentation, and logic refinement.
