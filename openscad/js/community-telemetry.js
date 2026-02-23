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
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'bottom');
    script.setAttribute('data-theme', 'transparent_dark');
    script.setAttribute('data-lang', 'en');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;

    // Inject the script into the container
    container.appendChild(script);
    console.log(`[Telemetry] Initialized Giscus for: ${decodedScadUrl}`);
}

// Export to window for global access
window.updateCommunityTelemetry = updateCommunityTelemetry;
