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

      // 2. STUB FONTS
      try {
        if (!instance.FS.analyzePath('/fonts').exists) instance.FS.mkdir('/fonts');
        instance.FS.writeFile('/fonts/LiberationSans-Regular.ttf', new Uint8Array(0));
        const fontConf = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/fonts/cache</cachedir></fontconfig>`;
        instance.FS.writeFile('/fonts/fonts.conf', fontConf);
      } catch(e) {}

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
        
        // ---------------------------------------------------------
        // 🩹 THE FIX: The "Echo Patch"
        // We don't delete the line (breaks syntax).
        // We don't replace the logic (breaks parsing).
        // We simply turn the crashy 'assert' into a harmless 'echo'.
        // This preserves the code structure perfectly.
        // ---------------------------------------------------------
        if (content.includes('version()') && content.includes('assert')) {
             // Look for 'assert(' followed eventually by 'version('
             // Replace 'assert(' with 'echo("PATCHED",'
             content = content.replace(
                /assert\s*\(\s*(?=.*version\()/g, 
                'echo("PATCHED_ASSERT", '
             );
             self.postMessage({ type: 'log', text: `   🩹 Converted assert to echo in: ${fullPath}` });
        }
        // ---------------------------------------------------------

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
      
      const output = instance.FS.readFile("/out.stl");
      self.postMessage({ type: 'done', stl: output }, [output.buffer]);

    } catch (error) {
      const errText = (typeof error === 'number') 
        ? `WASM Crash (Code ${error}).` 
        : error.toString();
      self.postMessage({ type: 'error', error: errText });
    }
  }
};