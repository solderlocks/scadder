const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// CONFIG
// Default to the subfolder URL for local dev too
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/openscad/index.html'; 

const LIBRARY_PATH = path.join(__dirname, '../openscad/library.json');

// FIX: Save images inside the openscad folder so relative links work!
const OUTPUT_DIR = path.join(__dirname, '../openscad/assets/previews');

(async () => {
  // Ensure the new nested folder exists
  if (!fs.existsSync(OUTPUT_DIR)){
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));

 // FIX: Force software rendering (SwiftShader) so WebGL works without a GPU
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-gl=swiftshader',      // <--- THE KEY FIX: Use CPU for graphics
        '--enable-webgl',
        '--ignore-gpu-blocklist',    // Force Chrome to use the software GPU
        '--hide-scrollbars'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 300 });

  // 3. LISTEN TO CONSOLE LOGS (Crucial for debugging)
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', req => console.log('FAILED REQ:', req.url()));

  for (const item of library) {
    console.log(`📸 Snapping: ${item.title}...`);
    const url = `${BASE_URL}?file=${encodeURIComponent(item.url)}`;
    
    try {
        await page.goto(url, { waitUntil: 'networkidle0' }); // Wait for network to settle

        // Wait for canvas
        await page.waitForSelector('#canvas-container canvas', { timeout: 15000 });
        
        // Wait for the overlay to disappear (render complete)
        await page.waitForSelector('#renderOverlay.hidden', { timeout: 45000 });
        
        // Wait a beat for the frame to settle
        await new Promise(r => setTimeout(r, 1000));

        const filename = `${item.id}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        const element = await page.$('#canvas-container');
        await element.screenshot({ path: filepath });
        
        
       // Just update the item.image path to be relative to the JSON file
        if (!item.image) {
            item.image = `assets/previews/${filename}`;
        }
        
    } catch (e) {
        console.error(`❌ Failed to capture ${item.title}:`);
        console.error(e.message);
        // Continue to the next item instead of crashing the whole script
    }
  }

  await browser.close();

  // Save JSON
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
  console.log("✨ All done! library.json updated.");
})();