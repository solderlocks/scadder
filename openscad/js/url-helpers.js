// ── URL Helpers ───────────────────────────────────────────────────────────────

function urlParam(name) {
    const val = (location.search.split(name + '=')[1] || '').split('&')[0];
    return val ? decodeURIComponent(val) : '';
}

function toRawUrl(url) {
    url = url.trim();
    if (url.includes('raw.githubusercontent.com')) return url;
    const m = url.match(/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}`;
    return url;
}

function toBlobUrl(rawUrl) {
    // Handle the "refs/heads/" format
    let cleanUrl = rawUrl.replace('/refs/heads/', '/');

    // Parse standard format: raw.githubusercontent.com/user/repo/branch/path
    const m = cleanUrl.match(/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/(.+)/);

    if (m) {
        // Reconstruct as: github.com/user/repo/blob/branch/path
        return `https://github.com/${m[1]}/blob/${m[2]}/${m[3]}`;
    }
    return rawUrl;
}

function setProgress(percent, isCreeping = false) {
    const bar = document.getElementById('progressBar');
    if (!bar) return;

    if (isCreeping) {
        bar.classList.add('creeping');
        bar.offsetHeight; // Force reflow
    } else {
        bar.classList.remove('creeping');
        bar.style.width = percent + '%';
    }
}

function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
