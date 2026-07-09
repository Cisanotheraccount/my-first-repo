// 2D Static Composition Sketch - using p5.js instance mode
var sketch1 = function(p) {
  // All variables are scoped to this instance
  var canvasWidth = 800;
  var canvasHeight = 420;
  var gridSpacing = 40;

  p.setup = function() {
    var canvas = p.createCanvas(canvasWidth, canvasHeight);
    canvas.parent('canvas-container-1');
    p.noLoop();
  };

  p.draw = function() {
    p.background(247, 246, 242);
    drawGrid();
    drawComposition();
  };

  function drawGrid() {
    p.stroke(225, 224, 219);
    p.strokeWeight(1);

    for (var x = 0; x <= p.width; x += gridSpacing) {
      p.line(x, 0, x, p.height);
    }

    for (var y = 0; y <= p.height; y += gridSpacing) {
      p.line(0, y, p.width, y);
    }
  }

  function drawComposition() {
    p.noStroke();

    // Large quiet field
    p.fill(255, 255, 255, 230);
    p.rect(82, 70, 350, 250, 28);

    // Soft color mass
    p.fill(210, 225, 255, 210);
    p.ellipse(310, 190, 240, 240);

    // Warm counter-shape
    p.fill(255, 216, 180, 220);
    p.rect(440, 118, 180, 180, 24);

    // Directional triangle
    p.fill(245, 112, 94, 225);
    p.triangle(555, 76, 705, 210, 540, 308);

    // A darker anchor shape
    p.fill(26, 29, 34, 235);
    p.rect(150, 245, 170, 46, 23);

    // Thin structural lines
    p.stroke(34, 37, 43);
    p.strokeWeight(3);
    p.line(142, 110, 646, 322);
    p.line(502, 72, 650, 72);

    // Small repeated ellipses
    p.noStroke();
    for (var i = 0; i < 7; i++) {
      var dotX = 512 + i * 24;
      var dotY = 333 + p.sin(i * 0.85) * 16;
      p.fill(73, 116, 255, 160 + i * 10);
      p.ellipse(dotX, dotY, 15, 15);
    }

    // Foreground frame
    p.noFill();
    p.stroke(255, 255, 255, 210);
    p.strokeWeight(12);
    p.rect(36, 36, p.width - 72, p.height - 72, 30);
  }
};

// Create the instance
var myp5_1 = new p5(sketch1, 'canvas-container-1');
