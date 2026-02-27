# Scadder 🛠️

**A serverless customizer, viewer, and dependency manager for OpenSCAD.**

Sharing parametric models right now usually means fighting with broken customizers, closed-ecosystem web platforms, or passing around massive `.zip` files full of duplicated local libraries. 

Scadder is an open-source toolchain designed to fix the distribution pipeline for OpenSCAD by letting you share, customize, and resolve dependencies directly from GitHub.

## The Toolchain

* **[Web Customizer & Viewer](https://pollesbog.github.io/scadder/):** A serverless, WASM-powered web frontend. 
    * **URL State:** Tweak parameters in the UI, and the state is serialized into the URL. You can share exact customizations without a backend database.
    * **Dependency Crawling:** It recursively fetches `include` and `use` files directly from GitHub repos so renders don't break.
    * **Mobile-Friendly:** Actually usable on a phone, so you can tweak parameters and export STLs while standing next to your printer.
* **[CLI Package Manager](./cli):** A lightweight Node.js utility that brings `npm`-style dependency resolution to local OpenSCAD development. It pulls cloud-hosted dependencies into your local workflow via a `library.json` config.

## Project Structure
* `/core`: Environment-agnostic dependency resolution and AST parsing logic.
* `/web`: The frontend web application.
* `/cli`: The local package manager and terminal utility.

## The "Cursed" Architecture (Why serverless?)
Scadder is designed to be completely decentralized. There is no central database to go down, and no server costs to maintain. 
* Models are fetched directly from GitHub on the client side.
* Model discussion and comments are handled by hijacking GitHub Discussions via Giscus, turning a designated repo into a free, zero-maintenance relational database. 

You can easily fork this repo and point it at your own `config.json` to host your own standalone viewer and discussion board.

**License:** [GPLv3](LICENSE) (Built on the shoulders of the OpenSCAD WASM community).
