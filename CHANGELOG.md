# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-03-31

### Added
- **Scadder Docblock Support:** The web viewer now parses JSDoc-style comment blocks (Frontmatter) at the top of `.scad` files. It extracts `@name`, `@author`, and `@description` to hydrate the UI and secure metadata against spoofed URL patches.

### Changed
- **CLI Environment Check:** The `scadder install -g` command now reads the user's `OPENSCADPATH` environment variable as a read-only search path. This prevents redundant downloads of massive frameworks (like BOSL2) if the user already has them installed in a custom directory.

### Fixed
- **Windows Pathing:** Fixed an issue where the CLI's fallback library installation would fail on Windows due to improper tilde (`~`) expansion. It now correctly resolves OS-specific paths via Node's native `os.homedir()`.

## [0.2.0] - 2026-03-29

### Added
- **Direct `.scad` Editing:** Added an interactive code editor to the web viewer.
- **URL State Serialization:** Modifications made to the `.scad` file in the browser are now delta-compressed and serialized directly into the URL, allowing for backend-free sharing of custom geometric states.
- **Patch Application:** The web viewer now successfully applies URL-encoded diffs to the authoritative GitHub AST on load.

## [0.1.0] - 2026-03-15

### Added
- Initial release of the Scadder CLI and WASM-powered Web Viewer.
- Hybrid Dependency Management architecture (local components via `.scadder_modules` and global peer dependencies).
- Initial GitHub CDN crawling and AST parsing for `include`/`use` statements.