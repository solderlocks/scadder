#!/usr/bin/env node

/**
 * Scadder CLI - OpenSCAD Package Manager
 */

import fs from 'fs/promises';
import path from 'path';
import { resolveDependencies } from '../core/crawler.js';

// Point to the live GitHub repo so it works for external users
const REGISTRY_URL = 'https://raw.githubusercontent.com/solderlocks/scadder/main/core/library.json';
//const REGISTRY_URL = 'https://jscottk.net/scadder/core/library.json';

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
    if (!target) {
        console.error('Error: Please specify a target to install (e.g., scadder install gridfinity-cup)');
        process.exit(1);
    }

    let url = target;
    let id = target;

    // 1. Resolve ID from registry if not a URL
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
        // If it's a URL, use a hash or slug for the ID
        id = target.split('/').pop().replace('.scad', '') || 'unnamed-dependency';
    }

    // 2. Normalize GitHub URLs
    url = toRawUrl(url);

    // 3. Fetch dependencies
    console.log(`> fetching dependencies for ${id}...`);
    try {
        const files = await resolveDependencies(url, {
            onLog: (msg) => console.log(`  ${msg}`),
            onError: (err) => console.error(`  ${err}`)
        });

        if (files.length === 0) {
            console.error(`Error: No files found for ${id}`);
            process.exit(1);
        }

        // 4. Write files to local storage
        const targetDir = path.join(MODULES_DIR, id);
        await fs.mkdir(targetDir, { recursive: true });

        for (const file of files) {
            const filePath = path.join(targetDir, file.name);
            const fileDir = path.dirname(filePath);
            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(filePath, file.txt);
        }

        console.log(`> installed ${files.length} files to ${targetDir}/`);

        // 5. Update scadder.json
        await updateConfig(id, url);

    } catch (e) {
        console.error(`Error: Installation failed: ${e.message}`);
        process.exit(1);
    }
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
  install <target> Install a package by ID or URL
            `);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            console.log('Use "scadder help" for available commands.');
            process.exit(1);
    }
})();
