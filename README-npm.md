# Scadder CLI ⚡

**A decentralized dependency manager for OpenSCAD.**

> **Note:** This package contains *only* the Scadder CLI utility. The serverless web customizer and viewer are hosted live at [scadder.dev](https://scadder.dev), and the full monorepo source is available on [GitHub](https://github.com/solderlocks/scadder).

Sharing parametric models usually means fighting with broken customizers or passing around massive `.zip` files full of duplicated local libraries. Scadder brings `npm`-style dependency resolution to local OpenSCAD development, allowing you to pull cloud-hosted models and their nested dependencies directly into your local workflow.

## Installation

Install the CLI globally to use it across all your projects:

```bash
npm install -g scadder
```

## Usage

Navigate to any OpenSCAD project directory on your computer and run:

```bash
scadder install <model-id>
```

This will fetch the model and all of its nested `include` and `use` dependencies, dropping them into a `.scadder_modules` folder in your current directory so your local renders never break. (Available community model IDs are defined in the project's `library.json` , like `parametric-sign`).

### Install via Direct URL

Scadder isn't restricted to a curated community library. You can pass a direct URL to any `.scad` file, and the crawler will recursively resolve and download all nested `include` and `use` dependencies.

*(Note: The host must have a permissive CORS policy, such as `raw.githubusercontent.com` or a standard static file server).*

```bash
scadder install https://github.com/openscad/openscad/blob/master/examples/Parametric/sign.scad
```

## Deterministic Builds (scadder.json)

When you install a dependency, Scadder automatically generates a `scadder.json` file to track your project's graph. 

If you install a package from a GitHub repository, Scadder contacts the GitHub API to intercept the latest `HEAD` commit and permanently locks your dependency to that specific SHA hash. This ensures that your local OpenSCAD project will not unexpectedly break if an upstream author pushes a breaking change to their `main` branch. 

## Global Frameworks vs. Local Components

Standard dependencies are installed locally to `.scadder_modules/` in your project directory. However, massive monolithic frameworks like **BOSL2** or **NopSCADlib** are treated differently — Scadder recognizes them as **Peer Dependencies**.

Installing these frameworks into every project folder would create duplicate multi-megabyte copies and cause global namespace collisions inside OpenSCAD. Instead, Scadder expects them to live once in your OS-level OpenSCAD library directory (e.g., `~/Documents/OpenSCAD/libraries` on macOS).

By default, if a missing framework is detected during a crawl, Scadder will skip the download and log a warning:

```
⚠️ Missing Peer Dependency: [BOSL2]. Install it manually or re-run with --install-globals
```

To have Scadder automatically download and extract any missing frameworks directly into your OS-level OpenSCAD libraries folder, append the `--install-globals` (or `-g`) flag:

```bash
scadder install <model-id> -g
```

If the framework already exists globally, Scadder will detect it and skip the download automatically.

## Updating Dependencies

To fast-forward your locked dependencies to their latest upstream commits, run:

```bash
scadder update all
```

You can also target specific packages:

```bash
scadder update <package-name>
```

## Licensing

Scadder is released under the **GPLv3 License**.

If you use or modify this code, your version must also remain open. If you use Scadder in your own projects, I kindly request that you attribute the original work by linking back to the [GitHub repository](https://github.com/solderlocks/scadder) and my portfolio: [jscottk.net](https://jscottk.net/).