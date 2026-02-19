// ── GitHub Metadata & Library Lookup ──────────────────────────────────────────

async function loadGithubMeta(rawUrl) {
    const blobUrl = toBlobUrl(rawUrl);

    // 1. Setup buttons immediately (Before API check)
    const sourceBtn = document.getElementById('githubSourceBtn');
    const forkBtn = document.getElementById('githubForkBtn');

    if (!sourceBtn) console.error("Could not find source button!");

    if (sourceBtn) sourceBtn.href = blobUrl;

    const repoMatch = blobUrl.match(/github\.com\/([^/]+\/[^/]+)\//);
    if (repoMatch && forkBtn) {
        forkBtn.href = `https://github.com/${repoMatch[1]}/fork`;
    }

    // 2. API Call (Rate limited part)
    const apiBase = rawUrl.match(/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\//);
    if (!apiBase) return;

    try {
        const res = await fetch(`https://api.github.com/repos/${apiBase[1]}`);
        if (res.status === 403) return; // Rate limit - just exit, buttons already set
        if (!res.ok) return;

        const d = await res.json();
        document.getElementById('githubMeta').style.display = 'flex';
        document.getElementById('ghAuthor').innerHTML = `<span style="color:var(--text-dim)">by</span> <a href="https://github.com/${d.owner?.login}" target="_blank">${d.owner?.login}</a>`;
        document.getElementById('ghStars').textContent = `★ ${(d.stargazers_count || 0).toLocaleString()}`;
        document.getElementById('ghLicense').textContent = d.license?.spdx_id || 'No license';
        // Only use GitHub description if no library description was already set
        if (d.description && !window._hasLibraryDescription) document.getElementById('modelSubtitle').textContent = d.description;
    } catch (e) { }
}

// ── Sidecar Files (bom.json, print-settings.json) ─────────────────────────────
async function loadSidecars(rawUrl) {
    const dir = rawUrl.substring(0, rawUrl.lastIndexOf('/'));

    // Print settings and BOM loading is currently disabled.
    // Uncomment and implement when sidecar files are available.
}
