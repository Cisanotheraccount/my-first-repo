// 3D Primitive Composition - using Three.js scene, camera, renderer, and animation loop
(function() {
  let scene, camera, renderer, cube, ring;

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 800 / 400, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(800, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf7f6f2);

    document.getElementById('threejs-container-1').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.68);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 8, 6);
    scene.add(directionalLight);

    const gridHelper = new THREE.GridHelper(10, 20, 0xd8d7d1, 0xe6e4de);
    scene.add(gridHelper);

    const cubeGeometry = new THREE.BoxGeometry(1.35, 1.35, 1.35);
    const cubeMaterial = new THREE.MeshPhongMaterial({
      color: 0x4b74ff,
      shininess: 95,
      specular: 0xffffff
    });
    cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.y = 0.95;
    scene.add(cube);

    const sphereGeometry = new THREE.SphereGeometry(0.42, 32, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0xffd8b4,
      shininess: 40
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(Math.cos(angle) * 2.35, 0.42, Math.sin(angle) * 2.35);
      scene.add(sphere);
    }

    ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.018, 12, 120),
      new THREE.MeshBasicMaterial({ color: 0x1a1d22 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.43;
    scene.add(ring);

    camera.position.set(3.5, 3.2, 5.2);
    camera.lookAt(0, 0.8, 0);
  }

  function animate() {
    requestAnimationFrame(animate);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.014;
    ring.rotation.z += 0.004;

    renderer.render(scene, camera);
  }

  init();
  animate();
})();
