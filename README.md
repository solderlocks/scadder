# Scadder 🛠️

**The Decentralized Ecosystem for Parametric Hardware.**

Scadder is an attempt to combat planned obsolescence through an open-source, version-controlled system. High-quality, long-lasting objects should be discoverable, customizable, and resilient to "link rot" and repository drift.

## The Problem
Most 3D hardware is shared as brittle, siloed files. Dependencies break, repositories disappear, and customization requires high-friction manual work.

## The Solution
Scadder provides a unified infrastructure for 3D objects:
* **[Web IDE](https://pollesbog.github.io/scadder/):** A serverless, browser-based OpenSCAD IDE with a recursive GitHub dependency crawler.
* **[CLI Tool](./cli):** A lightweight Node.js package manager to bring cloud-hosted dependencies into your local development workflow.
* **Core Registry:** A curated library of "buy-it-for-life" objects, from Gridfinity to precision mechanical parts.

## Project Structure
* `/core`: Environment-agnostic dependency resolution logic.
* `/web`: The frontend WASM-powered IDE.
* `/cli`: The local package manager and terminal utility.

---

## Philosophy: "No Consensus without Verification"
We don't take norms as gospel. Scadder operates on the edge cases and nuances that general consensus ignores. If the truth of a design is messy or counter-intuitive, we present the mess. Our goal is precision over palatability.

**License:** [GPLv3](LICENSE)