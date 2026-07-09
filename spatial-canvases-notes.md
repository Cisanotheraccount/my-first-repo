# Spatial Canvases Notes

## Assignment Focus

This website completes Assignment 3: Spatial Canvases through a continuous homepage that includes p5.js and Three.js work on the same scrolling page.

The website includes:

- one static 2D drawing made with primitive p5.js shapes
- one animated and interactive 2D p5.js drawing
- three Three.js 3D canvases using primitive geometry, lighting, camera setup, animation, and OrbitControls
- a short written description connecting the work to my design interests
- separate canvas containers for each sketch
- an archived previous version of the site in `archive-before-redesign/`

## Visual Direction

The redesign uses an Apple-like visual language: white and soft gray space, silver material, precise typography, light glass surfaces, and calm motion.

The motion reference comes from Oryzo's website structure: one strong floating object leads the first screen, then the page scrolls into supporting content with atmosphere, blur, and staged text reveals. This site does not copy Oryzo's product, text, colors, images, or coaster model. It uses the pacing idea and adapts it to my own logo and coursework.

## 3D Logo Hero

The homepage uses my SVG logo as a silver 3D object. The logo is loaded as vector paths, converted into extruded Three.js geometry, and rendered with metallic material, bevels, soft lights, subtle orbit rings, and small particles.

The animation is intentionally controlled:

- slow rotation
- light floating motion
- small pointer-based camera feel
- soft silver highlights
- scroll-based depth blur and movement
- fixed soft edge glow around the page
- text and canvas modules revealing from blur into sharp focus

The goal is a polished object-display feeling, closer to an Apple product detail page than a game or cyberpunk scene.

## P5.js Tutorial Structure Followed

The p5.js section follows the course tutorial structure:

- load p5.js with the CDN script
- create a container div for each canvas
- load the sketch JavaScript files before the closing body tag
- use p5.js instance mode so each canvas has scoped variables and functions
- attach each canvas to its own container with `canvas.parent()`

## Three.js Tutorial Structure Followed

The Three.js section follows the course tutorial structure:

- load Three.js with the CDN script
- load OrbitControls for interactive camera movement
- create a container div for each WebGL canvas
- load the Three.js sketch files before the closing body tag
- create a scene, camera, renderer, lights, and primitive meshes in each sketch
- use an animation loop with `requestAnimationFrame()`

## Design Interest

My design interest here is soft computational composition: clean space, quiet color, primitive geometry, and controlled motion.

The p5.js static sketch studies balance and depth through rectangles, ellipses, lines, triangles, and a visible grid. The p5.js interactive sketch turns similar geometric language into a moving field that responds to mouse position and click state.

The Three.js sketches translate that same direction into depth: a rotating primitive composition, an orbit-controlled group of 3D primitives, and a fog-based atmospheric geometry study.

## AI Assisted Coding Process

AI-assisted coding was used to plan the redesign, structure the homepage, convert the logo into a Three.js hero object, and refine the visual system. The process kept the assignment requirements visible while improving the overall composition, typography, and motion language.
