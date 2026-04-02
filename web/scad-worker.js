import OpenScad from "./openscad.js";

let frameworksData = {};

self.onmessage = async (e) => {
  const { command, vfs, frameworks } = e.data;

  if (command === 'setFrameworks') {
    frameworksData = frameworks;
    return;
  }

  if (command === 'render') {
    try {
      self.postMessage({ type: 'log', text: '0. Resolving Frameworks (Piecemeal)...' });

      // --- PIECEMEAL FRAMEWORK RESOLUTION ---
      const crawledRegistry = new Set(vfs.map(f => f.name));
      const inFlightFetches = new Map(); // New: In-Flight Registry for concurrent requests
      
      async function crawlFrameworkDependencies(code, currentFwId = null, currentFileDir = '') {
        // Yield to prevent stack overflow on deep recursion
        await Promise.resolve();

        const importsRegex = /^\s*(?:include|use)\s*[<"](.*?)[>"]/gm;
        let match;
        const promises = [];

        while ((match = importsRegex.exec(code)) !== null) {
          const fullImportPath = match[1];
          let fwId = currentFwId;
          let relativeFile = fullImportPath;

          // 1. Resolve framework context
          if (!currentFwId) {
            const segments = fullImportPath.split('/');
            const possibleFwId = segments[0];
            if (frameworksData[possibleFwId]) {
              fwId = possibleFwId;
              relativeFile = segments.slice(1).join('/');
            } else {
              continue; // Not a managed framework
            }
          } else {
            // Internal framework import
            if (relativeFile.startsWith('/')) relativeFile = relativeFile.substring(1);
            let parts = currentFileDir ? currentFileDir.split('/') : [];
            const newParts = relativeFile.split('/');
            for (const p of newParts) {
              if (p === '..') parts.pop();
              else if (p !== '.' && p !== '') parts.push(p);
            }
            relativeFile = parts.join('/');
          }

          if (!fwId || !frameworksData[fwId]) continue;

          const vfsPath = `${fwId}/${relativeFile}`;
          
          // 2. VFS-First Resolution
          if (crawledRegistry.has(vfsPath)) continue;

          // 3. In-Flight Protection (Deduplication)
          if (inFlightFetches.has(vfsPath)) {
            promises.push(inFlightFetches.get(vfsPath));
            continue;
          }

          const newFileDir = relativeFile.includes('/') ? relativeFile.substring(0, relativeFile.lastIndexOf('/')) : '';

          const fetchPromise = (async () => {
            const repo = frameworksData[fwId].repo;
            const rawUrl = `https://raw.githubusercontent.com/${repo}/master/${relativeFile}`;

            try {
              self.postMessage({ type: 'log', text: `   [Piecemeal] Fetching ${fwId}/${relativeFile}...` });
              const res = await fetch(rawUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const text = await res.text();
              vfs.push({ name: vfsPath, txt: text });
              crawledRegistry.add(vfsPath);

              if (relativeFile.toLowerCase().endsWith('.scad')) {
                await crawlFrameworkDependencies(text, fwId, newFileDir);
              }
            } catch (e) {
              self.postMessage({ type: 'log', text: `   ⚠️ [Piecemeal] Fetch failed for ${fwId}/${relativeFile}: ${e.message}` });
            } finally {
              inFlightFetches.delete(vfsPath);
            }
          })();

          inFlightFetches.set(vfsPath, fetchPromise);
          promises.push(fetchPromise);
        }
        await Promise.all(promises);
      }

      const mainFile = vfs.find(f => f.name === 'main.scad');
      if (mainFile) {
        await crawlFrameworkDependencies(mainFile.txt);
      }

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