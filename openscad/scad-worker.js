import OpenScad from "./openscad.js";

self.onmessage = async (e) => {
  const { command, vfs } = e.data;

  if (command === 'render') {
    try {
      self.postMessage({ type: 'log', text: '1. Initializing Engine...' });

      const instance = await OpenScad({
        noInitialRun: true,
        arguments: ["--enable=all"],
        print: text => self.postMessage({ type: 'log', text }),
        printErr: text => self.postMessage({ type: 'log', text }),
      });

      // ── Helper: recursively create directories ──
      const mkdir_p = (path) => {
        const parts = path.split('/').filter(p => p.length > 0);
        let current = "";
        for (const part of parts) {
          current += "/" + part;
          const analysis = instance.FS.analyzePath(current);
          if (!analysis.exists) {
            try { instance.FS.mkdir(current); } catch (e) { if (e.code !== 'EEXIST') throw e; }
          }
        }
      };

      // ── Load fonts ──
      try {
        const fontPath = '/fonts/LiberationSans-Regular.ttf';

        if (!instance.FS.analyzePath(fontPath).exists) {
          self.postMessage({ type: 'log', text: '   🔤 Loading fonts...' });

          if (!instance.FS.analyzePath('/fonts').exists) instance.FS.mkdir('/fonts');

          let response = await fetch('fonts/LiberationSans-Regular.ttf');

          if (!response.ok) {
            self.postMessage({ type: 'log', text: '   ⚠️ Local font missing, trying CDN...' });
            response = await fetch('https://raw.githubusercontent.com/openscad/openscad/master/fonts/Liberation-2.00.1/ttf/LiberationSans-Regular.ttf');
          }

          if (response.ok) {
            const fontData = await response.arrayBuffer();
            instance.FS.writeFile(fontPath, new Uint8Array(fontData));

            const fontConf = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/fonts/cache</cachedir></fontconfig>`;
            instance.FS.writeFile('/fonts/fonts.conf', fontConf);

            self.postMessage({ type: 'log', text: '   ✅ Font loaded.' });
          } else {
            throw new Error("Could not fetch LiberationSans-Regular.ttf");
          }
        }
      } catch (e) {
        self.postMessage({ type: 'log', text: '⚠️ Font load warning: ' + e.message });
      }

      // ── Write VFS files ──
      self.postMessage({ type: 'log', text: `2. Writing files (${vfs.length} total)...` });

      const fileList = vfs.map(f => f.name).join(', ');
      self.postMessage({ type: 'log', text: `   📂 VFS Payload: ${fileList}` });

      for (const f of vfs) {
        const fullPath = f.name.startsWith('/') ? f.name : '/' + f.name;
        let content = f.txt;

        // 🩹 PATCH 1: Convert assert() to echo() for Gridfinity compatibility
        if (content.includes('version()') && content.includes('assert')) {
          content = content.replace(
            /assert\s*\(\s*(?=.*version\()/g,
            'echo("PATCHED_ASSERT", '
          );
          self.postMessage({ type: 'log', text: `   🩹 Converted assert to echo in: ${fullPath}` });
        }

        // 🩹 PATCH 2: Convert legacy 'assign()' to 'let()'
        if (content.includes('assign')) {
          content = content.replace(/assign\s*\(/g, 'let(');
          self.postMessage({ type: 'log', text: `   🩹 Patched legacy 'assign' in: ${fullPath}` });
        }

        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        if (dir) mkdir_p(dir);

        try {
          instance.FS.writeFile(fullPath, content);
        } catch (err) {
          throw new Error(`Failed to write ${fullPath}: ${err.message}`);
        }
      }

      // ── Render ──
      self.postMessage({ type: 'log', text: `3. Starting Main Render...` });

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