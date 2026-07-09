// Atmospheric Geometry - using Three.js primitives, fog, arrays, and animation
(function() {
  let scene, camera, renderer, controls;
  const forms = [];

  function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf1f3f6, 4, 15);

    camera = new THREE.PerspectiveCamera(60, 800 / 400, 0.1, 50);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(800, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf1f3f6);

    document.getElementById('threejs-container-3').appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.82);
    scene.add(ambient);

    const sideLight = new THREE.DirectionalLight(0xffffff, 0.48);
    sideLight.position.set(-5, 8, 4);
    scene.add(sideLight);

    const palette = [0x4b74ff, 0xffd8b4, 0xf5705e, 0xffffff];
    const geometries = [
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.SphereGeometry(0.82, 32, 32),
      new THREE.ConeGeometry(0.8, 1.8, 32),
      new THREE.CylinderGeometry(0.58, 0.58, 1.7, 32)
    ];

    for (let i = 0; i < 16; i++) {
      const material = new THREE.MeshPhongMaterial({
        color: palette[i % palette.length],
        transparent: true,
        opacity: 0.72,
        shininess: 40
      });
      const mesh = new THREE.Mesh(geometries[i % geometries.length], material);
      mesh.position.set(
        (i % 4) * 2.1 - 3.2,
        0.75 + Math.sin(i * 0.9) * 0.75,
        Math.floor(i / 4) * -1.65 + 2.4
      );
      mesh.rotation.set(i * 0.18, i * 0.31, i * 0.12);
      scene.add(mesh);
      forms.push(mesh);
    }

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 10, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.22
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    scene.add(floor);

    camera.position.set(-5.8, 4.4, 6.2);
    camera.lookAt(0, 1, -1.2);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = false;
    controls.minDistance = 4;
    controls.maxDistance = 22;
    controls.target.set(0, 1, -1.2);
  }

  function animate() {
    requestAnimationFrame(animate);

    for (let i = 0; i < forms.length; i++) {
      forms[i].rotation.y += 0.006 + (i % 4) * 0.001;
      forms[i].rotation.x += 0.002;
      forms[i].position.y += Math.sin(Date.now() * 0.001 + i) * 0.0008;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  init();
  animate();
})();
