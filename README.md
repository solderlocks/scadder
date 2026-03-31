# Scadder ⚡

**A serverless customizer, viewer, and dependency manager for OpenSCAD.**

Sharing parametric models right now usually means fighting with broken customizers, closed-ecosystem web platforms, or passing around massive `.zip` files full of duplicated local libraries. 

Scadder is an open-source toolchain designed to improve the distribution pipeline for OpenSCAD by letting you share, customize, and resolve dependencies directly from GitHub.

## The Toolchain

* **[Web Customizer & Viewer](https://solderlocks.github.io/scadder/web/):** A serverless, WASM-powered web frontend. 
    * **URL State & Direct Editing:** Tweak parameters in the UI or directly edit the raw `.scad` code. The AST delta-diff is compressed and serialized directly into the URL, allowing backend-free sharing of custom geometric states.
    * **Decentralized Metadata (Docblocks):** Parses JSDoc-style comment blocks (e.g., `@name`, `@author`, `@description`) at the top of files to natively hydrate the UI and secure the model's metadata against spoofed URL patches.
    * **Dependency Crawling:** It recursively fetches `include` and `use` files directly from GitHub repos so renders don't break.
    * **Mobile-Friendly:** Actually usable on a phone, so you can tweak parameters and export STLs while standing next to your printer.
* **CLI Package Manager:** A lightweight Node.js utility that brings `npm`-style dependency resolution to local OpenSCAD development. It pulls cloud-hosted dependencies into your local workflow via a `library.json` config.
    * **Hybrid Dependency Resolution:** Standard components install locally to `.scadder_modules/`, while monolithic frameworks (like BOSL2) are treated as peer dependencies and routed directly to the OS-level OpenSCAD library folder via the `-g` flag. The CLI natively respects your `OPENSCADPATH` as a read-only search path to prevent redundant downloads.

## Project Structure
* `/core`: Environment-agnostic dependency resolution and AST parsing logic.
* `/web`: The frontend web application.
* `/cli`: The local package manager and terminal utility.

## Why serverless?
Scadder is designed to be completely decentralized. There is no central database to go down, no compute limits, and no server costs to maintain. 
* **No Accounts:** I don't want your email. Just tweak the model and download the STL.
* **Client-Side Rendering:** Models are fetched directly from GitHub and compiled in your browser using OpenSCAD WASM. 
* **Zero-Maintenance DB:** Model discussion and comments are handled by hijacking GitHub Discussions via Giscus, turning a designated repo into a free relational database. 

You can easily fork this repo and point it at your own `config.json` to host your own standalone viewer and discussion board.

## Using Scadder

### The Web Viewer
You don't need to install anything to use the viewer. Just visit the live site. However, if you want to run the viewer locally or host your own instance:

1. Clone the repository: `git clone https://github.com/solderlocks/scadder.git`
2. Install dependencies: `npm install`
3. Start the local server: `npm run dev`
4. Open `http://localhost:3001/web/` in your browser.

### The CLI Package Manager
Scadder brings `npm`-style dependency management to OpenSCAD, allowing you to pull cloud-hosted models into your local projects with deterministic lockfiles.

Install the CLI globally:
```bash
npm install -g scadder
```

Navigate to any OpenSCAD project directory on your computer and run:
```bash
scadder install parametric-sign
```

This fetches the model and its nested `include` and `use` dependencies, dropping them into a `.scadder_modules` folder. It also generates a `scadder.json` file, locking the dependency to its specific GitHub commit hash so your project won't break if the upstream author pushes changes.

To update your locked packages to the latest commits:
```bash
scadder update all
```

### Install via Direct URL
Scadder isn't restricted to the community library. You can pass a direct URL to any `.scad` file, and the crawler will recursively resolve and download all nested files. 

*(Note: The host must have a permissive CORS policy, such as `raw.githubusercontent.com` or a standard static file server).*

```bash
scadder install [https://github.com/openscad/openscad/blob/master/examples/Parametric/sign.scad](https://github.com/openscad/openscad/blob/master/examples/Parametric/sign.scad)
```

## Acknowledgements & Licensing
Scadder is released under the **[GPLv3 License](LICENSE)**.

**Open Source Philosophy:** I built this tool to be free and open for the community. The GPLv3 license means you are highly encouraged to fork, remix, and build upon this architecture. However, it explicitly prevents anyone from taking this code, closing the source, and putting it behind a proprietary paywall. If you use or modify this code, your version must also remain open. 

If you use Scadder in your own projects, I kindly request that you attribute the original work by linking back to this repository and my portfolio: [jscottk.net](https://jscottk.net/).

This project relies on the incredible work of the OpenSCAD community. Specifically, the web viewer architecture is heavily indebted to the foundational WebAssembly (WASM) porting and compilation logic developed by the [OpenSCAD.cloud](https://openscad.cloud/) team. Scadder builds upon their shoulders to provide this decentralized distribution pipeline.