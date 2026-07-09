// Builds the silver 3D logo hero from the SVG asset.
(function() {
  const target = document.getElementById("logo-stage");

  if (!target || !window.THREE || !THREE.SVGLoader) {
    if (target) {
      target.classList.add("logo-fallback");
    }
    return;
  }

  let camera;
  let renderer;
  let scene;
  let coreGroup;
  let ringA;
  let ringB;
  let particles;
  let frameId;

  const pointer = { x: 0, y: 0 };
  const clock = new THREE.Clock();

  function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.2, 8);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 0);
    if (THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    target.appendChild(renderer.domElement);

    coreGroup = new THREE.Group();
    scene.add(coreGroup);

    addLighting();
    addRings();
    addParticles();
    loadLogo();
    bindEvents();
    resize();
    animate();
  }

  function addLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.68));

    const hemi = new THREE.HemisphereLight(0xffffff, 0xdfe7f2, 0.72);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3.8, 5.4, 5.8);
    scene.add(key);

    const front = new THREE.DirectionalLight(0xffffff, 1.05);
    front.position.set(0, 0.8, 6.5);
    scene.add(front);

    const rim = new THREE.DirectionalLight(0xcfe5ff, 0.9);
    rim.position.set(-5.4, 2.8, -3.2);
    scene.add(rim);

    const glint = new THREE.PointLight(0xffffff, 1.1, 15);
    glint.position.set(0, 3.8, 4.2);
    scene.add(glint);
  }

  function addRings() {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xbfd8ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    ringA = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.012, 12, 180), ringMaterial);
    ringA.rotation.set(1.18, 0.18, 0.2);
    coreGroup.add(ringA);

    ringB = new THREE.Mesh(new THREE.TorusGeometry(2.36, 0.008, 12, 180), ringMaterial.clone());
    ringB.material.opacity = 0.12;
    ringB.rotation.set(0.2, 1.18, -0.42);
    coreGroup.add(ringB);
  }

  function addParticles() {
    const count = 96;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const radius = 2.4 + Math.random() * 2.1;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 3.2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.035,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );
    coreGroup.add(particles);
  }

  function loadLogo() {
    const loader = new THREE.SVGLoader();

    loader.load(
      "assets/logo-v2-06.svg",
      function(data) {
        const rawLogo = buildExtrudedLogo(data);
        coreGroup.add(rawLogo);
      },
      undefined,
      function() {
        target.classList.add("logo-fallback");
      }
    );
  }

  function buildExtrudedLogo(data) {
    const rawLogo = new THREE.Group();
    const frontMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe0e7f0,
      metalness: 0.74,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      reflectivity: 0.92,
      emissive: 0x2f3540,
      emissiveIntensity: 0.025,
      side: THREE.DoubleSide
    });
    const sideMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xa8b3c0,
      metalness: 0.82,
      roughness: 0.22,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      emissive: 0x222832,
      emissiveIntensity: 0.018,
      side: THREE.DoubleSide
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5
    });

    data.paths.forEach(function(path) {
      const shapes = THREE.SVGLoader.createShapes(path);

      shapes.forEach(function(shape) {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 160,
          bevelEnabled: true,
          bevelThickness: 22,
          bevelSize: 18,
          bevelSegments: 8,
          curveSegments: 36
        });
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, [frontMaterial, sideMaterial]);
        rawLogo.add(mesh);

        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), edgeMaterial);
        rawLogo.add(edge);
      });
    });

    const box = new THREE.Box3().setFromObject(rawLogo);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const modelScale = 5.1 / maxDimension;

    rawLogo.traverse(function(child) {
      if (child.geometry) {
        child.geometry.translate(-center.x, -center.y, -center.z);
      }
    });

    rawLogo.scale.set(modelScale, -modelScale, modelScale);
    rawLogo.rotation.set(-0.14, 0, 0);
    rawLogo.position.z = -0.2;

    return rawLogo;
  }

  function bindEvents() {
    window.addEventListener("pointermove", function(event) {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
    });

    window.addEventListener("resize", resize);

    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(target);
    }
  }

  function resize() {
    const width = Math.max(320, target.clientWidth || 640);
    const height = Math.max(300, target.clientHeight || 520);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    frameId = requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    coreGroup.position.y = Math.sin(time * 1.05) * 0.13;
    coreGroup.rotation.y = time * 0.24 + pointer.x * 0.13;
    coreGroup.rotation.x = Math.sin(time * 0.72) * 0.035 - pointer.y * 0.055;

    if (ringA) {
      ringA.rotation.z = time * 0.18;
    }
    if (ringB) {
      ringB.rotation.x = 0.2 + Math.sin(time * 0.45) * 0.08;
      ringB.rotation.z = -time * 0.14;
    }
    if (particles) {
      particles.rotation.y = -time * 0.08;
    }

    renderer.render(scene, camera);
  }

  document.addEventListener("visibilitychange", function() {
    if (document.hidden && frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    } else if (!document.hidden && !frameId) {
      animate();
    }
  });

  init();
})();
