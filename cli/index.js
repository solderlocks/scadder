#!/usr/bin/env node

/**
 * Scadder CLI - OpenSCAD Package Manager
 */

import fs from 'fs/promises';
import path from 'path';
import { resolveDependencies } from '../core/crawler.js';

// Point to the live GitHub repo so it works for external users
const REGISTRY_URL = 'https://raw.githubusercontent.com/solderlocks/scadder/main/core/library.json';

// CRITICAL: Use process.cwd() to resolve relative to where the user typed the command!
const SCADDER_JSON = path.join(process.cwd(), 'scadder.json');
const MODULES_DIR = path.join(process.cwd(), '.scadder_modules');

async function init() {
    try {
        await fs.access(SCADDER_JSON);
        console.log(`> ${SCADDER_JSON} already exists.`);
    } catch {
        const initialConfig = {
            dependencies: {}
        };
        await fs.writeFile(SCADDER_JSON, JSON.stringify(initialConfig, null, 2));
        console.log(`> Created ${SCADDER_JSON}`);
    }
}

async function install(target) {
    // CASE 1: BARE INSTALL (Install everything from scadder.json)
    if (!target) {
        let config;
        try {
            const data = await fs.readFile(SCADDER_JSON, 'utf8');
            config = JSON.parse(data);
        } catch (e) {
            console.error(`Error: Could not read scadder.json. Specify a target or run "scadder init" first.`);
            process.exit(1);
        }

        const deps = Object.entries(config.dependencies || {});
        if (deps.length === 0) {
            console.log('> No dependencies to install in scadder.json.');
            return;
        }

        console.log(`> Installing ${deps.length} dependencies from scadder.json...`);
        for (const [id, url] of deps) {
            try {
                await fetchAndSave(id, url);
            } catch (e) {
                console.error(`  Failed to install ${id}: ${e.message}`);
            }
        }
        console.log('> Bulk install complete.');
        return;
    }

    // CASE 2: SINGLE TARGET INSTALL
    let url = target;
    let id = target;

    if (!target.startsWith('http')) {
        console.log(`> resolving ${target} from registry...`);
        try {
            const res = await fetch(REGISTRY_URL);
            if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);
            const library = await res.json();
            const item = library.find(i => i.id === target);
            if (!item) {
                console.error(`Error: Package "${target}" not found in registry.`);
                process.exit(1);
            }
            url = item.url;
            console.log(`> found ${target} at ${url}`);
        } catch (e) {
            console.error(`Error: Failed to fetch registry: ${e.message}`);
            process.exit(1);
        }
    } else {
        id = target.split('/').pop().replace('.scad', '') || 'unnamed-dependency';
    }

    try {
        await fetchAndSave(id, url);
        await updateConfig(id, url);
    } catch (e) {
        console.error(`Error: Installation failed: ${e.message}`);
        process.exit(1);
    }
}

// HELPER: Core fetching and writing logic to prevent duplication
async function fetchAndSave(id, url) {
    url = toRawUrl(url);
    console.log(`> fetching dependencies for ${id}...`);

    const files = await resolveDependencies(url, {
        onLog: (msg) => console.log(`  ${msg}`),
        onError: (err) => console.error(`  ${err}`)
    });

    if (files.length === 0) {
        throw new Error(`No files found for ${id}`);
    }

    const targetDir = path.join(MODULES_DIR, id);
    await fs.mkdir(targetDir, { recursive: true });

    for (const file of files) {
        const filePath = path.join(targetDir, file.name);
        const fileDir = path.dirname(filePath);
        await fs.mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.txt);
    }

    console.log(`> installed ${files.length} files to ${targetDir}/`);
}

async function updateConfig(id, url) {
    let config = { dependencies: {} };
    try {
        const data = await fs.readFile(SCADDER_JSON, 'utf8');
        config = JSON.parse(data);
    } catch (e) {
        // scadder.json might not exist yet, that's fine
    }

    config.dependencies[id] = url;
    await fs.writeFile(SCADDER_JSON, JSON.stringify(config, null, 2));
    console.log(`> updated ${SCADDER_JSON}`);
}

function toRawUrl(url) {
    url = url.trim();
    if (url.includes('raw.githubusercontent.com')) return url;
    const m = url.match(/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}`;
    return url;
}

// CLI Router
const [, , command, ...args] = process.argv;

(async () => {
    switch (command) {
        case 'init':
            await init();
            break;
        case 'install':
            await install(args[0]);
            break;
        case 'help':
        case '--help':
        case undefined:
            console.log(`
Scadder CLI - OpenSCAD Package Manager

Commands:
  init             Initialize a new scadder.json project
  install [target] Install a package, or all packages in scadder.json
            `);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            console.log('Use "scadder help" for available commands.');
            process.exit(1);
    }
})();
