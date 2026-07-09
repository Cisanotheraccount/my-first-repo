// Builds the titanium 3D logo hero from the SVG asset.
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
    scene.add(new THREE.AmbientLight(0xffffff, 0.74));

    const hemi = new THREE.HemisphereLight(0xf8fbff, 0xc5ccd4, 0.74);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 0.96);
    key.position.set(4.2, 5.2, 5.8);
    scene.add(key);

    const front = new THREE.DirectionalLight(0xf8fbff, 0.78);
    front.position.set(0, 0.8, 6.5);
    scene.add(front);

    const rim = new THREE.DirectionalLight(0xcfe2ff, 0.72);
    rim.position.set(-5.4, 2.8, -3.2);
    scene.add(rim);

    const glint = new THREE.PointLight(0xffffff, 0.58, 15);
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
    const titaniumTexture = createTitaniumTexture(1);
    const titaniumBump = createTitaniumTexture(2);

    const frontMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd4d0c8,
      metalness: 0.78,
      roughness: 0.66,
      clearcoat: 0.08,
      clearcoatRoughness: 0.86,
      reflectivity: 0.28,
      map: titaniumTexture,
      roughnessMap: titaniumTexture,
      bumpMap: titaniumBump,
      bumpScale: 0.026,
      emissive: 0x1b1b19,
      emissiveIntensity: 0.008,
      side: THREE.DoubleSide
    });
    const sideMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb4b2ac,
      metalness: 0.8,
      roughness: 0.72,
      clearcoat: 0.06,
      clearcoatRoughness: 0.9,
      map: titaniumTexture,
      roughnessMap: titaniumTexture,
      bumpMap: titaniumBump,
      bumpScale: 0.018,
      emissive: 0x171715,
      emissiveIntensity: 0.006,
      side: THREE.DoubleSide
    });

    applyTitaniumShader(frontMaterial, 0.085);
    applyTitaniumShader(sideMaterial, 0.065);

    data.paths.forEach(function(path) {
      const shapes = THREE.SVGLoader.createShapes(path);

      shapes.forEach(function(shape) {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 46,
          bevelEnabled: true,
          bevelThickness: 0.7,
          bevelSize: 0.55,
          bevelSegments: 1,
          curveSegments: 36
        });
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, [frontMaterial, sideMaterial]);
        rawLogo.add(mesh);
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

  function applyTitaniumShader(material, intensity) {
    material.onBeforeCompile = function(shader) {
      shader.vertexShader = `
        varying vec3 vTitaniumPosition;
      ` + shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
          #include <begin_vertex>
          vTitaniumPosition = position;
        `
      );

      shader.fragmentShader = `
        varying vec3 vTitaniumPosition;
      ` + shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
          #include <color_fragment>
          float brushedA = sin(vTitaniumPosition.y * 0.034 + vTitaniumPosition.x * 0.004);
          float brushedB = sin(vTitaniumPosition.y * 0.091 + vTitaniumPosition.x * 0.013);
          float fineNoise = fract(sin(dot(vTitaniumPosition.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          float titaniumGrain = 1.0 + (${intensity.toFixed(3)} * brushedA) + (${(intensity * 0.52).toFixed(3)} * brushedB) + (${(intensity * 0.42).toFixed(3)} * fineNoise);
          diffuseColor.rgb *= clamp(titaniumGrain, 0.78, 1.18);
        `
      );
    };
    material.needsUpdate = true;
  }

  function createTitaniumTexture(seed) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    const image = context.createImageData(canvas.width, canvas.height);
    let randomState = seed * 9973;

    function seededRandom() {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    }

    for (let y = 0; y < canvas.height; y++) {
      const rowGrain = (seededRandom() - 0.5) * 18;
      const longGrain = Math.sin(y * 0.035) * 13;
      const fineGrain = Math.sin(y * 0.42) * 5;

      for (let x = 0; x < canvas.width; x++) {
        const random = (seededRandom() - 0.5) * 10;
        const diagonal = Math.sin((x * 0.55 + y * 0.18) * 0.08) * 7;
        const brushedLine = Math.sin(y * 2.4 + x * 0.012) * 4;
        const scratch = seededRandom() > 0.994 ? 26 : 0;
        const value = Math.max(0, Math.min(255, 184 + rowGrain + longGrain + fineGrain + diagonal + brushedLine + random + scratch));
        const index = (y * canvas.width + x) * 4;
        image.data[index] = value + 12;
        image.data[index + 1] = value + 10;
        image.data[index + 2] = value + 6;
        image.data[index + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.45, 3.8);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy
      ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
      : 1;
    texture.needsUpdate = true;
    return texture;
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
    const halfTurnSweep = Math.PI / 2;
    const logoOscillation = Math.sin(time * 0.28) * halfTurnSweep;
    const pointerTilt = pointer.x * 0.055;

    coreGroup.position.y = Math.sin(time * 1.05) * 0.13;
    coreGroup.rotation.y = Math.max(-halfTurnSweep, Math.min(halfTurnSweep, logoOscillation + pointerTilt));
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
