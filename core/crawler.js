export async function resolveDependencies(rootUrl, options = {}) {
    const fetchedUrls = new Set();
    const virtualFileSystem = [];
    virtualFileSystem.frameworks = {}; // Attach associative metadata to the returned array
    
    const { onLog = console.log, onError = console.error, frameworks = {} } = options;
    const frameworkPrefixes = Object.keys(frameworks).map(f => f + '/');

    async function crawlAndFetch(url, vfsPath) {
        if (fetchedUrls.has(url)) return;
        fetchedUrls.add(url);

        if (onLog) onLog(`📂 Crawling: ${vfsPath} <== ${url}`);

        // Give the UI/event loop a tiny "breath" to prevent locking up
        await new Promise(r => setTimeout(r, 10));

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const errText = `❌ Failed to fetch dependency: ${vfsPath} (${res.status})`;
                if (onError) onError(errText);
                return;
            }

            const text = await res.text();

            // Store in VFS with its relative directory path
            virtualFileSystem.push({ name: vfsPath, txt: text });

            // 1. Strip block comments (/* ... */)
            let cleanText = text.replace(/\/\*[\s\S]*?\*\//g, '');
            // We cannot broadly strip single-line comments anymore because we need the @requires tag.

            const importRegex = /^\s*(?:include|use)\s*[<"]([^>"]+)[>"](?:.*?(\/\/\s*@requires:\s*([^\s]+)))?/gm;
            let match;
            const promises = [];

            while ((match = importRegex.exec(cleanText)) !== null) {
                const relativeRef = match[1];
                const requiresTag = match[3] || null;

                // Skip non-scad files
                if (relativeRef.toLowerCase().endsWith('.stl') || relativeRef.toLowerCase().endsWith('.dxf')) continue;

                // Check if this is a call to a standard global library
                const isGlobalLib = frameworkPrefixes.some(prefix => relativeRef.startsWith(prefix)) || requiresTag;
                if (isGlobalLib) {
                    const fwId = relativeRef.split('/')[0];
                    if (!virtualFileSystem.frameworks[fwId] || requiresTag) {
                        virtualFileSystem.frameworks[fwId] = requiresTag || null;
                    }
                    if (onLog) onLog(`  ⏭️ Skipping monolithic framework ref: ${relativeRef}`);
                    continue;
                }

                // Resolve Network URL
                const depUrl = new URL(relativeRef, url).href;

                // Resolve VFS Path
                const parentVirtualUrl = new URL(vfsPath, "http://root/");
                const depVirtualUrl = new URL(relativeRef, parentVirtualUrl);
                const depVfsPath = depVirtualUrl.pathname.substring(1);

                promises.push(crawlAndFetch(depUrl, depVfsPath));
            }

            await Promise.all(promises);
        } catch (e) {
            const errText = `❌ Failed to fetch dependency: ${vfsPath} (${e.message})`;
            if (onError) onError(errText);
        }
    }

    await crawlAndFetch(rootUrl, "main.scad");
    return virtualFileSystem;
}
