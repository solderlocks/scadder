# Scadder ⚡

**A serverless customizer, viewer, and dependency manager for OpenSCAD.**

Sharing parametric models right now usually means fighting with broken customizers, closed-ecosystem web platforms, or passing around massive `.zip` files full of duplicated local libraries. 

Scadder is an open-source toolchain designed to fix the distribution pipeline for OpenSCAD by letting you share, customize, and resolve dependencies directly from GitHub.

## The Toolchain

* **[Web Customizer & Viewer](https://solderlocks.github.io/scadder/web/):** A serverless, WASM-powered web frontend. 
    * **URL State:** Tweak parameters in the UI, and the state is serialized into the URL. You can share exact customizations without a backend database.
    * **Dependency Crawling:** It recursively fetches `include` and `use` files directly from GitHub repos so renders don't break.
    * **Mobile-Friendly:** Actually usable on a phone, so you can tweak parameters and export STLs while standing next to your printer.
* **CLI Package Manager:** A lightweight Node.js utility that brings `npm`-style dependency resolution to local OpenSCAD development. It pulls cloud-hosted dependencies into your local workflow via a `library.json` config.

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
Scadder brings `npm`-style dependency management to OpenSCAD, allowing you to pull cloud-hosted models into your local projects.

Install the CLI globally:
`npm install -g scadder`

Navigate to any OpenSCAD project directory on your computer and run:
`scadder install parametric-sign`

This will fetch the model and all of its nested `include` and `use` dependencies, dropping them into a `.scadder_modules` folder in your current directory so your local renders never break. (All model IDs are defined in `/core/library.json`).

## Acknowledgements & Licensing
Scadder is released under the **[GPLv3 License](LICENSE)**.

**Open Source Philosophy:** I built this tool to be free and open for the community. The GPLv3 license means you are highly encouraged to fork, remix, and build upon this architecture. However, it explicitly prevents anyone from taking this code, closing the source, and putting it behind a proprietary paywall. If you use or modify this code, your version must also remain open. 

If you use Scadder in your own projects, I kindly request that you attribute the original work by linking back to this repository and my portfolio: [jscottk.net](https://jscottk.net/).

This project relies on the incredible work of the OpenSCAD community. Specifically, the web viewer architecture is heavily indebted to the foundational WebAssembly (WASM) porting and compilation logic developed by the [OpenSCAD.cloud](https://openscad.cloud/) team. Scadder builds upon their shoulders to provide this decentralized distribution pipeline.