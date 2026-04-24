# Scadder Architecture & Philosophy

Scadder was built to solve the OpenSCAD distribution problem. However, in building a package manager and web viewer for a 15-year-old compiler, I had to make strict, highly opinionated architectural choices. This document outlines the constraints I embraced and the philosophies that drive the toolchain.

### 1. State Without Storage (Serverless by Design)
Scadder refuses to introduce vendor lock-in. I do not want your email, I do not require accounts, and I do not maintain a centralized database of user models. 
* **The URL is the Database:** When you customize a model in the web viewer, the AST delta-diff is compressed directly into the URL. You can share exact geometric states instantly.
* **GitHub is the VFS:** I use `raw.githubusercontent.com` as our global CDN and file system. 
* **Discussions as a Database:** I utilize GitHub Discussions (via Giscus) to handle community comments. If Scadder's frontend goes down tomorrow, your models and your conversations still exist natively on GitHub.

### 2. Zero Side-Effects (Respecting the Host)
A package manager should adapt to the developer, not force the developer to adapt to the package manager. The Scadder CLI operates on a strict "read-only" environment policy.
* **`OPENSCADPATH` is Sacred:** When resolving global frameworks, the CLI reads your custom `OPENSCADPATH` to prevent redundant downloads, but it will *never* write to it.
* **No Hidden Mutations:** I do not automatically edit your `.gitignore` files, nor do I alter your OS-level environment variables. If an installation requires OS-level placement, it goes strictly into the default OpenSCAD library directory.

### 3. Hybrid Dependency Management
OpenSCAD natively lacks namespace isolation. Evaluating two different versions of the same monolithic framework (like BOSL2) in the same project results in catastrophic memory collisions. 
* **Standard Components:** Installed locally and nested inside `.scadder_modules/`, strictly locked to specific Git commit SHAs via `scadder.json` to ensure deterministic builds.
* **Monolithic Frameworks:** Treated as **OS-Level Peer Dependencies**. Scadder delegates framework resolution to the host machine. I cannot fix the C++ compiler's lack of namespaces from the outside, so I gracefully route around it by ensuring global libraries remain singular.

### 4. Decentralized Metadata (The Scadder Docblock)
While centralized registries (like NPM) are standard in software, they create bottlenecks in decentralized hardware communities. Scadder introduces the **Docblock Frontmatter** standard.
* By adding a simple JSDoc-style comment block (`@name`, `@author`, `@requires`) to the top of a `.scad` file, creators turn their raw code into its own package manifest. 
* The Scadder Web Viewer parses this raw AST before applying any URL state patches, locking the UI to the original author's metadata. This secures the chain of trust against URL-spoofing while allowing complete decentralization.