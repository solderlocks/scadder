containerMap = new Map();
camControlMap = new Map();

RenderHandler = {
	draw(s, cID) {
		if (!containerMap.has(cID)) {
			containerMap.set(cID, createNewRenderer(cID));
			const camControl = new THREE.OrbitControls(s.camera, containerMap.get(cID).domElement);
			camControl.screenSpacePanning = true;

			// Dynamically adjust rotation and pan sensitivity based on zoom level
			camControl.addEventListener('change', () => {
				if (s.camera.isOrthographicCamera) {
					// Base zoom is around 3.0. Scale down speed as zoom increases.
					const baseZoom = 3.0;
					const scaleFactor = Math.min(1.0, baseZoom / s.camera.zoom);
					camControl.rotateSpeed = scaleFactor;
					// Dampen translation less aggressively than rotation (square root curve)
					camControl.panSpeed = Math.pow(scaleFactor, 0.5);
				}
			});

			camControlMap.set(cID, camControl);
		}

		const r = containerMap.get(cID);
		const c = $(`#${cID}`);
		r.setSize(c.width(), c.height());

		if (s.picking) {

		} else {
			r.render(s.scene, s.camera);
		}
	}
}

function createNewRenderer(cID) {
	const r = new THREE.WebGLRenderer();
	const c = $(`#${cID}`);
	r.setSize(c.width(), c.height());
	c.append(r.domElement);

	return r;
}
