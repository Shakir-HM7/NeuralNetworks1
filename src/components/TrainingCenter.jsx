import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================
// CONSTANTS
// ============================================================
const TRACK_WIDTH = 12;
const MAX_SPEED = 200;
const DT = 1 / 60;
const TRAIL_LENGTH = 250;

// ============================================================
// TRACK DEFINITION — F1-inspired circuit with varied corner types
// ============================================================
const CONTROL_POINTS = [
  { x: 200, y: 520 }, { x: 350, y: 520 }, { x: 500, y: 520 },
  { x: 620, y: 520 },
  // Turn 1 — medium-speed right
  { x: 700, y: 500 }, { x: 740, y: 450 }, { x: 730, y: 380 },
  // Short straight
  { x: 700, y: 310 }, { x: 680, y: 260 },
  // Chicane
  { x: 630, y: 220 }, { x: 570, y: 200 }, { x: 530, y: 170 }, { x: 540, y: 120 },
  // Back straight (long)
  { x: 500, y: 80 }, { x: 400, y: 60 }, { x: 280, y: 55 },
  // Fast sweeping left
  { x: 180, y: 70 }, { x: 110, y: 120 }, { x: 80, y: 200 },
  // Hairpin right
  { x: 70, y: 290 }, { x: 50, y: 360 }, { x: 70, y: 410 }, { x: 120, y: 440 },
  // Return to start
  { x: 160, y: 480 }, { x: 170, y: 510 },
];

function catmullRom(points, segs) {
  const r = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let j = 0; j < segs; j++) {
      const t = j / segs;
      const t2 = t * t;
      const t3 = t2 * t;
      r.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return r;
}

