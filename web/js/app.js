// ── Globals ───────────────────────────────────────────────────────────────────
var virtualFileSystem = [{ name: "main.scad", txt: "" }];
var meshWire, meshSolid;
var parsedParams = [];

// ── Load Model from URL ───────────────────────────────────────────────────────

async function loadScadFromUrl(url) {
    const rawUrl = toRawUrl(url);
    virtualFileSystem = [];

    document.getElementById('landingState').style.display = 'none';
    document.getElementById('modelView').style.display = 'block';

    const filename = rawUrl.split('/').pop().replace(/\.scad$/i, '');
    document.getElementById('modelTitle').textContent = filename.replace(/[-_]/g, ' ');

    // Check library.json for curated title/description (always more precise)
    window._hasLibraryDescription = false;
    try {
        let libraryData = app.data && app.data.length ? app.data : null;
        if (!libraryData) {
            const libRes = await fetch('../core/library.json');
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

    if (!window.isWasmSupported) {
        document.getElementById('wasmErrorOverlay').style.display = 'flex';
        const renderOverlay = document.getElementById('renderOverlay');
        if (renderOverlay) renderOverlay.style.display = 'none';
        const runBtn = document.getElementById('runBtn');
        if (runBtn) runBtn.disabled = true;
        return;
    }

    init3D();

    // Show the overlay immediately
    document.getElementById('renderOverlay').classList.remove('hidden');
    setProgress(10);
    document.getElementById('renderStatus').textContent = 'Crawling project dependencies…';

    try {
        const { resolveDependencies } = await import('../../core/crawler.js');
        virtualFileSystem = await resolveDependencies(rawUrl, {
            onLog: (msg) => console.log(msg),
            onError: (msg) => {
                document.getElementById('consoleOutput').textContent += msg + "\n";
                console.error(msg);
            }
        });

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
