export async function resolveDependencies(rootUrl, options = {}) {
    const fetchedUrls = new Set();
    const virtualFileSystem = [];
    const { onLog = console.log, onError = console.error } = options;

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

            // Scan for 'include <...>' and 'use <...>'
            const importRegex = /^\s*(?:include|use)\s*[<"]([^>"]+)[>"]/gm;
            let match;
            const promises = [];

            while ((match = importRegex.exec(text)) !== null) {
                const relativeRef = match[1];

                // Skip non-scad files (like .stl or .png)
                if (relativeRef.toLowerCase().endsWith('.stl')) continue;

                // Resolve Network URL
                const depUrl = new URL(relativeRef, url).href;

                // Resolve VFS Path
                const parentVirtualUrl = new URL(vfsPath, "http://root/");
                const depVirtualUrl = new URL(relativeRef, parentVirtualUrl);
                const depVfsPath = depVirtualUrl.pathname.substring(1);

                promises.push(crawlAndFetch(depUrl, depVfsPath));
            }

            // Fetch all dependencies in parallel
            await Promise.all(promises);
        } catch (e) {
            const errText = `❌ Failed to fetch dependency: ${vfsPath} (${e.message})`;
            if (onError) onError(errText);
        }
    }

    await crawlAndFetch(rootUrl, "main.scad");
    return virtualFileSystem;
}
