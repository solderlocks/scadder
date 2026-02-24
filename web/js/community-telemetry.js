/**
 * Giscus "Community Telemetry" component for Scadder.
 * Dynamically injects Giscus comments based on the current model URL.
 */

function updateCommunityTelemetry(decodedScadUrl) {
    const container = document.getElementById('giscus-container');
    if (!container) return;

    // Clear previous Giscus iframe/script
    container.innerHTML = '';

    // Create the script element with required Giscus attributes
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', 'pollesbog/scadder');
    script.setAttribute('data-repo-id', 'R_kgDORRNb3Q');
    script.setAttribute('data-category', 'Object Feedback');
    script.setAttribute('data-category-id', 'DIC_kwDORRNb3c4C3BUE');
    script.setAttribute('data-mapping', 'specific');
    script.setAttribute('data-term', decodedScadUrl);
    script.setAttribute('data-strict', '1');
    script.setAttribute('data-reactions-enabled', '0');
    script.setAttribute('data-emit-metadata', '1');
    script.setAttribute('data-input-position', 'bottom');
    // Construct absolute URL for the custom theme
    const themeUrl = new URL('css/giscus-scadder.css?t=' + Date.now(), window.location.href).href;

    script.setAttribute('data-theme', themeUrl);
    script.setAttribute('data-lang', 'en');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;

    // Inject the script into the container
    container.appendChild(script);
    console.log(`[Telemetry] Initialized Giscus for: ${decodedScadUrl}`);
}

// Export to window for global access
window.updateCommunityTelemetry = updateCommunityTelemetry;

// Listen for Giscus cross-document messages to update comment count
window.addEventListener('message', (event) => {
    if (event.origin !== 'https://giscus.app') return;
    if (!(typeof event.data === 'object' && event.data.giscus)) return;

    const giscusData = event.data.giscus;
    if (giscusData.discussion) {
        const countSpan = document.getElementById('discussionCount');
        if (countSpan) {
            const count = giscusData.discussion.totalCommentCount;
            if (count !== undefined) {
                countSpan.textContent = count > 0 ? `${count} comment${count !== 1 ? 's' : ''}` : 'No comments';
            }
        }
    }
});
