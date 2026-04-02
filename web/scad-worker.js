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

        // Pre-clean code for parsing: remove comments to avoid false-positives
        const cleanCode = code
          .replace(/\/\*[\s\S]*?\*\//g, '')  // Block comments
          .replace(/\/\/.*/g, '');           // Single-line comments

        const importsRegex = /^\s*(?:include|use)\s*[<"](.*?)[>"]/gm;
        let match;
        const promises = [];

        while ((match = importsRegex.exec(cleanCode)) !== null) {
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
            const branches = ['master', 'main'];
            let text = null;

            for (const branch of branches) {
              const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${relativeFile}`;
              try {
                const res = await fetch(rawUrl);
                if (res.ok) {
                  text = await res.text();
                  break;
                }
              } catch (e) {}
            }

            if (text !== null) {
              self.postMessage({ type: 'log', text: `   [Piecemeal] Fetched ${vfsPath}` });
              vfs.push({ name: vfsPath, txt: text });
              crawledRegistry.add(vfsPath);

              if (relativeFile.toLowerCase().endsWith('.scad')) {
                // Throttle for deep libraries to maintain stable event loop
                await new Promise(r => setTimeout(r, 20));
                await crawlFrameworkDependencies(text, fwId, newFileDir);
              }
            } else {
              self.postMessage({ type: 'log', text: `   ⚠️ [Piecemeal] Not found: ${vfsPath}` });
            }
            inFlightFetches.delete(vfsPath);
          })();

          inFlightFetches.set(vfsPath, fetchPromise);
          promises.push(fetchPromise);
        }
        await Promise.all(promises);
      }

      const mainFile = vfs.find(f => f.name === 'main.scad');
      if (mainFile) {
        self.postMessage({ type: 'log', text: '   🔍 Analyzing dependencies in main.scad...' });
        await crawlFrameworkDependencies(mainFile.txt);
      }

      // --- ENGINE INITIALIZATION HELPER ---
      async function createAndWriteEngine(vfsData) {
        const instance = await OpenScad({
          noInitialRun: true,
          arguments: ["--enable=all"],
          print: text => self.postMessage({ type: 'log', text }),
          printErr: text => self.postMessage({ type: 'log', text }),
        });

        // Setup FS
        const mkdir_p = (path) => {
          const parts = path.split('/').filter(p => p.length > 0);
          let current = "";
          for (const part of parts) {
            current += "/" + part;
            const analysis = instance.FS.analyzePath(current);
            if (!analysis.exists) instance.FS.mkdir(current);
          }
        };

        // Load fonts
        try {
          const fontPath = '/fonts/LiberationSans-Regular.ttf';
          if (!instance.FS.analyzePath('/fonts').exists) instance.FS.mkdir('/fonts');
          let res = await fetch('fonts/LiberationSans-Regular.ttf');
          if (!res.ok) res = await fetch('https://raw.githubusercontent.com/openscad/openscad/master/fonts/Liberation-2.00.1/ttf/LiberationSans-Regular.ttf');
          if (res.ok) instance.FS.writeFile(fontPath, new Uint8Array(await res.arrayBuffer()));
          instance.FS.writeFile('/fonts/fonts.conf', `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/fonts/cache</cachedir></fontconfig>`);
        } catch(e) {}

        // Write files
        for (const f of vfsData) {
          const fullPath = f.name.startsWith('/') ? f.name : '/' + f.name;
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
          if (dir) mkdir_p(dir);
          
          let content = f.txt;
          // Apply standard patches (assign, assert)
          content = content.replace(/assign\s*\(/g, 'let(');
          if (content.includes('version()') && content.includes('assert')) {
            content = content.replace(/assert\s*\(\s*(?=.*version\()/g, 'echo("PATCHED_ASSERT", ');
          }
          
          instance.FS.writeFile(fullPath, content);
        }
        return instance;
      }

      // ── RENDER PHASE ──
      self.postMessage({ type: 'log', text: '1. Initializing Primary Engine (STL Pass)...' });
      let engine = await createAndWriteEngine(vfs);
      
      self.postMessage({ type: 'log', text: `   📊 VFS Audit: ${vfs.length} files loaded.` });
      self.postMessage({ type: 'log', text: `3. Starting Render Pass 1 (STL)...` });

      try {
        engine.callMain(["/main.scad", "-o", "out.stl"]);
      } catch (e) {
        const err = (typeof e === 'number' ? `Code ${e}` : e.toString());
        self.postMessage({ type: 'log', text: `   ⚠️ STL Pass failed: ${err}` });
      }

      if (engine.FS.analyzePath("/out.stl").exists && engine.FS.stat("/out.stl").size > 0) {
        const output = engine.FS.readFile("/out.stl");
        self.postMessage({ type: 'done', format: 'stl', data: output }, [output.buffer]);
      } else {
        // --- FALLBACK (SVG) ---
        self.postMessage({ type: 'log', text: `🎨 Pass 1 produced no geometry. Spawning fresh engine for Pass 2 (SVG)...` });
        
        // Destroy/Reset is done by just letting GC take the old instance and creating a new one
        engine = null; 
        let engine2 = await createAndWriteEngine(vfs);
        
        try {
          engine2.callMain(["/main.scad", "-o", "out.svg"]);
        } catch (e) {
          const err = (typeof e === 'number' ? `Code ${e}` : e.toString());
          throw new Error(`SVG Fallback failed: ${err}`);
        }

        if (engine2.FS.analyzePath("/out.svg").exists && engine2.FS.stat("/out.svg").size > 0) {
          const output = engine2.FS.readFile("/out.svg", { encoding: "utf8" });
          self.postMessage({ type: 'done', format: 'svg', data: output });
        } else {
          throw new Error("Render produced no geometry (Empty Scene).");
        }
      }

    } catch (error) {
      self.postMessage({ type: 'error', error: error.toString() });
    }
  }
};