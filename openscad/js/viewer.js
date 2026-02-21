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

    let oldOpacity = 0.95;
    let oldWireVisible = meshWire ? meshWire.visible : false;
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

    // Check if ruler was active before wipe
    const wasRulerVisible = rulerMesh && rulerMesh.visible;
    rulerMesh = null; // Reset reference since object is gone

    document.getElementById('downloadBtn').disabled = false;
    document.getElementById('renderOverlay').classList.add('hidden');

    const btnWire = document.getElementById('btnWireframeToggle');
    if (btnWire) btnWire.classList.toggle('active', meshWire.visible);

    // Restore ruler if it was active
    if (wasRulerVisible) {
        toggleRuler();
    }
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

function toggleWireframeMode() {
    if (!meshWire || !meshSolid) return;
    const isWireframeVisible = meshWire.visible;
    if (isWireframeVisible) {
        meshWire.visible = false;
        meshSolid.visible = true;
    } else {
        meshWire.visible = true;
        meshSolid.visible = false;
    }
    const btn = document.getElementById('btnWireframeToggle');
    if (btn) btn.classList.toggle('active', meshWire.visible);
}

// ── Ruler ─────────────────────────────────────────────────────────────────────

var rulerMesh = null;

function toggleRuler() {
    if (!rulerMesh) {
        createRuler();
    } else {
        rulerMesh.visible = !rulerMesh.visible;
    }
    // Update button state
    const btn = document.getElementById('btnRuler');
    if (btn) btn.classList.toggle('active', rulerMesh && rulerMesh.visible);
}

