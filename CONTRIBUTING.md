# Contributing to Scadder

First off, thank you for considering contributing to Scadder! 

Scadder is currently in a high-velocity `0.x.x` phase. Before you write any code or submit a Pull Request, please read this document to ensure your time isn't wasted.

## The Golden Rule: Read the Philosophy
Scadder is designed to be **Serverless** and have **Zero Side-Effects**. 

Please read our [Architecture & Philosophy](philosophy.md) document before proposing features. 
* **I will reject** any PR that introduces a centralized database, requires server-side compute, or adds user authentication. 
* **I will reject** any CLI PR that writes to a user's `.gitignore` or forcefully modifies their OS-level `OPENSCADPATH`.

## Scope of Current Development (v0.x.x)
Right now, the focus is on stabilizing the core architecture across all platforms (macOS, Windows, Linux) and stress-testing the hybrid dependency manager. 

* **Bug Fixes:** Highly encouraged! Especially edge cases involving Windows file paths or obscure OpenSCAD syntax parsing.
* **Major Features:** Please open an Issue to discuss your idea *before* writing the code. I want to avoid merging massive feature creep before hitting `v1.0`.

## Local Development Setup

If you want to run the toolchain locally to test a bug fix:

1. **Clone the repo:**
   ```bash
   git clone [https://github.com/solderlocks/scadder.git](https://github.com/solderlocks/scadder.git)
   cd scadder
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the Web Viewer locally:**
   ```bash
   npm run dev
   ```
   *Then open `http://localhost:3001/web/` in your browser.*
4. **Test the CLI locally:**
   You can link the local CLI to your global environment to test package resolution:
   ```bash
   npm link
   scadder install <test-model-id>
   ```

## Submitting a Pull Request
1. Fork the repository and create your branch from `main`.
2. Ensure your code does not break the WASM compilation pipeline or the CLI's read-only environment checks.
3. Keep your commits atomic and descriptive.
4. Open a PR and reference any related Issues.