// ── 3D Viewer ─────────────────────────────────────────────────────────────────

// Lazy-load the scene so it initializes only when visible
var sceneInitialized = false;

function init3D() {
    if (sceneInitialized) return;
    Engine.createScene({ containerId: 'canvas-container', showGrid: false });
    sceneInitialized = true;
}

async function ShowMeThatStinkingStlFile(currentSTL) {
    window.currentSTL = currentSTL;
    try {
        SceneHandler.getScene("scene-0").scene.children =
            [SceneHandler.getScene("scene-0").scene.children[0]];
    } catch (e) { }

    const loader = new THREE.STLLoader();
    var geometry = loader.parse(currentSTL);

    let oldOpacity = parseFloat(document.getElementById('opacitySlider').value) || 0.95;
    let oldWireVisible = meshWire ? meshWire.visible : true;
    let oldSolidVisible = meshSolid ? meshSolid.visible : true;

    meshWire = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xc8922a, wireframe: true }));
    meshSolid = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial({ transparent: true, opacity: oldOpacity }));
    meshWire.visible = oldWireVisible;
    meshSolid.visible = oldSolidVisible;

    meshWire.rotateX(-Math.PI / 2);
    meshSolid.rotateX(-Math.PI / 2);

    var box = new THREE.Box3().setFromObject(meshSolid);
    var meshTranslationInY = box.getSize().y / 2;
    meshWire.translateZ(meshTranslationInY);
    meshSolid.translateZ(meshTranslationInY);

    await Engine.addToScene(meshWire, 'scene-0');
    await Engine.addToScene(meshSolid, 'scene-0');

    document.getElementById('downloadBtn').disabled = false;
    document.getElementById('renderOverlay').classList.add('hidden');
}

function downloadSTL() {
    if (!window.currentSTL) return;
    const name = (document.getElementById('modelTitle').textContent || 'model')
        .replace(/\s+/g, '-').toLowerCase() + '.stl';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([window.currentSTL], { type: 'application/octet-stream' }));
    a.download = name;
    a.click();
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

function toggleSection(header) {
    const body = header.nextElementSibling;
    const ch = header.querySelector('.chevron');
    const open = body.classList.contains('open');
    body.classList.toggle('open', !open);
    header.classList.toggle('open', !open);
    ch.classList.toggle('open', !open);
}

function showAbout() {
    alert('Scadder β\n\nAn open parametric design library.\nDesigns live on GitHub. Fork everything.\n\nBuilt on OpenSCAD · Manifold · Three.js');
}