function createRuler() {
    if (!meshSolid) return;

    // Ruler dimensions: 12 inches x 1 inch x 1/8 inch approx
    // 304.8mm x 25.4mm x 2mm
    const length = 304.8;
    const width = 25.4;
    const thick = 2;

    const group = new THREE.Group();

    // Body (Yellow)
    const geometry = new THREE.BoxBufferGeometry(length, thick, width);
    const material = new THREE.MeshBasicMaterial({ color: 0xffc107 });
    const body = new THREE.Mesh(geometry, material);
    group.add(body);

    // Ticks (Black)
    // We'll use a single geometry for each type of tick to save draw calls if possible, 
    // but for simplicity/readability we'll just loop and add meshes. 
    // Optimization: Merge geometries if performance issues arise (unlikely for <100 boxes).

    const tickMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // ── Inches (Front side: +Z in ruler local space) ──────────────────────────
    // Major (1"): Length 10mm
    // Medium (1/2"): Length 7mm
    // Minor (1/4"): Length 4mm

    // Ruler runs along X axis. 0 is center. Left is -152.4.
    const startX = -length / 2;

    for (let i = 0; i <= 12; i++) {
        // Position
        const xPos = startX + (i * 25.4);

        // Major Tick
        const majTick = new THREE.Mesh(new THREE.BoxBufferGeometry(1, thick + 0.2, 12), tickMat);
        majTick.position.set(xPos, 0, width / 2 - 6);
        group.add(majTick);

        if (i < 12) {
            // Half inch
            const halfTick = new THREE.Mesh(new THREE.BoxBufferGeometry(0.8, thick + 0.1, 8), tickMat);
            halfTick.position.set(xPos + 12.7, 0, width / 2 - 4);
            group.add(halfTick);

            // Quarter inches
            const qTick1 = new THREE.Mesh(new THREE.BoxBufferGeometry(0.5, thick + 0.05, 5), tickMat);
            qTick1.position.set(xPos + 6.35, 0, width / 2 - 2.5);
            group.add(qTick1);

            const qTick2 = new THREE.Mesh(new THREE.BoxBufferGeometry(0.5, thick + 0.05, 5), tickMat);
            qTick2.position.set(xPos + 19.05, 0, width / 2 - 2.5);
            group.add(qTick2);
        }
    }

    // ── Centimeters (Back side: -Z in ruler local space) ──────────────────────
    // 304.8mm is approx 30.5 cm
    const numCm = Math.floor(length / 10); // 30

    for (let i = 0; i <= numCm; i++) {
        const xPos = startX + (i * 10);

        // Major Tick (CM)
        const cmTick = new THREE.Mesh(new THREE.BoxBufferGeometry(0.8, thick + 0.2, 8), tickMat);
        cmTick.position.set(xPos, 0, -width / 2 + 4);
        group.add(cmTick);

        if (i < numCm) {
            // Half CM (5mm)
            const mmTick = new THREE.Mesh(new THREE.BoxBufferGeometry(0.5, thick + 0.1, 5), tickMat);
            mmTick.position.set(xPos + 5, 0, -width / 2 + 2.5);
            group.add(mmTick);
        }
    }

    // ── Labels (Canvas Textures) ──────────────────────────────────────────────

    function createLabel(text, size = 20, w = 64, h = 32) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffc107'; // Match ruler bg
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold ' + size + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;

        const mat = new THREE.MeshBasicMaterial({ map: tex });
        // Aspect ratio based on w/h
        const aspect = w / h;
        const planeH = 7.5;
        const planeW = planeH * aspect;
        return new THREE.Mesh(new THREE.PlaneBufferGeometry(planeW, planeH), mat);
    }

    const lblIn = createLabel("IN");
    lblIn.rotation.x = -Math.PI / 2;
    lblIn.position.set(-length / 2 + 10, thick / 2 + 0.1, width / 2 - 10);
    group.add(lblIn);

    const lblCm = createLabel("CM");
    lblCm.rotation.x = -Math.PI / 2;
    lblCm.rotation.z = Math.PI; // Flip for other side reading
    lblCm.position.set(-length / 2 + 10, thick / 2 + 0.1, -width / 2 + 10);
    group.add(lblCm);

    // Number labels 1-12
    for (let i = 1; i <= 12; i++) {
        const lbl = createLabel(i.toString(), 24, 32, 32); // Increased font size relative to canvas
        lbl.rotation.x = -Math.PI / 2;
        // Position: X is tick pos, Z is centered-ish but slightly offset to not overlap ticks if they are long
        // Ticks are at width/2 - length. Major ticks are ~8-12mm long. 
        // Let's place numbers centered on X, and somewhat centered on Z (away from ticks).
        // width=25.4. Major tick z-pos: width/2 - 6.
        let xPos = startX + (i * 25.4);

        // Tweaks
        if (i === 12) xPos -= 5; // Shift 12 slightly left to keep it on the board

        lbl.position.set(xPos, thick / 2 + 0.1, 0); // Center of ruler strip
        group.add(lbl);
    }


    // Position the ruler
    // Get bounds of the model
    const box = new THREE.Box3().setFromObject(meshSolid);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const min = box.min;

    // Reset ruler rotation/position
    group.rotation.set(0, 0, 0);

    // Align center X
    group.position.x = center.x;

    // Sit on floor (assuming model min Y is floor or close to it)
    group.position.y = min.y + thick / 2;

    // Place in front (min Z)
    // Add some padding
    group.position.z = box.max.z + width + 10;

    rulerMesh = group;
    Engine.addToScene(rulerMesh, 'scene-0');
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

// ── About Modal ───────────────────────────────────────────────────────────────

function showAbout() {
    document.getElementById('aboutModal').classList.add('open');
}

function closeAbout() {
    document.getElementById('aboutModal').classList.remove('open');
}

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAbout();
});

// ── Sticky Render Bar ─────────────────────────────────────────────────────────

var _stickyObserver = null;
var _toolbarOutOfView = false;
var _paramsDirty = false;

function updateStickyBarVisibility() {
    const stickyBar = document.getElementById('stickyRenderBar');
    // Always show if dirty, regardless of scroll position
    if (stickyBar) stickyBar.classList.toggle('visible', _paramsDirty);
}

function updateStickyBarDirty() {
    if (!window.lastRenderedValues) {
        _paramsDirty = false;
    } else {
        _paramsDirty = parsedParams.some((p, i) => {
            const lastVal = window.lastRenderedValues[i];
            return p.value != lastVal;
        });
    }
    updateStickyBarVisibility();
}

function initStickyRenderBar() {
    const toolbar = document.querySelector('.viewport-toolbar');
    const stickyBar = document.getElementById('stickyRenderBar');
    if (!toolbar || !stickyBar) return;

    _stickyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            _toolbarOutOfView = !entry.isIntersecting;
            updateStickyBarVisibility();
        });
    }, { threshold: 0 });

    _stickyObserver.observe(toolbar);
}
