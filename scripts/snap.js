const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// CONFIG
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/openscad/index.html'; 
const LIBRARY_PATH = path.join(__dirname, '../openscad/library.json');
const OUTPUT_DIR = path.join(__dirname, '../openscad/assets/previews');

(async () => {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)){
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
  let hasChanges = false; // Track if we actually need to save the JSON

  // Launch browser with aggressive software rendering flags
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-unsafe-swiftshader',  // The key to software WebGL
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--hide-scrollbars'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 300 });

  // Console logging for debugging
  page.on('console', msg => {
      // Filter out some noise, keep important logs
      const text = msg.text();
      if (!text.includes('marker') && !text.includes('fallback')) {
        console.log('PAGE LOG:', text);
      }
  });

  for (const item of library) {
    const filename = `${item.id}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const relativePath = `assets/previews/${filename}`;

    // 1. INCREMENTAL CHECK: If image exists, skip render!
    if (fs.existsSync(filepath)) {
        console.log(`⏩ Skipping ${item.title} (Image exists)`);
        
        // Ensure JSON has the link, just in case it was missing
        if (item.image !== relativePath) {
            item.image = relativePath;
            hasChanges = true;
        }
        continue; 
    }

    // If we are here, the image is missing. Let's render it.
    console.log(`📸 Generating new thumbnail: ${item.title}...`);
    const url = `${BASE_URL}?file=${encodeURIComponent(item.url)}`;
    
    try {
        await page.goto(url, { waitUntil: 'networkidle0' });

        // Wait for the 3D canvas
        await page.waitForSelector('#canvas-container canvas', { timeout: 20000 });
        
        // Wait for the loading spinner to disappear
        await page.waitForSelector('#renderOverlay.hidden', { timeout: 60000 });
        
        // Give it a second to settle
        await new Promise(r => setTimeout(r, 1000));

        // 2. DOM SURGERY: Hide the UI before snapping
        await page.evaluate(() => {
            const header = document.querySelector('header');
            if(header) header.style.display = 'none';

            const toolbar = document.querySelector('.viewport-toolbar');
            if(toolbar) toolbar.style.display = 'none';
            
            // Optional: Hide scrollbars explicitly
            document.body.style.overflow = 'hidden';
        });

        // Take the screenshot of just the canvas area
        // (Since we hid the UI, we can just snap the viewport card)
        const element = await page.$('.viewport-card'); 
        if (element) {
            await element.screenshot({ path: filepath });
        } else {
            // Fallback if card not found
            await page.screenshot({ path: filepath });
        }
        
        // Update JSON
        item.image = relativePath;
        hasChanges = true;
        
    } catch (e) {
        console.error(`❌ Failed to capture ${item.title}: ${e.message}`);
    }
  }

  await browser.close();

  // Only write to disk if something changed (preserves file modification times)
  if (hasChanges) {
      fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
      console.log("✨ Library index updated.");
  } else {
      console.log("✨ No changes to library index needed.");
  }
  
})();