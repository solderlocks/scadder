#!/usr/bin/env node

/**
 * Scadder CLI - OpenSCAD Package Manager
 */

import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { resolveDependencies } from '../core/crawler.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRAMEWORKS_JSON = path.join(__dirname, '../core/frameworks.json');

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
    let frameworksData = {};
    try {
        frameworksData = JSON.parse(await fs.readFile(FRAMEWORKS_JSON, 'utf8'));
    } catch (e) {}

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
        for (const [id, val] of deps) {
            try {
                if (frameworksData[id]) {
                    const commitHash = typeof val === 'string' ? null : val.commit_hash;
                    await installFramework(id, commitHash, frameworksData);
                    continue;
                }

                let sourceUrl = typeof val === 'string' ? val : val.source;
                let commitHash = typeof val === 'string' ? null : val.commit_hash;

                let fetchUrl = sourceUrl;
                if (commitHash && !noLock) {
                    fetchUrl = applyHashToUrl(fetchUrl, commitHash);
                }

                await fetchAndSave(id, fetchUrl, frameworksData);
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
    let requiredFrameworks = {};

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
            
            if (item.requires) {
                for (const fwId of item.requires) {
                    requiredFrameworks[fwId] = null;
                }
            }
        } catch (e) {
            console.error(`Error: Failed to fetch registry: ${e.message}`);
            process.exit(1);
        }
    } else {
        id = target.split('/').pop().replace('.scad', '') || 'unnamed-dependency';
    }

    let sourceUrl = url;
    let fetchUrl = toRawUrl(url);
    let commitHash = null;

    if (!noLock) {
        const lockInfo = await resolveLatestCommitUrl(fetchUrl);
        if (lockInfo.sha) {
            commitHash = lockInfo.sha;
            fetchUrl = lockInfo.lockedUrl;
            console.log(`> locked to commit ${commitHash.substring(0, 7)}`);
        }
    }

    try {
        const foundFrameworks = await fetchAndSave(id, fetchUrl, frameworksData);
        Object.assign(requiredFrameworks, foundFrameworks || {});
        
        for (const [fwId, tag] of Object.entries(requiredFrameworks)) {
            const fwConfig = await installFramework(fwId, tag, frameworksData);
            if (fwConfig) {
                await updateConfig(fwId, fwConfig.source, fwConfig.commitHash);
            }
        }

        await updateConfig(id, sourceUrl, commitHash);
    } catch (e) {
        console.error(`Error: Installation failed: ${e.message}`);
        process.exit(1);
    }
}

