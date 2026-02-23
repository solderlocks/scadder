// ── Globals ───────────────────────────────────────────────────────────────────
var virtualFileSystem = [{ name: "main.scad", txt: "" }];
var meshWire, meshSolid;
var parsedParams = [];
var fetchedUrls = new Set();

// ── Load Model from URL ───────────────────────────────────────────────────────

async function loadScadFromUrl(url) {
    const rawUrl = toRawUrl(url);
    fetchedUrls.clear();
    virtualFileSystem = [];

    document.getElementById('landingState').style.display = 'none';
    document.getElementById('modelView').style.display = 'block';

    init3D();

    const filename = rawUrl.split('/').pop().replace(/\.scad$/i, '');
    document.getElementById('modelTitle').textContent = filename.replace(/[-_]/g, ' ');

    // Check library.json for curated title/description (always more precise)
    window._hasLibraryDescription = false;
    try {
        let libraryData = app.data && app.data.length ? app.data : null;
        if (!libraryData) {
            const libRes = await fetch('library.json');
            if (libRes.ok) libraryData = await libRes.json();
        }
        if (libraryData) {
            const libraryItem = libraryData.find(item => item.url === url);
            if (libraryItem) {
                if (libraryItem.title) document.getElementById('modelTitle').textContent = libraryItem.title;
                if (libraryItem.description) {
                    document.getElementById('modelSubtitle').textContent = libraryItem.description;
                    window._hasLibraryDescription = true;
                }
            }
        }
    } catch (e) { console.warn('Library lookup skipped:', e); }

    // Show the overlay immediately
    document.getElementById('renderOverlay').classList.remove('hidden');
    setProgress(10);
    document.getElementById('renderStatus').textContent = 'Crawling project dependencies…';

    try {
        await crawlAndFetch(rawUrl, "main.scad");

        const mainFile = virtualFileSystem.find(f => f.name === "main.scad");
        if (!mainFile) throw new Error("Failed to load main file");

        document.getElementById('sourceDisplay').innerHTML = mainFile.txt.split('\n')
            .map((l, i) => `<span class="src-ln">${String(i + 1).padStart(3, ' ')}</span>${esc(l)}`)
            .join('\n');

        loadGithubMeta(rawUrl);
        loadSidecars(rawUrl);
        if (window.updateCommunityTelemetry) window.updateCommunityTelemetry(url);

        document.getElementById('renderStatus').textContent = 'Parsing parameters…';

        // YIELD: Let the UI update text
        await new Promise(r => setTimeout(r, 50));

        const groups = parseScadParams(mainFile.txt);
        parsedParams = groups.flatMap(g => g.params);
        applyUrlState();

        buildParamUI(groups);

        // Before heavy render, update text and wait for the spinner to appear
        setProgress(15);
        document.getElementById('renderStatus').textContent = 'Compiling geometry (this may take a moment)…';
        await new Promise(r => setTimeout(r, 100));

        await window.runAndShowScad();

    } catch (e) {
        document.getElementById('renderStatus').textContent = `Error: ${e.message}`;
        console.error(e);
    }
}

// ── Recursive Dependency Crawler ──────────────────────────────────────────────

async function crawlAndFetch(url, vfsPath) {
    // Prevent infinite loops (Circular Dependencies)
    if (fetchedUrls.has(url)) return;
    fetchedUrls.add(url);

    console.log(`📂 Crawling: ${vfsPath} <== ${url}`);

    // Give the UI a tiny "breath" to prevent the browser from locking up
    await new Promise(r => setTimeout(r, 10));

    const res = await fetch(url);
    if (!res.ok) {
        const errText = `❌ Failed to fetch dependency: ${vfsPath} (${res.status})`;
        document.getElementById('consoleOutput').textContent += errText + "\n";
        console.error(errText);
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
}

// ── URL Bar Handler ───────────────────────────────────────────────────────────

function loadFromInput() {
    const val = document.getElementById('urlInput').value.trim();
    if (!val) return;
    const u = new URL(window.location.href);
    u.searchParams.set('file', val);
    window.history.pushState({}, '', u.toString());
    loadScadFromUrl(val);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

if (!urlParam('file')) {
    document.addEventListener('DOMContentLoaded', () => {
        app.init();
    });
}
