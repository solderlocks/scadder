// ── Globals ───────────────────────────────────────────────────────────────────
var virtualFileSystem = [{ name: "main.scad", txt: "" }];
var meshWire, meshSolid;
var parsedParams = [];
var baseScadState = "";
var patchTimeout = null;

var ScadWorker = {
    worker: null,
    frameworks: {},
    setFrameworks(data) {
        this.frameworks = data;
        if (this.worker) {
            this.worker.postMessage({ command: 'setFrameworks', frameworks: data });
        }
    }
};

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
        // ── NEW: Fetch Frameworks config to prevent VFS poisoning ──
        let frameworksData = {};
        try {
            const fwRes = await fetch('https://raw.githubusercontent.com/solderlocks/scadder/main/core/frameworks.json');
            if (fwRes.ok) {
                frameworksData = await fwRes.json();
                ScadWorker.setFrameworks(frameworksData);
            }
        } catch (e) {
            console.warn('Failed to load frameworks.json:', e);
        }

        const { resolveDependencies } = await import('../../core/crawler.js');
        // ── UPDATED: Pass frameworksData into the crawler ──
        virtualFileSystem = await resolveDependencies(rawUrl, {
            onLog: (msg) => console.log(msg),
            onError: (msg) => {
                document.getElementById('consoleOutput').textContent += msg + "\n";
                console.error(msg);
            },
            frameworks: frameworksData // Intercept frameworks here
        });

        const mainFile = virtualFileSystem.find(f => f.name === "main.scad");
        if (!mainFile) throw new Error("Failed to load main file");

        // ── SCADDER DOCBLOCK PARSING (Authoritative Metadata) ────────────────
        const docblock = parseScadderDocblock(mainFile.txt);
        if (docblock) {
            if (docblock.name) {
                document.getElementById('modelTitle').textContent = docblock.name;
            }
            if (docblock.description) {
                document.getElementById('modelSubtitle').textContent = docblock.description;
            }
            if (docblock.author) {
                const authEl = document.getElementById('ghAuthor');
                if (authEl) {
                    authEl.textContent = `by ${docblock.author}`;
                    document.getElementById('githubMeta').style.display = 'flex';
                }
            }
        }

        baseScadState = mainFile.txt;

        const urlParams = new URLSearchParams(window.location.search);
        const patchParam = urlParams.get('patch');

        if (patchParam) {
            try {
                const decompressedPatch = LZString.decompressFromEncodedURIComponent(patchParam);
                if (!decompressedPatch) throw new Error("Decompression failed");
                const patchedText = Diff.applyPatch(baseScadState, decompressedPatch);
                if (patchedText === false) throw new Error("Patch conflict");
                mainFile.txt = patchedText;

                // UI Indicators
                document.getElementById('patchBadge').classList.add('visible');
                const modBadge = document.getElementById('modifiedBadge');
                if (modBadge) modBadge.style.display = 'inline-flex';

            } catch (err) {
                document.getElementById('consoleOutput').textContent += "Failed to apply URL patch to base file\n";
            }
        }

        const editor = document.getElementById('sourceDisplay');
        editor.value = mainFile.txt;
        editor.textContent = mainFile.txt;

        // Cmd/Ctrl + Enter to render
        editor.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                window.runAndShowScad();
            }
        });

        editor.addEventListener('input', () => {
            const currentText = editor.value;
            const mf = virtualFileSystem.find(f => f.name === "main.scad");
            if (mf) mf.txt = currentText;

            clearTimeout(patchTimeout);
            patchTimeout = setTimeout(() => {
                const patch = Diff.createPatch('main.scad', baseScadState, currentText);

                const u = new URL(window.location.href);
                if (currentText === baseScadState) {
                    u.searchParams.delete('patch');
                    document.getElementById('patchBadge').classList.remove('visible');
                    const modBadge = document.getElementById('modifiedBadge');
                    if (modBadge) modBadge.style.display = 'none';
                } else {
                    const compressed = LZString.compressToEncodedURIComponent(patch);
                    u.searchParams.set('patch', compressed);
                    document.getElementById('patchBadge').classList.add('visible');
                }
                window.history.replaceState({}, '', u.toString());
            }, 500);
        });

        loadGithubMeta(rawUrl);
        loadSidecars(rawUrl);
        if (window.updateCommunityTelemetry) window.updateCommunityTelemetry(url);

        document.getElementById('renderStatus').textContent = 'Parsing parameters…';

        // YIELD: Let the UI update text
        await new Promise(r => setTimeout(r, 50));

        // Initial parse for linear pipeline
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

// ── Drop Patch Logic ──────────────────────────────────────────────────────────

window.dropPatch = function () {
    const editor = document.getElementById('sourceDisplay');
    editor.value = baseScadState;
    editor.textContent = baseScadState;

    const mf = virtualFileSystem.find(f => f.name === "main.scad");
    if (mf) mf.txt = baseScadState;

    const u = new URL(window.location.href);
    u.searchParams.delete('patch');
    window.history.replaceState({}, '', u.toString());

    document.getElementById('patchBadge').classList.remove('visible');
    const modBadge = document.getElementById('modifiedBadge');
    if (modBadge) modBadge.style.display = 'none';

    window.runAndShowScad();
};

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