// HELPER: Core fetching and writing logic to prevent duplication
async function fetchAndSave(id, url, frameworks = {}) {
    url = toRawUrl(url);
    console.log(`> fetching dependencies for ${id}...`);

    const files = await resolveDependencies(url, {
        onLog: (msg) => console.log(`  ${msg}`),
        onError: (err) => console.error(`  ${err}`),
        frameworks: frameworks
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
    return files.frameworks;
}

async function installFramework(fwId, tag, frameworksData) {
    if (!frameworksData[fwId]) {
        console.error(`Error: Unknown framework ${fwId}`);
        return null;
    }
    const repo = frameworksData[fwId].repo;
    console.log(`\n> Resolving framework [${fwId}] from ${repo}...`);
    
    let zipUrl = `https://api.github.com/repos/${repo}/zipball`;
    let commitHash = null;
    
    if (tag && tag !== "latest") {
         zipUrl = `https://api.github.com/repos/${repo}/zipball/${tag}`;
         commitHash = tag;
    } else {
         try {
             const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': 'Scadder-CLI' } });
             if (releaseRes.ok) {
                 const relData = await releaseRes.json();
                 zipUrl = relData.zipball_url;
                 commitHash = relData.tag_name;
             } else {
                 zipUrl = `https://api.github.com/repos/${repo}/zipball`;
             }
         } catch (e) {
             console.warn(`  Failed checking releases API: ${e.message}`);
         }
    }
    
    console.log(`> downloading monolithic zip payload: ${zipUrl}`);
    
    try {
        const res = await fetch(zipUrl, { headers: { 'User-Agent': 'Scadder-CLI' }, redirect: 'follow' });
        if (!res.ok) throw new Error(`Failed to map zip URL: ${res.status}`);
        
        const buffer = Buffer.from(await res.arrayBuffer());
        const zip = new AdmZip(buffer);
        const targetDir = path.join(MODULES_DIR, fwId);
        
        const zipEntries = zip.getEntries();
        await fs.mkdir(targetDir, { recursive: true });
        
        let rootPrefix = null;
        for (const entry of zipEntries) {
            if (!rootPrefix) {
                rootPrefix = entry.entryName.split('/')[0] + '/';
                break;
            }
        }
        
        for (const entry of zipEntries) {
            if (entry.entryName.startsWith(rootPrefix)) {
                const newPath = entry.entryName.substring(rootPrefix.length);
                if (!newPath) continue;
                
                const destPath = path.join(targetDir, newPath);
                if (entry.isDirectory) {
                    await fs.mkdir(destPath, { recursive: true });
                } else {
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.writeFile(destPath, entry.getData());
                }
            }
        }
        
        console.log(`> extracted framework ${fwId} to ${targetDir}/`);
        return { source: zipUrl, commitHash: commitHash };
    } catch (e) {
        console.error(`  Error downloading framework ${fwId}: ${e.message}`);
        return null;
    }
}

async function updateConfig(id, sourceUrl, commitHash) {
    let config = { dependencies: {} };
    try {
        const data = await fs.readFile(SCADDER_JSON, 'utf8');
        config = JSON.parse(data);
    } catch (e) {
        // scadder.json might not exist yet, that's fine
    }

    if (commitHash) {
        config.dependencies[id] = {
            source: sourceUrl,
            commit_hash: commitHash
        };
    } else {
        config.dependencies[id] = {
            source: sourceUrl
        };
    }
    await fs.writeFile(SCADDER_JSON, JSON.stringify(config, null, 2));
    console.log(`> updated ${SCADDER_JSON}`);
}

async function updateCmd(target) {
    if (!target) {
        console.error(`Error: Specify a dependency to update, or use "all".`);
        process.exit(1);
    }

    let config;
    try {
        const data = await fs.readFile(SCADDER_JSON, 'utf8');
        config = JSON.parse(data);
    } catch (e) {
        console.error(`Error: Could not read scadder.json.`);
        process.exit(1);
    }

    if (!config.dependencies || Object.keys(config.dependencies).length === 0) {
        console.log(`> No dependencies found in scadder.json.`);
        return;
    }

    if (target === 'all') {
        const deps = Object.keys(config.dependencies);
        console.log(`> Updating all ${deps.length} dependencies...`);
        for (const dep of deps) {
            await processSingleUpdate(dep, config.dependencies[dep]);
        }
        console.log(`> Bulk update complete.`);
    } else {
        if (!config.dependencies[target]) {
            console.error(`Error: Dependency "${target}" not found in scadder.json.`);
            process.exit(1);
        }
        await processSingleUpdate(target, config.dependencies[target]);
    }
}

async function processSingleUpdate(target, val) {
    let frameworksData = {};
    try {
        frameworksData = JSON.parse(await fs.readFile(FRAMEWORKS_JSON, 'utf8'));
    } catch (e) {}

    if (frameworksData[target]) {
         console.log(`\n> Updating monolithic framework ${target}...`);
         const fwConfig = await installFramework(target, "latest", frameworksData);
         if (fwConfig) {
             await updateConfig(target, fwConfig.source, fwConfig.commitHash);
         }
         return;
    }

    let sourceUrl = typeof val === 'string' ? val : val.source;

    console.log(`\n> Updating ${target}...`);
    let fetchUrl = toRawUrl(sourceUrl);
    let commitHash = null;

    if (!noLock) {
        console.log(`> fetching latest HEAD for ${sourceUrl}...`);
        const lockInfo = await resolveLatestCommitUrl(fetchUrl);
        if (lockInfo.sha) {
            commitHash = lockInfo.sha;
            fetchUrl = lockInfo.lockedUrl;
            console.log(`> locked to new commit ${commitHash.substring(0, 7)}`);
        }
    }

    try {
        await fetchAndSave(target, fetchUrl);
        await updateConfig(target, sourceUrl, commitHash);
    } catch (e) {
        // Log the error but don't exit the process, allowing bulk updates to continue
        console.error(`Error: Update failed for ${target}: ${e.message}`);
    }
}

function toRawUrl(url) {
    url = url.trim();
    if (url.includes('raw.githubusercontent.com')) return url;
    const m = url.match(/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}`;
    return url;
}

function applyHashToUrl(url, hash) {
    let cleanUrl = url.trim();
    let match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)/);
    if (!match) match = cleanUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)/);
    if (match) {
        return cleanUrl.replace(`/${match[3]}/`, `/${hash}/`);
    }
    return cleanUrl;
}

async function resolveLatestCommitUrl(cleanUrl) {
    let match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)/);
    if (!match) {
        match = cleanUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)/);
    }

    if (!match) return { lockedUrl: cleanUrl, sha: null };

    const owner = match[1];
    const repo = match[2];
    const branch = match[3];

    if (/^[0-9a-f]{40}$/i.test(branch)) {
        return { lockedUrl: cleanUrl, sha: branch };
    }

    try {
        const fetchUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
        const res = await fetch(fetchUrl, {
            headers: { 'User-Agent': 'Scadder-CLI' }
        });
        if (!res.ok) {
            throw new Error(`API returned ${res.status}`);
        }
        const data = await res.json();
        const sha = data.sha;
        const lockedUrl = cleanUrl.replace(`/${branch}/`, `/${sha}/`);
        return { lockedUrl, sha };
    } catch (e) {
        console.warn(`> Warning: Failed to resolve commit hash (${e.message}). Falling back to floating branch.`);
        return { lockedUrl: cleanUrl, sha: null };
    }
}

// CLI Router
const rawArgs = process.argv.slice(2);
const command = rawArgs[0];
const noLock = rawArgs.includes('--no-lock');
const args = rawArgs.slice(1).filter(a => !a.startsWith('--'));

(async () => {
    switch (command) {
        case 'init':
            await init();
            break;
        case 'install':
            await install(args[0]);
            break;
        case 'update':
            await updateCmd(args[0]);
            break;
        case 'help':
        case '--help':
        case undefined:
            console.log(`
Scadder CLI - OpenSCAD Package Manager

Commands:
  init             Initialize a new scadder.json project
  install [target] Install a package, or all packages in scadder.json
  update [target]  Fetch the latest commit hash for a dependency (or "all") and reinstall
            `);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            console.log('Use "scadder help" for available commands.');
            process.exit(1);
    }
})();
