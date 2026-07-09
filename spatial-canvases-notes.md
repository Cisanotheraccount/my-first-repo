# Spatial Canvases Notes

## Assignment Focus

This set of pages completes Assignment 3: Spatial Canvases through a p5.js 2D page and a Three.js 3D page.

The website includes:

- one static 2D drawing made with primitive p5.js shapes
- one animated and interactive 2D drawing
- three Three.js 3D canvases using primitive geometry, lighting, camera setup, animation, and OrbitControls
- a short written description connecting the work to my design interests
- separate canvas containers for each sketch

## P5.js Tutorial Structure Followed

The p5.js HTML page follows the course tutorial structure:

- load p5.js in the head with the CDN script
- create a container div for each canvas
- load the sketch JavaScript files before the closing body tag
- use p5.js instance mode so each canvas has scoped variables and functions
- attach each canvas to its own container with `canvas.parent()`

## Three.js Tutorial Structure Followed

The Three.js HTML page follows the course tutorial structure:

- load Three.js in the head with the CDN script
- load OrbitControls for interactive camera movement
- create a container div for each WebGL canvas
- load the Three.js sketch files before the closing body tag
- create a scene, camera, renderer, lights, and primitive meshes in each sketch
- use an animation loop with `requestAnimationFrame()`

## Aesthetic Direction

The visual direction is soft computational composition: calm negative space, quiet color, primitive geometry, and controlled motion.

The p5.js static sketch studies balance and depth through rectangles, ellipses, lines, triangles, and a visible grid. The p5.js interactive sketch turns similar geometric language into a moving field that responds to mouse position and click state.

The Three.js sketches translate that same direction into depth: a rotating primitive composition, an orbit-controlled group of 3D primitives, and a fog-based atmospheric geometry study.
