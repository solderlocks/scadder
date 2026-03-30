import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const FRAMEWORKS_FILE = path.join(ROOT_DIR, 'core', 'frameworks.json');
const OUT_DIR = path.join(ROOT_DIR, 'web', 'assets', 'libraries');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const options = { headers: { 'User-Agent': 'Scadder-Asset-Generator' } };

        https.get(url, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirects (GitHub uses 302 for zipballs)
                return resolve(downloadFile(response.headers.location, dest));
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(dest, () => {});
                return reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': 'Scadder-Asset-Generator' } };
        https.get(url, options, (response) => {
            let data = '';
            
            // Check for rate limits or not found
            if (response.statusCode === 404) return resolve(null);
            if (response.statusCode !== 200) {
                return reject(new Error(`API returned ${response.statusCode} for ${url}`));
            }

            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
    console.log(`> Loading frameworks from ${FRAMEWORKS_FILE}`);
    let frameworks;
    try {
        const data = fs.readFileSync(FRAMEWORKS_FILE, 'utf8');
        frameworks = JSON.parse(data);
    } catch (e) {
        console.error('Failed to read frameworks.json', e.message);
        process.exit(1);
    }

    const ids = Object.keys(frameworks);
    console.log(`> Found ${ids.length} frameworks to process.`);

    for (const id of ids) {
        const repo = frameworks[id].repo;
        const destPath = path.join(OUT_DIR, `${id}.zip`);
        console.log(`\n> Processing framework: [${id}] from ${repo}`);

        try {
            let zipUrl = null;
            
            // Attempt 1: Check GitHub Releases API
            console.log(`  - Fetching latest release info...`);
            const releaseInfo = await fetchJSON(`https://api.github.com/repos/${repo}/releases/latest`);
            
            if (releaseInfo && releaseInfo.zipball_url) {
                zipUrl = releaseInfo.zipball_url;
                console.log(`  - Found stable release: ${releaseInfo.tag_name}`);
            } else {
                // Attempt 2: Fallback to master/main Archive (zipball logic via GitHub API)
                console.log(`  - No stable releases found. Falling back to default branch archive.`);
                // Using the api endpoint routes robustly to the default branch zipball without assuming 'master' or 'main'
                zipUrl = `https://api.github.com/repos/${repo}/zipball`; 
            }

            console.log(`  - Downloading ZIP: ${zipUrl}`);
            await downloadFile(zipUrl, destPath);
            console.log(`  ✔ Successfully saved to web/assets/libraries/${id}.zip`);
            
            // Introduce a short artificial delay to prevent rate-limit throttling from GitHub API
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`  ❌ Failed to process [${id}]: ${e.message}`);
        }
    }
    console.log('\n> 🎉 Framework bundle generator complete.');
}

run();
