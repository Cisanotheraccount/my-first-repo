// Animated Interactive Field Sketch - using p5.js instance mode
var sketch2 = function(p) {
  // All variables are scoped to this instance
  var canvasWidth = 800;
  var canvasHeight = 420;
  var orbs = [];
  var running = true;

  p.setup = function() {
    var canvas = p.createCanvas(canvasWidth, canvasHeight);
    canvas.parent('canvas-container-2');

    for (var i = 0; i < 32; i++) {
      orbs.push(new Orb(i));
    }
  };

  p.draw = function() {
    p.background(248, 248, 246);
    drawHorizon();
    drawOrbs();
    drawPointer();
  };

  p.mousePressed = function() {
    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      running = !running;
    }
  };

  function drawHorizon() {
    p.stroke(221, 221, 216);
    p.strokeWeight(1);

    for (var y = 70; y < p.height; y += 50) {
      p.line(55, y, p.width - 55, y);
    }

    p.noStroke();
    p.fill(26, 29, 34);
    p.rect(58, 58, 112, 34, 17);
    p.fill(255);
    p.textSize(13);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(running ? 'motion on' : 'paused', 114, 75);
  }

  function drawOrbs() {
    for (var i = 0; i < orbs.length; i++) {
      if (running) {
        orbs[i].move();
      }
      orbs[i].display();
    }
  }

  function drawPointer() {
    var targetX = p.constrain(p.mouseX, 0, p.width);
    var targetY = p.constrain(p.mouseY, 0, p.height);

    if (targetX > 0 && targetX < p.width && targetY > 0 && targetY < p.height) {
      p.noFill();
      p.stroke(245, 112, 94, 180);
      p.strokeWeight(2);
      p.ellipse(targetX, targetY, 54, 54);
    }
  }

  class Orb {
    constructor(index) {
      this.index = index;
      this.baseX = 82 + (index % 8) * 92;
      this.baseY = 135 + Math.floor(index / 8) * 62;
      this.size = 22 + (index % 5) * 8;
      this.phase = index * 0.48;
      this.speed = 0.012 + (index % 4) * 0.004;
    }

    move() {
      this.phase += this.speed;
    }

    display() {
      var mouseInfluenceX = p.map(p.mouseX, 0, p.width, -24, 24, true);
      var mouseInfluenceY = p.map(p.mouseY, 0, p.height, -18, 18, true);
      var waveX = p.sin(p.frameCount * 0.018 + this.phase) * 28;
      var waveY = p.cos(p.frameCount * 0.014 + this.phase) * 22;
      var x = this.baseX + waveX + mouseInfluenceX * p.sin(this.phase);
      var y = this.baseY + waveY + mouseInfluenceY * p.cos(this.phase);

      p.noStroke();
      p.fill(73, 116, 255, 46);
      p.ellipse(x + 8, y + 10, this.size * 2.2, this.size * 1.35);

      p.fill(255, 216, 180, 135);
      p.ellipse(x, y, this.size * 1.45, this.size * 1.45);

      p.fill(245, 112, 94, 150);
      p.ellipse(x - this.size * 0.16, y - this.size * 0.16, this.size * 0.62, this.size * 0.62);

      if (this.index % 4 === 0) {
        p.stroke(26, 29, 34, 115);
        p.strokeWeight(1.5);
        p.line(x - this.size, y + this.size, x + this.size, y - this.size);
      }
    }
  }
};

// Create the instance
var myp5_2 = new p5(sketch2, 'canvas-container-2');