const TRACK_POINTS = catmullRom(CONTROL_POINTS, 20);
const TRACK_LENGTH_PX = (() => {
  let len = 0;
  for (let i = 1; i < TRACK_POINTS.length; i++) {
    const dx = TRACK_POINTS[i].x - TRACK_POINTS[i - 1].x;
    const dy = TRACK_POINTS[i].y - TRACK_POINTS[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
})();

function getTrackState(progress) {
  const p = ((progress % 1) + 1) % 1;
  const total = TRACK_POINTS.length;
  const idx = p * total;
  const i0 = Math.floor(idx) % total;
  const i1 = (i0 + 1) % total;
  const frac = idx - Math.floor(idx);
  const pos = {
    x: TRACK_POINTS[i0].x + (TRACK_POINTS[i1].x - TRACK_POINTS[i0].x) * frac,
    y: TRACK_POINTS[i0].y + (TRACK_POINTS[i1].y - TRACK_POINTS[i0].y) * frac,
  };
  const iPrev = (i0 - 1 + total) % total;
  const iNext = (i1 + 1) % total;
  const tx = TRACK_POINTS[iNext].x - TRACK_POINTS[iPrev].x;
  const ty = TRACK_POINTS[iNext].y - TRACK_POINTS[iPrev].y;
  const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
  return {
    pos,
    tangent: { x: tx / tLen, y: ty / tLen },
    normal: { x: -ty / tLen, y: tx / tLen },
  };
}

function getCurvature(progress) {
  const s1 = getTrackState(progress - 0.005);
  const s2 = getTrackState(progress + 0.005);
  let a = Math.atan2(s2.tangent.y, s2.tangent.x) - Math.atan2(s1.tangent.y, s1.tangent.x);
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a / 0.01;
}

// ============================================================
// SIMULATION STEP — deterministic, epoch-aware
// ============================================================
function simulationStep(state) {
  const epoch = state.epoch;
  // Quality: epoch 0 = best (1.0), epoch 1000 = worst (0.0)
  var quality = Math.max(0, Math.min(1, 1.0 - epoch / 1000));
  var pQ = 0.05 + quality * 0.95;
  var nL = 0.85 * (1 - quality);

  let { progress, speed, cte, steerAngle, reward, collisions, lapCount } = state;
  const curvature = getCurvature(progress);

  const distLeft = (TRACK_WIDTH / 2) - cte;
  const distRight = (TRACK_WIDTH / 2) + cte;

  const optimalSteer = -cte * 0.15 - curvature * 0.4 * pQ;
  const absK = Math.abs(curvature);
  const optimalSpeed = MAX_SPEED * Math.max(0.40, 1.0 - absK * 0.28) * (0.65 + 0.35 * pQ);

  // Deterministic noise (no Math.random)
  const phi = state.frame * 0.037 + progress * 137.5;
  const n1 = Math.sin(phi) * Math.cos(phi * 2.3);
  const n2 = Math.cos(phi * 1.7) * Math.sin(phi * 0.9);

  const targetSteer = optimalSteer * pQ + n1 * nL * 2.0;
  const targetSpeed = optimalSpeed + n2 * nL * MAX_SPEED * 0.3;

  // Smooth steering
  steerAngle += (targetSteer - steerAngle) * Math.min(1, 3.0 * DT);
  steerAngle = Math.max(-1, Math.min(1, steerAngle));

  let accelInput = 0;
  let brakeInput = 0;
  if (speed < targetSpeed) { accelInput = Math.min(1, (targetSpeed - speed) / 25); }
  else { brakeInput = Math.min(1, (speed - targetSpeed) / 25); }

  speed += (accelInput * 110 - brakeInput * 140) * DT;
  speed = Math.max(22, Math.min(speed, MAX_SPEED));

  progress = (progress + (speed * DT) / TRACK_LENGTH_PX) % 1.0;
  cte += steerAngle * speed * 0.003 * DT * 60;

  if (progress < 0.01 && state.progress > 0.95) { lapCount += 1; }

  let collided = false;
  if (Math.abs(cte) >= TRACK_WIDTH / 2) {
    collided = true;
    cte = Math.sign(cte) * (TRACK_WIDTH / 2 - 0.5);
    speed *= 0.4;
    if (state.frame - state.lastCollisionFrame > 30) {
      collisions += 1;
      reward -= 25;
      state.lastCollisionFrame = state.frame;
    }
  }

  reward += speed * DT * (1.0 - Math.abs(cte) / (TRACK_WIDTH / 2)) * 0.1;

  const outSL = Math.max(0, steerAngle);
  const outSR = Math.max(0, -steerAngle);
  const outTh = Math.max(0, Math.min(1, accelInput));
  const outBr = Math.max(0, Math.min(1, brakeInput));

  // Compute car world position for trail
  const ts = getTrackState(progress);
  const carX = ts.pos.x + ts.normal.x * cte;
  const carY = ts.pos.y + ts.normal.y * cte;

  // Trail buffer (mutate in place for perf)
  const trail = state.trail;
  trail.push({ x: carX, y: carY });
  if (trail.length > TRAIL_LENGTH) trail.shift();

  return {
    ...state,
    progress, speed, cte, steerAngle, reward, collisions, lapCount,
    curvature, collided, frame: state.frame + 1,
    inputs: [distLeft, distRight, speed, curvature],
    outputs: [outSL, outSR, outTh, outBr],
    carX, carY,
    trackTangent: ts.tangent, trackNormal: ts.normal,
    trail,
  };
}

// ============================================================
// TRACK CANVAS — 2D rendering with zoom, follow, trails
// ============================================================
function TrackCanvas({ simState, zoom, followCar }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const state = simState.current;
    const z = zoom.current;

    // Base scale to fit 820x600 track area
    const baseScale = Math.min(w / 820, h / 600);
    const totalScale = baseScale * z;

    ctx.save();

    if (followCar.current && state.carX !== undefined) {
      // Follow-car: center viewport on vehicle
      ctx.translate(w / 2, h / 2);
      ctx.scale(totalScale, totalScale);
      ctx.translate(-state.carX, -state.carY);
    } else {
      // Normal: center track in canvas
      ctx.translate(w / 2, h / 2);
      ctx.scale(totalScale, totalScale);
      ctx.translate(-410, -300);
    }

    // --- Background: grass ---
    ctx.fillStyle = '#060d06';
    ctx.fillRect(-100, -100, 1020, 800);

    // --- Runoff zone (gravel) ---
    ctx.beginPath();
    TRACK_POINTS.forEach(function(p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#0f0f0f';
    ctx.lineWidth = TRACK_WIDTH * 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // --- Track surface ---
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = TRACK_WIDTH * 2;
    ctx.stroke();

    // --- Subtle grid pattern on track ---
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.5;
    for (let gx = -50; gx < 850; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, -50);
      ctx.lineTo(gx, 650);
      ctx.stroke();
    }
    for (let gy = -50; gy < 650; gy += 20) {
      ctx.beginPath();
      ctx.moveTo(-50, gy);
      ctx.lineTo(850, gy);
      ctx.stroke();
    }
    ctx.restore();

    // --- Curbs ---
    var step = 4;
    for (var ci = 0; ci < TRACK_POINTS.length; ci += step) {
      var cs = getTrackState(ci / TRACK_POINTS.length);
      var cBlock = Math.floor(ci / 8) % 2;
      // Left curb (red/white)
      ctx.fillStyle = cBlock === 0 ? '#cc2244' : '#dddddd';
      ctx.fillRect(
        cs.pos.x + cs.normal.x * TRACK_WIDTH - 2,
        cs.pos.y + cs.normal.y * TRACK_WIDTH - 2,
        4, 4
      );
      // Right curb (blue/white)
      ctx.fillStyle = cBlock === 0 ? '#2266cc' : '#dddddd';
      ctx.fillRect(
        cs.pos.x - cs.normal.x * TRACK_WIDTH - 2,
        cs.pos.y - cs.normal.y * TRACK_WIDTH - 2,
        4, 4
      );
    }

    // --- Optimal reference path (cyan dashed center line) ---
    ctx.setLineDash([6, 10]);
    ctx.strokeStyle = 'rgba(0,200,220,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    TRACK_POINTS.forEach(function(p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Start/Finish line ---
    var sfS = getTrackState(0.08);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sfS.pos.x + sfS.normal.x * TRACK_WIDTH, sfS.pos.y + sfS.normal.y * TRACK_WIDTH);
    ctx.lineTo(sfS.pos.x - sfS.normal.x * TRACK_WIDTH, sfS.pos.y - sfS.normal.y * TRACK_WIDTH);
    ctx.stroke();
    // Checkered pattern on start line
    ctx.fillStyle = '#fff';
    for (var sq = -TRACK_WIDTH; sq < TRACK_WIDTH; sq += 3) {
      if (Math.floor(sq / 3) % 2 === 0) {
        ctx.fillRect(
          sfS.pos.x + sfS.normal.x * sq - 1.5,
          sfS.pos.y + sfS.normal.y * sq - 1.5,
          3, 3
        );
      }
    }

    // --- Best trail (purple) ---
    if (state.bestTrail && state.bestTrail.length > 2) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(160,80,220,0.4)';
      ctx.lineWidth = 2;
      state.bestTrail.forEach(function(p, i) {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // --- Current trail (white, fading) ---
    var trail = state.trail;
    if (trail && trail.length > 2) {
      for (var ti = 1; ti < trail.length; ti++) {
        var alpha = (ti / trail.length) * 0.6;
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(trail[ti - 1].x, trail[ti - 1].y);
        ctx.lineTo(trail[ti].x, trail[ti].y);
        ctx.stroke();
      }
    }

    // --- Vehicle ---
    var heading = Math.atan2(state.trackTangent.y, state.trackTangent.x);
    ctx.save();
    ctx.translate(state.carX || 0, state.carY || 0);
    ctx.rotate(heading);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main body
    ctx.fillStyle = '#00dd77';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(8, -3);
    ctx.lineTo(-8, -3.5);
    ctx.lineTo(-13, -2.5);
    ctx.lineTo(-13, 2.5);
    ctx.lineTo(-8, 3.5);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#00aa55';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Nose cone
    ctx.fillStyle = '#00bb66';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(10, -1.5);
    ctx.lineTo(10, 1.5);
    ctx.closePath();
    ctx.fill();

    // Cockpit (dark oval)
    ctx.fillStyle = '#003322';
    ctx.beginPath();
    ctx.ellipse(-1, 0, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Halo
    ctx.strokeStyle = '#005533';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(-1, 0, 3, -0.8, 0.8);
    ctx.stroke();

    // Front wing
    ctx.fillStyle = '#008844';
    ctx.fillRect(11, -6, 1.5, 12);
    // Front wing endplates
    ctx.fillStyle = '#006633';
    ctx.fillRect(10.5, -6.5, 2.5, 1.5);
    ctx.fillRect(10.5, 5, 2.5, 1.5);

    // Rear wing
    ctx.fillStyle = '#008844';
    ctx.fillRect(-14, -5, 1.5, 10);
    // Rear wing supports
    ctx.fillStyle = '#004422';
    ctx.fillRect(-13, -3.5, 0.8, 1);
    ctx.fillRect(-13, 2.5, 0.8, 1);

    // Front wheels (turn with steering)
    var fwAngle = state.steerAngle * 0.4;
    // Left front
    ctx.save();
    ctx.translate(7, -5.5);
    ctx.rotate(fwAngle);
    ctx.fillStyle = '#222';
    ctx.fillRect(-2, -1.2, 4, 2.4);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(-2, -1.2, 4, 2.4);
    ctx.restore();
    // Right front
    ctx.save();
    ctx.translate(7, 5.5);
    ctx.rotate(fwAngle);
    ctx.fillStyle = '#222';
    ctx.fillRect(-2, -1.2, 4, 2.4);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(-2, -1.2, 4, 2.4);
    ctx.restore();

    // Rear wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(-11, -7, 5, 2.8);
    ctx.fillRect(-11, 4.2, 5, 2.8);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(-11, -7, 5, 2.8);
    ctx.strokeRect(-11, 4.2, 5, 2.8);

    // Brake lights (glow when braking)
    if (state.outputs && state.outputs[3] > 0.1) {
      var brakeAlpha = Math.min(1, state.outputs[3] * 2);
      ctx.fillStyle = 'rgba(255,30,30,' + brakeAlpha.toFixed(2) + ')';
      ctx.fillRect(-13.5, -4, 1, 2);
      ctx.fillRect(-13.5, 2, 1, 2);
      // Brake light glow
      ctx.shadowColor = '#ff2020';
      ctx.shadowBlur = 8 * brakeAlpha;
      ctx.fillRect(-13.5, -4, 1, 2);
      ctx.fillRect(-13.5, 2, 1, 2);
      ctx.shadowBlur = 0;
    }

    // Sensor rays
    var dL = state.inputs ? state.inputs[0] : 6;
    var dR = state.inputs ? state.inputs[1] : 6;
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ff2d55';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(10, -Math.max(1, dL * 1.5));
    ctx.stroke();
    ctx.strokeStyle = '#00aaff';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(10, Math.max(1, dR * 1.5));
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore(); // car transform
    ctx.restore(); // main transform

    animRef.current = requestAnimationFrame(draw);
  }, [simState, zoom, followCar]);

  useEffect(function() {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    animRef.current = requestAnimationFrame(draw);
    return function() {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: '#040804' }}
    />
  );
}

// ============================================================
// NEURAL NETWORK SVG — Clean scientific visualization
// ============================================================
function NeuralNetworkSVG({ inputs, outputs }) {
  var layers = [
    { name: 'INPUT', labels: ['Dist Left', 'Dist Right', 'Speed', 'Curvature'], count: 4 },
    { name: 'HIDDEN 1', labels: ['Feature 1', 'Feature 2', 'Feature 3'], count: 3 },
    { name: 'HIDDEN 2', labels: ['Decision 1', 'Decision 2', 'Decision 3'], count: 3 },
    { name: 'OUTPUT', labels: ['Steer L', 'Steer R', 'Throttle', 'Brake'], count: 4 },
  ];

  var W = 700;
  var H = 300;
  var padX = 130;
  var padY = 36;

  var nodes = [];
  var maxOut = outputs ? Math.max.apply(null, outputs.concat([0.01])) : 1;

  layers.forEach(function(layer, lIdx) {
    var x = padX + (lIdx / (layers.length - 1)) * (W - padX * 2);
    var count = layer.count;
    var spacing = (H - padY * 2) / Math.max(1, count - 1);
    var startY = count === 1 ? H / 2 : padY;

    for (var i = 0; i < count; i++) {
      var y = startY + i * spacing;
      var activation = 0;
      var value = 0;
      var dominant = false;

      if (lIdx === 0 && inputs) {
        value = inputs[i] || 0;
        if (i === 0) activation = Math.min(1, Math.max(0, value / TRACK_WIDTH));
        else if (i === 1) activation = Math.min(1, Math.max(0, value / TRACK_WIDTH));
        else if (i === 2) activation = Math.min(1, value / MAX_SPEED);
        else activation = Math.min(1, Math.abs(value) * 2);
      } else if (lIdx === layers.length - 1 && outputs) {
        value = outputs[i] || 0;
        activation = Math.min(1, Math.abs(value));
        if (value > 0.05 && Math.abs(value - maxOut) < 0.01) dominant = true;
      } else if (inputs && outputs) {
        // Hidden: deterministic blend from inputs and outputs
        var iAvg = (Math.abs(inputs[0]) + Math.abs(inputs[1])) / TRACK_WIDTH;
        var sAvg = inputs[2] / MAX_SPEED;
        var oAvg = (Math.abs(outputs[0]) + Math.abs(outputs[1]) + outputs[2] + outputs[3]) / 2;
        activation = Math.min(1, Math.max(0.05, (iAvg + sAvg + oAvg) / 3 + i * 0.08));
      }

      nodes.push({ x: x, y: y, layer: lIdx, idx: i, activation: activation, value: value, dominant: dominant, label: layer.labels[i] });
    }
  });

  var links = [];
  for (var l = 0; l < layers.length - 1; l++) {
    var src = nodes.filter(function(n) { return n.layer === l; });
    var dst = nodes.filter(function(n) { return n.layer === l + 1; });
    src.forEach(function(s) {
      dst.forEach(function(d) {
        var w = s.activation * d.activation;
        links.push({ x1: s.x, y1: s.y, x2: d.x, y2: d.y, weight: w });
      });
    });
  }

  function nodeColor(act, dom) {
    if (dom) return 'rgb(0,240,120)';
    var g = Math.floor(60 + act * 160);
    var b = Math.floor(100 + act * 155);
    return 'rgb(0,' + g + ',' + b + ')';
  }

  function formatVal(node) {
    if (node.layer === 0) {
      if (node.idx === 2) return node.value.toFixed(1) + ' km/h';
      if (node.idx === 3) return node.value.toFixed(2) + ' rad';
      return node.value.toFixed(2) + ' m';
    }
    return (Math.abs(node.value) * 100).toFixed(0) + '%';
  }

  return (
    <svg width="100%" height="100%" viewBox={'0 0 ' + W + ' ' + H} style={{ display: 'block' }}>
      <defs>
        <filter id="ng" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <style>{'@keyframes fd{from{stroke-dashoffset:18}to{stroke-dashoffset:0}}.fl{animation:fd .8s linear infinite}'}</style>

      {links.map(function(lk, i) {
        return React.createElement('line', {
          key: 'b' + i, x1: lk.x1, y1: lk.y1, x2: lk.x2, y2: lk.y2,
          stroke: 'rgba(0,180,220,0.06)', strokeWidth: 1
        });
      })}

      {links.filter(function(lk) { return lk.weight > 0.12; }).map(function(lk, i) {
        return React.createElement('line', {
          key: 'f' + i, x1: lk.x1, y1: lk.y1, x2: lk.x2, y2: lk.y2,
          stroke: 'rgba(0,180,220,0.5)', strokeWidth: Math.min(2.5, lk.weight * 3),
          strokeDasharray: '3 7', className: 'fl',
          opacity: Math.min(0.9, lk.weight * 1.5)
        });
      })}

      {nodes.map(function(n, i) {
        var r = 4 + n.activation * 5;
        var elements = [];

        elements.push(React.createElement('circle', {
          key: 'c' + i, cx: n.x, cy: n.y, r: r,
          fill: nodeColor(n.activation, n.dominant),
          filter: n.activation > 0.25 ? 'url(#ng)' : undefined,
          opacity: n.activation > 0.08 ? 0.85 : 0.25
        }));

        if (n.layer === 0) {
          elements.push(React.createElement('text', {
            key: 'tl' + i, x: n.x - 14, y: n.y - 3,
            fill: n.activation > 0.3 ? '#bbb' : '#555',
            fontSize: '9', textAnchor: 'end', fontFamily: 'monospace', fontWeight: '600'
          }, n.label));
          elements.push(React.createElement('text', {
            key: 'tv' + i, x: n.x - 14, y: n.y + 9,
            fill: '#0099bb', fontSize: '8', textAnchor: 'end', fontFamily: 'monospace'
          }, formatVal(n)));
        } else if (n.layer === layers.length - 1) {
          elements.push(React.createElement('text', {
            key: 'tl' + i, x: n.x + 14, y: n.y - 3,
            fill: n.dominant ? '#00ee88' : (n.activation > 0.08 ? '#bbb' : '#555'),
            fontSize: '9', textAnchor: 'start', fontFamily: 'monospace',
            fontWeight: n.dominant ? '800' : '600'
          }, n.label));
          elements.push(React.createElement('text', {
            key: 'tv' + i, x: n.x + 14, y: n.y + 9,
            fill: n.dominant ? '#00ee88' : '#0099bb',
            fontSize: '8', textAnchor: 'start', fontFamily: 'monospace'
          }, formatVal(n)));
        } else {
          elements.push(React.createElement('text', {
            key: 'tl' + i, x: n.x, y: n.y + r + 11,
            fill: '#555', fontSize: '7.5', textAnchor: 'middle', fontFamily: 'monospace'
          }, n.label));
        }

        return React.createElement('g', { key: 'g' + i }, elements);
      })}

      {layers.map(function(layer, i) {
        var x = padX + (i / (layers.length - 1)) * (W - padX * 2);
        return React.createElement('text', {
          key: 'h' + i, x: x, y: 14, fill: '#0099bb', fontSize: '10',
          textAnchor: 'middle', fontFamily: 'monospace', letterSpacing: '1.5', fontWeight: '700'
        }, layer.name);
      })}
    </svg>
  );
}

// ============================================================
// METRIC BOX
// ============================================================
function MetricBox(props) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.6)', padding: '14px 18px',
      borderRadius: '6px', borderLeft: '3px solid ' + (props.color || '#00aadd'),
    }}>
      <div style={{ fontSize: '0.65rem', color: '#777', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: '4px' }}>
        {props.label}
      </div>
      <div style={{ fontSize: '1.6rem', fontFamily: 'var(--font-display, monospace)', color: '#fff', lineHeight: 1 }}>
        {props.value}
        {props.unit && <span style={{ fontSize: '0.7rem', color: '#777', marginLeft: '3px' }}>{props.unit}</span>}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TrainingCenter() {
  var epochRef = useRef(1000);
  var zoomRef = useRef(1.0);
  var followRef = useRef(false);

  var initialState = {
    epoch: 1000, progress: 0.08, speed: 20, cte: 0, steerAngle: 0,
    reward: 0, collisions: 0, lapCount: 0, curvature: 0,
    collided: false, frame: 0, lastCollisionFrame: -100,
    inputs: [6, 6, 20, 0], outputs: [0, 0, 0.5, 0],
    carX: 500, carY: 520,
    trackTangent: { x: 1, y: 0 }, trackNormal: { x: 0, y: -1 },
    lastMetricUpdate: 0,
    trail: [],
    bestTrail: [],
    bestReward: -Infinity,
    lapReward: 0,
    lapTrail: [],
  };

  var simState = useRef(initialState);

  var _ep = useState(1000);
  var epoch = _ep[0]; var setEpoch = _ep[1];
  var _z = useState(100);
  var zoomDisplay = _z[0]; var setZoomDisplay = _z[1];
  var _f = useState(false);
  var followDisplay = _f[0]; var setFollowDisplay = _f[1];

  var _m = useState({
    speed: 0, cte: 0, progress: 0, reward: 0, collisions: 0,
    steerAngle: 0, curvature: 0, lapCount: 0,
    inputs: [0, 0, 0, 0], outputs: [0, 0, 0, 0],
  });
  var metrics = _m[0]; var setMetrics = _m[1];

  // Simulation loop
  useEffect(function() {
    var running = true;
    var lastTime = performance.now();

    function loop(now) {
      if (!running) return;
      if (now - lastTime >= 16) {
        lastTime = now;
        var s = simState.current;

        // Check for lap completion: store best trail
        var prevProg = s.progress;
        s = simulationStep(s);

        if (s.lapCount > (simState.current.lapCount || 0)) {
          // Lap completed - check if best
          if (s.reward > s.bestReward) {
            s.bestReward = s.reward;
            s.bestTrail = s.trail.slice();
          }
        }

        simState.current = s;

        // Throttle React updates to ~15fps
        if (now - s.lastMetricUpdate > 66) {
          s.lastMetricUpdate = now;
          setMetrics({
            speed: s.speed, cte: s.cte, progress: s.progress,
            reward: s.reward, collisions: s.collisions,
            steerAngle: s.steerAngle, curvature: s.curvature,
            lapCount: s.lapCount,
            inputs: s.inputs.slice(), outputs: s.outputs.slice(),
          });
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return function() { running = false; };
  }, []);

  // Epoch sync
  useEffect(function() {
    epochRef.current = epoch;
    simState.current.epoch = epoch;
    simState.current.collisions = 0;
    simState.current.reward = 0;
    simState.current.lapCount = 0;
    simState.current.frame = 0;
    simState.current.lastCollisionFrame = -100;
    simState.current.trail = [];
  }, [epoch]);

  // Zoom mouse wheel handler
  var canvasContainerRef = useRef(null);
  useEffect(function() {
    var el = canvasContainerRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? -0.15 : 0.15;
      var nz = Math.max(0.25, Math.min(3.0, zoomRef.current + delta));
      zoomRef.current = nz;
      setZoomDisplay(Math.round(nz * 100));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return function() { el.removeEventListener('wheel', onWheel); };
  }, []);

  function handleZoom(level) {
    zoomRef.current = level;
    setZoomDisplay(Math.round(level * 100));
  }

  function toggleFollow() {
    followRef.current = !followRef.current;
    setFollowDisplay(followRef.current);
  }

  var epochOptions = [
    { value: 1000, label: 'EPOCH 1000', desc: 'Optimal — racing line, minimal collisions, max reward' },
    { value: 500, label: 'EPOCH 500', desc: 'Converging — smoother lines, corner braking' },
    { value: 200, label: 'EPOCH 200', desc: 'Early learning — basic lane following, oscillation' },
    { value: 0, label: 'EPOCH 0', desc: 'Untrained — random exploration, frequent crashes' },
  ];

  var zoomPresets = [
    { level: 0.25, label: '25%' },
    { level: 0.5, label: '50%' },
    { level: 1.0, label: '100%' },
    { level: 2.0, label: '200%' },
    { level: 3.0, label: '300%' },
  ];

  var panelHeader = {
    padding: '12px 18px',
    borderBottom: '1px solid rgba(0,170,220,0.12)',
    fontFamily: 'var(--font-display, monospace)',
    color: '#0099bb', textTransform: 'uppercase',
    letterSpacing: '2px', fontSize: '0.8rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  };

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      padding: '100px 24px 40px 24px',
      background: 'var(--bg-primary, #0a0a0f)',
      display: 'flex', flexDirection: 'column', gap: '20px',
      position: 'relative', zIndex: 10,
    }}>

      {/* ROW 1: Track + Neural Network */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minHeight: '440px' }}>

        {/* Track */}
        <div className="glass" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={panelHeader}>
            <span>Circuit Simulation</span>
            <span style={{ fontSize: '0.65rem', color: '#00dd88', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00dd88', display: 'inline-block' }}></span>
              LIVE
            </span>
          </div>
          {/* Zoom controls overlay */}
          <div style={{ position: 'relative', flex: 1 }} ref={canvasContainerRef}>
            <TrackCanvas simState={simState} zoom={zoomRef} followCar={followRef} />
            {/* Zoom toolbar */}
            <div style={{
              position: 'absolute', top: '8px', right: '8px',
              display: 'flex', flexDirection: 'column', gap: '3px', zIndex: 2,
            }}>
              {zoomPresets.map(function(zp) {
                var active = zoomDisplay === Math.round(zp.level * 100);
                return (
                  <button key={zp.label} onClick={function() { handleZoom(zp.level); }} style={{
                    padding: '3px 8px', fontSize: '0.6rem', fontFamily: 'monospace',
                    background: active ? 'rgba(0,170,220,0.2)' : 'rgba(0,0,0,0.6)',
                    border: active ? '1px solid #0099bb' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '3px', color: active ? '#0099bb' : '#888',
                    cursor: 'pointer',
                  }}>
                    {zp.label}
                  </button>
                );
              })}
              <button onClick={toggleFollow} style={{
                padding: '3px 8px', fontSize: '0.6rem', fontFamily: 'monospace', marginTop: '4px',
                background: followDisplay ? 'rgba(0,220,130,0.15)' : 'rgba(0,0,0,0.6)',
                border: followDisplay ? '1px solid #00dd88' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '3px', color: followDisplay ? '#00dd88' : '#888',
                cursor: 'pointer',
              }}>
                FOLLOW
              </button>
            </div>
            {/* Zoom level indicator */}
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px',
              fontSize: '0.6rem', fontFamily: 'monospace', color: '#555',
            }}>
              {'ZOOM ' + zoomDisplay + '%'}
            </div>
            {/* Trail legend */}
            <div style={{
              position: 'absolute', bottom: '8px', right: '8px',
              fontSize: '0.55rem', fontFamily: 'monospace', color: '#555',
              display: 'flex', gap: '10px',
            }}>
              <span><span style={{ color: '#fff' }}>—</span> Current</span>
              <span><span style={{ color: '#a050dc' }}>—</span> Best Lap</span>
              <span><span style={{ color: '#00c8dc' }}>- -</span> Reference</span>
            </div>
          </div>
        </div>

        {/* Neural Network */}
        <div className="glass" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={panelHeader}>
            <span>Decision Network</span>
          </div>
          <div style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center' }}>
            <NeuralNetworkSVG inputs={metrics.inputs} outputs={metrics.outputs} />
          </div>
        </div>
      </div>

      {/* ROW 2: Metrics + Epoch */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '20px' }}>

        {/* Metrics */}
        <div className="glass" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <MetricBox label="SPEED" value={metrics.speed.toFixed(1)} unit="km/h" color="#00aadd" />
            <MetricBox label="CROSS TRACK ERROR" value={Math.abs(metrics.cte).toFixed(2)} unit="m" color="#ff9500" />
            <MetricBox label="COLLISIONS" value={String(metrics.collisions)} color="#ff2d55" />
            <MetricBox label="CUMULATIVE REWARD" value={metrics.reward.toFixed(0)} color="#af52de" />
            <MetricBox label="LAP PROGRESS" value={(metrics.progress * 100).toFixed(1) + '%'} color="#00aadd" />
            <MetricBox label="STEERING" value={metrics.steerAngle.toFixed(3)} color="#00dd88" />
          </div>
        </div>

        {/* Epoch Selector */}
        <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            fontFamily: 'var(--font-display, monospace)', fontSize: '0.8rem',
            color: '#0099bb', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '2px',
          }}>
            Model Checkpoint
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            {epochOptions.map(function(opt) {
              var active = epoch === opt.value;
              return (
                <button key={opt.value} onClick={function() { setEpoch(opt.value); }} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px',
                  background: active ? 'rgba(0,150,200,0.1)' : 'rgba(0,0,0,0.4)',
                  border: active ? '1px solid #0099bb' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '5px', cursor: 'pointer', transition: 'all 0.2s',
                  width: '100%', textAlign: 'left',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display, monospace)', fontSize: '0.85rem',
                    color: active ? '#0099bb' : '#ccc', minWidth: '80px',
                  }}>
                    {opt.label}
                  </span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '0.7rem', color: '#666', lineHeight: 1.3,
                  }}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
