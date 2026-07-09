// Interactive 3D Scene - using Three.js primitives, loops, arrays, and OrbitControls
(function() {
  let scene, camera, renderer, controls;
  const rotatingObjects = [];

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 800 / 400, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(800, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf8f8f6);

    document.getElementById('threejs-container-2').appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(16, 32, 0xd5d5d0, 0xe8e8e4);
    scene.add(grid);

    const ambient = new THREE.AmbientLight(0xffffff, 0.68);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const objects = [
      createMesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), 0x4b74ff, -4.7, 1.0, 0),
      createMesh(new THREE.SphereGeometry(1.0, 32, 32), 0xffd8b4, -1.3, 1.05, -0.5),
      createMesh(new THREE.CylinderGeometry(0.82, 0.82, 1.9, 32), 0xf5705e, 2.0, 0.95, 0.25),
      createMesh(new THREE.ConeGeometry(0.9, 2.1, 32), 0x1a1d22, 4.8, 1.05, -0.8)
    ];

    for (let i = 0; i < objects.length; i++) {
      scene.add(objects[i]);
      rotatingObjects.push(objects[i]);
    }

    const smallSphereGeometry = new THREE.SphereGeometry(0.16, 16, 16);
    const smallSphereMaterial = new THREE.MeshPhongMaterial({ color: 0x4b74ff, shininess: 60 });

    for (let i = 0; i < 18; i++) {
      const x = i * 0.58 - 5;
      const z = Math.sin(i * 0.78) * 2.2;
      const y = 0.2 + Math.cos(i * 0.42) * 0.22;
      const sphere = new THREE.Mesh(smallSphereGeometry, smallSphereMaterial);
      sphere.position.set(x, y, z);
      scene.add(sphere);
    }

    camera.position.set(7.5, 6.2, 8.0);
    camera.lookAt(0, 1, 0);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controls.minDistance = 4;
    controls.maxDistance = 40;
    controls.target.set(0, 1, 0);
  }

  function createMesh(geometry, color, x, y, z) {
    const material = new THREE.MeshPhongMaterial({
      color: color,
      shininess: 70,
      transparent: true,
      opacity: 0.92
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  function animate() {
    requestAnimationFrame(animate);

    for (let i = 0; i < rotatingObjects.length; i++) {
      rotatingObjects[i].rotation.x += 0.006 + i * 0.002;
      rotatingObjects[i].rotation.y += 0.01 + i * 0.003;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  init();
  animate();
})();
