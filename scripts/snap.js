const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Keep this flexible! 
// Locally, it uses your MAMP defaults (8888). 
// On GitHub, it uses the ENV variable we set above (8080).
const BASE_URL = process.env.BASE_URL || 'http://localhost:8888/scadder/openscad/index.html';
const LIBRARY_PATH = path.join(__dirname, '../openscad/library.json'); // Robust pathing
const OUTPUT_DIR = path.join(__dirname, '../assets/previews');

(async () => {
  const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));

  // CRITICAL FIX FOR GITHUB ACTIONS (Linux)
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // ... rest of script ...

  // Set viewport to standard thumbnail size
  await page.setViewport({ width: 400, height: 300 });

  for (const item of library) {
    console.log(`📸 Snapping: ${item.title}...`);
    
    // Construct the viewer URL
    const url = `${BASE_URL}?file=${encodeURIComponent(item.url)}`;
    await page.goto(url);

    // WAIT for the canvas to exist and the spinner to disappear
    try {
        await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });
        await page.waitForSelector('#renderOverlay.hidden', { timeout: 30000 }); // Wait for render to finish
        
        // Optional: Wait an extra second for the frame to settle
        await new Promise(r => setTimeout(r, 1000));

        // Take the screenshot
        const filename = `${item.id}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        // We capture just the viewport card, or the whole page? 
        // Let's grab the #canvas-container element specifically
        const element = await page.$('#canvas-container');
        await element.screenshot({ path: filepath });
        
        // Update the JSON with the new image path
        item.image = `assets/previews/${filename}`;
        
    } catch (e) {
        console.error(`❌ Failed to capture ${item.title}:`, e.message);
    }
  }

  await browser.close();

  // Save the updated JSON back to file
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
  console.log("✨ All done! library.json updated.");
})();