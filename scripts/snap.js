const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// CONFIG
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/openscad/index.html';
const LIBRARY_PATH = path.join(__dirname, '../openscad/library.json');
const OUTPUT_DIR = path.join(__dirname, '../openscad/assets/previews');

(async () => {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
    let hasChanges = false;

    // 1. Collect all valid IDs from the JSON
    const validIds = new Set(library.map(item => item.id));

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--enable-unsafe-swiftshader',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--hide-scrollbars'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 300 });

    page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('marker') && !text.includes('fallback')) {
            console.log('PAGE LOG:', text);
        }
    });

    // 2. GENERATE MISSING IMAGES
    for (const item of library) {
        const filename = `${item.id}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);
        const relativePath = `assets/previews/${filename}`;

        if (fs.existsSync(filepath)) {
            console.log(`⏩ Skipping ${item.title} (Image exists)`);
            if (item.image !== relativePath) {
                item.image = relativePath;
                hasChanges = true;
            }
            continue;
        }

        console.log(`📸 Generating new thumbnail: ${item.title}...`);
        let url = `${BASE_URL}?file=${encodeURIComponent(item.url)}`;
        if (item.vars && Object.keys(item.vars).length > 0) {
            url += `&vars=${encodeURIComponent(JSON.stringify(item.vars))}`;
        }

        try {
            // Increase navigation timeout for slow initial fetches
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Give the Rugged Box 3 full minutes to crunch the geometry
            await page.waitForSelector('#renderOverlay.hidden', { timeout: 180000 });

            const hasError = await page.evaluate(() => {
                const status = document.getElementById('renderStatus').textContent;
                return status.toLowerCase().includes('error') || status.toLowerCase().includes('failed');
            });

            if (hasError) {
                console.error(`⚠️ Skipping screenshot for ${item.title} due to render error.`);
                continue;
            }

            // A slightly longer settle time for the renderer to swap buffers
            await new Promise(r => setTimeout(r, 3000));

            const rerenderBar = document.querySelector('.sticky-render-bar');
            if (rerenderBar) {
                rerenderBar.style.display = 'none';
                rerenderBar.className = 'sticky-render-bar'
            }

            await page.evaluate(() => {
                const header = document.querySelector('header');
                if (header) header.style.display = 'none';
                const toolbar = document.querySelector('.viewport-toolbar');
                if (toolbar) toolbar.style.display = 'none';
                document.body.style.overflow = 'hidden';
            });

            const element = await page.$('.viewport-card');
            if (element) await element.screenshot({ path: filepath });
            else await page.screenshot({ path: filepath });

            item.image = relativePath;
            hasChanges = true;

        } catch (e) {
            console.error(`❌ Failed to capture ${item.title}: ${e.message}`);
        }
    }

    await browser.close();

    // 3. CLEANUP ORPHANS (Garbage Collection)
    console.log("🧹 Checking for orphaned images...");
    const files = fs.readdirSync(OUTPUT_DIR);

    for (const file of files) {
        if (!file.endsWith('.png')) continue; // Skip non-images

        const id = file.replace('.png', '');

        // If this file's ID is NOT in our JSON list, delete it
        if (!validIds.has(id)) {
            console.log(`🗑️ Deleting orphan: ${file}`);
            fs.unlinkSync(path.join(OUTPUT_DIR, file));
            // No need to set hasChanges=true because this doesn't affect library.json
        }
    }

    if (hasChanges) {
        fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
        console.log("✨ Library index updated.");
    } else {
        console.log("✨ No changes to library index needed.");
    }

})();