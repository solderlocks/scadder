import OpenScad from "./openscad.js";

self.onmessage = async (e) => {
  const { command, vfs } = e.data;

  if (command === 'render') {
    try {
      self.postMessage({ type: 'log', text: '1. Initializing Engine...' });

      const instance = await OpenScad({
        noInitialRun: true,
        arguments: ["--enable=all"], 
        print:    text => self.postMessage({ type: 'log', text }),
        printErr: text => self.postMessage({ type: 'log', text }),
      });

      // ---------------------------------------------------------
      // 2. LOAD REAL FONTS
      // We fetch the standard Liberation Sans font so text() works.
      // ---------------------------------------------------------
      try {
        const fontPath = '/fonts/LiberationSans-Regular.ttf';
        
        // Only fetch if not already in memory
        if (!instance.FS.analyzePath(fontPath).exists) {
            self.postMessage({ type: 'log', text: '   🔤 Loading fonts...' });
            
            // Create directory
            if (!instance.FS.analyzePath('/fonts').exists) instance.FS.mkdir('/fonts');

            // FETCH THE FONT
            // We try to fetch from your local 'fonts' folder first.
            // If that fails, you might need to adjust this URL.
            // (Assuming you have a 'fonts' folder next to index.html)
            let response = await fetch('fonts/LiberationSans-Regular.ttf');
            
            // FALLBACK: If local fetch fails, try a CDN (High reliability)
            if (!response.ok) {
                self.postMessage({ type: 'log', text: '   ⚠️ Local font missing, trying CDN...' });
                response = await fetch('https://raw.githubusercontent.com/openscad/openscad/master/fonts/Liberation-2.00.1/ttf/LiberationSans-Regular.ttf');
            }

            if (response.ok) {
                const fontData = await response.arrayBuffer();
                instance.FS.writeFile(fontPath, new Uint8Array(fontData));
                
                // Write the config file so OpenSCAD knows where to look
                const fontConf = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/fonts/cache</cachedir></fontconfig>`;
                instance.FS.writeFile('/fonts/fonts.conf', fontConf);
                
                self.postMessage({ type: 'log', text: '   ✅ Font loaded.' });
                self.postMessage({ type: 'log', text: `3. Writing files (with Echo Patch)...` });

                // 🔍 DEBUG: Log the inventory
                const fileList = vfs.map(f => f.name).join(', ');
                self.postMessage({ type: 'log', text: `   📂 VFS Payload (${vfs.length} files): ${fileList}` });

                const mkdir_p = (path) => {
                  const parts = path.split('/').filter(p => p.length > 0);
                  let current = "";
                  for (const part of parts) {
                      current += "/" + part;
                      const analysis = instance.FS.analyzePath(current);
                      if (!analysis.exists) {
                          try { 
                              instance.FS.mkdir(current); 
                              // Log directory creation to confirm structure
                              // self.postMessage({ type: 'log', text: `   📁 Created dir: ${current}` });
                          } catch(e) { if (e.code !== 'EEXIST') throw e; }
                      }
                  }
                };

                for (const f of vfs) {
                  const fullPath = f.name.startsWith('/') ? f.name : '/' + f.name;
                  let content = f.txt;
        
        

                  const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
                  if (dir) mkdir_p(dir);

                  try {
                      instance.FS.writeFile(fullPath, content);
                  } catch (err) {
                      throw new Error(`Failed to write ${fullPath}: ${err.message}`);
                  }
                }
            } else {
                throw new Error("Could not fetch LiberationSans-Regular.ttf");
            }
        }
      } catch(e) {
        self.postMessage({ type: 'log', text: '⚠️ Font load warning: ' + e.message });
        // We don't throw here, so the render can still proceed (just without text)
      }
      // ---------------------------------------------------------

      self.postMessage({ type: 'log', text: `3. Writing files (with Echo Patch)...` });

      const mkdir_p = (path) => {
        const parts = path.split('/').filter(p => p.length > 0);
        let current = "";
        for (const part of parts) {
            current += "/" + part;
            const analysis = instance.FS.analyzePath(current);
            if (!analysis.exists) {
                try { instance.FS.mkdir(current); } catch(e) { if (e.code !== 'EEXIST') throw e; }
            }
        }
      };

      for (const f of vfs) {
        const fullPath = f.name.startsWith('/') ? f.name : '/' + f.name;
        let content = f.txt;
        
        // The Echo Patch (Keeps Gridfinity alive)
        if (content.includes('version()') && content.includes('assert')) {
             content = content.replace(
                /assert\s*\(\s*(?=.*version\()/g, 
                'echo("PATCHED_ASSERT", '
             );
             self.postMessage({ type: 'log', text: `   🩹 Converted assert to echo in: ${fullPath}` });
        }

        // 🩹 PATCH 2: Convert 'assign()' to standard variable blocks
        // This is a naive regex but handles the common "assign(var=val)" case
        if (content.includes('assign')) {
             // Replaces 'assign(a=b)' with 'let(a=b)' which is often compatible
             // OR simply remove it if it's used as a wrapper.
             // For safety, let's try mapping it to 'let' first, as that's the modern equivalent scope-wrapper.
             content = content.replace(/assign\s*\(/g, 'let(');
             self.postMessage({ type: 'log', text: `   🩹 Patched legacy 'assign' in: ${fullPath}` });
        }

        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        if (dir) mkdir_p(dir);

        try {
            instance.FS.writeFile(fullPath, content);
        } catch (err) {
            throw new Error(`Failed to write ${fullPath}`);
        }
      }

      self.postMessage({ type: 'log', text: `4. Starting Main Render...` });

      instance.callMain(["/main.scad", "-o", "out.stl"]);
      
      if (instance.FS.analyzePath("/out.stl").exists) {
          const output = instance.FS.readFile("/out.stl");
          self.postMessage({ type: 'done', stl: output }, [output.buffer]);
      } else {
          throw new Error("Render produced no geometry (Empty Scene).");
      }

    } catch (error) {
      const errText = (typeof error === 'number') 
        ? `WASM Crash (Code ${error}).` 
        : error.toString();
      self.postMessage({ type: 'error', error: errText });
    }
  }
};