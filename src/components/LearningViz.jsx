import { useState, useEffect, useRef, useCallback } from 'react'
import { initSimulation, simulationStep, TRACK_POINTS, TRACK_WIDTH, MAX_SENSOR_RANGE } from '../utils/sensorPhysics'

let cachedTrackCanvas = null;
const drawCachedTrack = (ctx) => {
  if (!cachedTrackCanvas) {
    cachedTrackCanvas = document.createElement('canvas');
    cachedTrackCanvas.width = 1020;
    cachedTrackCanvas.height = 800;
    const offCtx = cachedTrackCanvas.getContext('2d');
    
    offCtx.translate(100, 100);
    // Transparent background - blends seamlessly with page
    offCtx.clearRect(-100, -100, 1020, 800);
    
    // Guard rails
    offCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    offCtx.lineWidth = TRACK_WIDTH * 2 + 10;
    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';
    offCtx.beginPath();
    TRACK_POINTS.forEach((p, i) => { if(i === 0) offCtx.moveTo(p.x, p.y); else offCtx.lineTo(p.x, p.y); });
    offCtx.closePath();
    offCtx.stroke();

    // Red-white curbs
    offCtx.strokeStyle = '#ff2d55';
    offCtx.lineWidth = TRACK_WIDTH * 2 + 4;
    offCtx.setLineDash([10, 10]);
    offCtx.stroke();
    offCtx.strokeStyle = '#ffffff';
    offCtx.lineDashOffset = 10;
    offCtx.stroke();
    offCtx.setLineDash([]);
    offCtx.lineDashOffset = 0;

    // Track asphalt
    offCtx.strokeStyle = '#18181c';
    offCtx.lineWidth = TRACK_WIDTH * 2;
    offCtx.stroke();
    
    // Racing line (Center dashed)
    offCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    offCtx.lineWidth = 2;
    offCtx.setLineDash([12, 12]);
    offCtx.stroke();
    offCtx.setLineDash([]);
  }
  ctx.drawImage(cachedTrackCanvas, -100, -100);
};

// Recognizable top-down Formula 1 silhouette
const drawF1Car = (ctx, car, isSelected, isBest, currentZoom) => {
  ctx.save();
  ctx.translate(car.carX, car.carY);
  ctx.rotate(car.heading);

  const isCrashed = car.status === 'CRASHED' || car.crashed;
  const isFailed = car.status === 'FAILED';
  const isCompleted = car.completed || car.status === 'COMPLETED';

  // Livery color palette
  let bodyColor = 'rgba(140, 160, 185, 0.45)';
  let accentColor = 'rgba(200, 220, 240, 0.7)';
  
  if (isCrashed) {
    bodyColor = '#ff2d55';
    accentColor = '#ff6b8b';
  } else if (isFailed) {
    bodyColor = '#ff9500';
    accentColor = '#ffcc00';
  } else if (isCompleted) {
    bodyColor = '#00ff88';
    accentColor = '#70ffb0';
  } else if (isBest) {
    bodyColor = '#00d4ff';
    accentColor = '#ffffff';
  } else if (isSelected) {
    bodyColor = '#b388ff';
    accentColor = '#ffffff';
  }

  // 1. Suspension Arms / Wishbones (carbon fiber dark rods)
  ctx.strokeStyle = '#2a2a30';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  // Front wishbones
  ctx.moveTo(3, 0); ctx.lineTo(6.5, -5.5);
  ctx.moveTo(3, 0); ctx.lineTo(6.5, 5.5);
  // Rear wishbones
  ctx.moveTo(-5, 0); ctx.lineTo(-8.5, -6.5);
  ctx.moveTo(-5, 0); ctx.lineTo(-8.5, 6.5);
  ctx.stroke();

  // 2. Open Wheels / Tires (4 tires: 2 front, 2 rear)
  ctx.fillStyle = '#141416';
  ctx.strokeStyle = (isBest || isSelected) ? accentColor : '#252528';
  ctx.lineWidth = 0.8;

  // Front Left & Right (slightly angled by steer angle)
  const steerRot = (car.steerAngle || 0) * 0.2;
  
  // Front Left Tire
  ctx.save();
  ctx.translate(6.5, -5.8);
  ctx.rotate(steerRot);
  ctx.fillRect(-2.5, -1.3, 5, 2.6);
  ctx.strokeRect(-2.5, -1.3, 5, 2.6);
  ctx.restore();

  // Front Right Tire
  ctx.save();
  ctx.translate(6.5, 5.8);
  ctx.rotate(steerRot);
  ctx.fillRect(-2.5, -1.3, 5, 2.6);
  ctx.strokeRect(-2.5, -1.3, 5, 2.6);
  ctx.restore();

  // Rear Tires (wider racing rubber)
  ctx.fillRect(-10.5, -7.5, 5.5, 3.2);
  ctx.strokeRect(-10.5, -7.5, 5.5, 3.2);
  ctx.fillRect(-10.5, 4.3, 5.5, 3.2);
  ctx.strokeRect(-10.5, 4.3, 5.5, 3.2);

  // 3. Rear Wing (main flap + side endplates)
  ctx.fillStyle = accentColor;
  ctx.fillRect(-11.5, -7.2, 2.2, 14.4); // Main horizontal plane
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-12.5, -7.5, 3.5, 1.2); // Left endplate
  ctx.fillRect(-12.5, 6.3, 3.5, 1.2);  // Right endplate

  // 4. Front Wing (aerodynamic nose element)
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(10, -7);
  ctx.lineTo(12, -7);
  ctx.lineTo(11, 7);
  ctx.lineTo(9, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.fillRect(8.5, -7.2, 3.5, 1.1);
  ctx.fillRect(8.5, 6.1, 3.5, 1.1);

  // 5. Main Monocoque Chassis & Sidepods (aerodynamic contoured silhouette)
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(11.5, 0);       // Nose tip
  ctx.lineTo(4, -1.6);       // Nosecone
  ctx.lineTo(2, -4.2);       // Left sidepod air intake
  ctx.lineTo(-6, -4.2);      // Left sidepod undercut
  ctx.lineTo(-9, -2.5);      // Engine cover coke-bottle taper
  ctx.lineTo(-9, 2.5);       // Engine cover coke-bottle taper
  ctx.lineTo(-6, 4.2);       // Right sidepod undercut
  ctx.lineTo(2, 4.2);        // Right sidepod air intake
  ctx.lineTo(4, 1.6);        // Nosecone
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // 6. Cockpit, Halo & Driver Helmet
  // Cockpit cockpit opening
  ctx.fillStyle = '#08080a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Driver Helmet
  ctx.fillStyle = isBest ? '#ffd600' : isSelected ? '#00d4ff' : '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Halo safety ring
  ctx.strokeStyle = '#1a1a1f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0.4, 0, 2.0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Crash smoke effect
  if (isCrashed) {
    const t = Date.now() * 0.005;
    ctx.fillStyle = `rgba(255, 60, 60, ${Math.max(0, 0.5 - (t % 1))})`;
    ctx.beginPath();
    ctx.arc(-8 - (t * 4 % 8), Math.sin(t * 3) * 3, 2 + (t * 2 % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

function SensorCanvas({ simState, selectedCarId, viewMode, zoom, pan }) {
  const canvasRef = useRef(null);
  const camRef = useRef({ x: 410, y: 295, zoom: 1 });
  
  // Keep live references to avoid stale closure in requestAnimationFrame loop
  const liveProps = useRef({ simState, selectedCarId, viewMode, zoom, pan });
  liveProps.current = { simState, selectedCarId, viewMode, zoom, pan };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let animId;
    const render = () => {
      const { simState, selectedCarId, viewMode, zoom, pan } = liveProps.current;
      const state = simState.current;
      if (!state) {
        animId = requestAnimationFrame(render);
        return;
      }
      
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      const w = canvas.width;
      const h = canvas.height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      // Determine follow target
      let followCar = null;
      if (viewMode === 'FOLLOW_SELECTED' && selectedCarId !== null) {
        followCar = state.cars.find(c => c.id === selectedCarId);
      }
      if (!followCar) {
        // FOLLOW_BEST: follow current best active agent, or overall best if none active
        followCar = state.cars.find(c => c.id === state.bestCarId && c.status === 'ACTIVE')
          || state.cars.find(c => c.status === 'ACTIVE')
          || state.cars.find(c => c.id === state.bestCarId)
          || state.cars[0];
      }

      // Camera target calculation for each mode
      let targetX, targetY, targetZ;
      if (viewMode === 'OVERVIEW') {
        targetX = 410;
        targetY = 295;
        // Base overview fits the full track; zoom multiplier scales it
        const baseOverviewZoom = Math.min(w / 880, h / 620);
        targetZ = baseOverviewZoom * zoom;
      } else if (viewMode === 'FREE') {
        targetX = 410 - pan.x;
        targetY = 295 - pan.y;
        targetZ = zoom;
      } else {
        // FOLLOW_BEST or FOLLOW_SELECTED
        targetX = followCar ? followCar.carX : 410;
        targetY = followCar ? followCar.carY : 295;
        // Follow zoom smoothly scales with zoom buttons: 1.8x base * zoom
        targetZ = 1.8 * zoom;
      }

      // Smooth camera interpolation
      camRef.current.x += (targetX - camRef.current.x) * 0.12;
      camRef.current.y += (targetY - camRef.current.y) * 0.12;
      camRef.current.zoom += (targetZ - camRef.current.zoom) * 0.12;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(camRef.current.zoom, camRef.current.zoom);
      ctx.translate(-camRef.current.x, -camRef.current.y);

      // Render track (fully transparent background)
      drawCachedTrack(ctx);

      const targetFollowId = followCar ? followCar.id : state.bestCarId;

      // Draw trails
      state.cars.forEach(car => {
        const isFollowedCar = (car.id === targetFollowId) || (car.id === selectedCarId);
        if (isFollowedCar && car.trail && car.trail.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(car.trail[0].x, car.trail[0].y);
          for (let j = 1; j < car.trail.length; j++) {
            ctx.lineTo(car.trail[j].x, car.trail[j].y);
          }
          ctx.strokeStyle = car.id === state.bestCarId ? 'rgba(0, 212, 255, 0.6)' : 'rgba(179, 136, 255, 0.6)';
          ctx.lineWidth = Math.max(1.5, 2.5 / camRef.current.zoom);
          ctx.stroke();
          ctx.restore();
        }
      });

      // Draw all cars as F1 silhouettes
      state.cars.forEach(car => {
        const isSelected = (car.id === selectedCarId);
        const isBest = (car.id === state.bestCarId);
        drawF1Car(ctx, car, isSelected, isBest, camRef.current.zoom);
      });

      // Draw vivid Sensor Rays for the followed or inspected active car
      const inspectedCar = (selectedCarId !== null) 
        ? state.cars.find(c => c.id === selectedCarId) 
        : followCar;

      if (inspectedCar && inspectedCar.status === 'ACTIVE' && inspectedCar.sensors) {
        ctx.save();
        ctx.translate(inspectedCar.carX, inspectedCar.carY);
        ctx.rotate(inspectedCar.heading);

        const angles = [0, -Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2];
        const t = Date.now() * 0.006;
        const currentCamZoom = camRef.current.zoom;

        angles.forEach((a, i) => {
          const dist = inspectedCar.sensors[i];
          const normDist = Math.max(0, Math.min(1, dist / MAX_SENSOR_RANGE));

          // Strict color-coding: Green = safe (> 0.6), Yellow = caution (0.25 - 0.6), Red = danger (< 0.25)
          let strokeColor, fillColor;
          if (normDist > 0.6) {
            strokeColor = 'rgba(0, 255, 136, 0.9)';
            fillColor = '#00ff88';
          } else if (normDist >= 0.25) {
            strokeColor = 'rgba(255, 214, 0, 0.95)';
            fillColor = '#ffd600';
          } else {
            strokeColor = 'rgba(255, 45, 85, 0.95)';
            fillColor = '#ff2d55';
          }

          const endX = Math.cos(a) * dist;
          const endY = Math.sin(a) * dist;

          // Adaptive ray thickness for crisp visibility at any zoom level
          const rayThickness = Math.max(1.8, 3.0 / currentCamZoom);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = rayThickness;
          ctx.stroke();

          // Sensor contact point
          const dotRadius = Math.max(2.8, 4.2 / currentCamZoom);
          ctx.beginPath();
          ctx.arc(endX, endY, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = fillColor;
          ctx.fill();

          // Pulsing safety ring at contact point
          const pulse = (Math.sin(t * 3 - i) + 1) * 0.5;
          ctx.beginPath();
          ctx.arc(endX, endY, dotRadius * (1.2 + pulse * 0.8), 0, Math.PI * 2);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(0.8, 1.5 / currentCamZoom);
          ctx.stroke();

          // Sensor distance readout if zoomed in for inspection
          if (currentCamZoom >= 2.5) {
            ctx.fillStyle = fillColor;
            ctx.font = `${Math.round(Math.max(8, 11 / currentCamZoom))}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(dist)}px`, endX + Math.cos(a) * 8, endY + Math.sin(a) * 8);
          }
        });

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', background: 'transparent', borderRadius: 8, display: 'block' }} />;
}

function NetworkCanvas({ simState, selectedCarId }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const state = simState.current;
    if (!state) return;
    const targetId = selectedCarId !== null ? selectedCarId : state.bestCarId;
    const car = state.cars.find(c => c.id === targetId);
    if (!car) return;

    const { lastInputs, lastHidden, lastOutputs, network } = car;
    const weights = network.weights;
    
    const layerNames = {
      0: ['Front Sensor', 'Front Left', 'Front Right', 'Left Sensor', 'Right Sensor', 'Speed', 'Curvature'],
      1: ['Feature Extraction', 'Boundary Awareness', 'Path Planning', 'Speed Control'],
      2: ['Steer Left', 'Steer Right', 'Throttle', 'Brake']
    };

    const layers = [
      { size: 7, acts: lastInputs || [0,0,0,0,0,0,0], x: w * 0.18, label: 'INPUTS' },
      { size: 4, acts: lastHidden || [0,0,0,0], x: w * 0.52, label: 'HIDDEN' },
      { size: 4, acts: lastOutputs || [0,0,0,0], x: w * 0.85, label: 'OUTPUTS' }
    ];

    const t = Date.now() * 0.005;
    let wIdx = 0;
    
    // Draw real connection lines using weights
    for (let l = 1; l < layers.length; l++) {
      const prev = layers[l-1];
      const curr = layers[l];
      
      for (let i = 0; i < curr.size; i++) {
        wIdx++; // skip bias
        const currY = (h / (curr.size + 1)) * (i + 1);
        
        for (let j = 0; j < prev.size; j++) {
          const weight = weights[wIdx++];
          const prevY = (h / (prev.size + 1)) * (j + 1);
          
          const signal = prev.acts[j] * weight;
          const absSignal = Math.abs(signal);
          
          if (absSignal > 0.03) {
            const alpha = Math.min(1, absSignal * 0.9);
            ctx.beginPath();
            ctx.moveTo(prev.x, prevY);
            ctx.lineTo(curr.x, currY);
            
            const pulse = Math.sin(t - (j * 0.3) - (i * 0.2)) * 0.5 + 0.5;
            
            ctx.strokeStyle = weight > 0 
              ? `rgba(0, 212, 255, ${alpha * (0.2 + pulse * 0.8)})` 
              : `rgba(255, 45, 85, ${alpha * (0.2 + pulse * 0.8)})`;
            ctx.lineWidth = 1 + alpha * 1.6;
            ctx.stroke();
          }
        }
      }
    }
    
    // Draw Nodes with real activations and exact labels
    layers.forEach((layer, lIdx) => {
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(layer.label, layer.x, 15);
      
      for (let i = 0; i < layer.size; i++) {
        const y = (h / (layer.size + 1)) * (i + 1);
        const act = layer.acts[i] || 0;
        const mag = Math.min(1, Math.abs(act));
        
        ctx.beginPath();
        ctx.arc(layer.x, y, 6.5, 0, Math.PI * 2);
        
        if (mag > 0.05) {
          // Output 2 is Throttle (green), Output 3 is Brake (red), steering is cyan/orange
          let activeColor = '#00d4ff';
          if (lIdx === 2) {
            if (i === 2) activeColor = '#00ff88'; // Throttle green
            else if (i === 3) activeColor = '#ff2d55'; // Brake red
            else activeColor = '#00d4ff'; // Steering cyan
          } else {
            activeColor = act >= 0 ? '#00d4ff' : '#ff9500';
          }
          
          ctx.fillStyle = activeColor;
          ctx.fill();
          ctx.shadowColor = activeColor;
          ctx.shadowBlur = 8 * mag;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        
        // Node labels
        ctx.font = '8px monospace';
        const name = layerNames[lIdx]?.[i];
        if (name) {
          if (lIdx === 0) {
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.fillText(name, layer.x - 12, y + 3);
          } else if (lIdx === 1) {
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(name, layer.x, y - 9);
            // Numeric activation
            ctx.fillStyle = act >= 0 ? '#00d4ff' : '#ff9500';
            ctx.fillText(act.toFixed(2), layer.x, y + 15);
          } else {
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(name, layer.x + 12, y + 3);
          }
        }
      }
    });
  }, [simState, selectedCarId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    let animId;
    const loop = () => {
      draw();
      animId = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(animId);
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '300px', background: 'transparent' }} />
}

export default function LearningViz() {
  const simState = useRef(initSimulation(10));
  
  const [bestCarState, setBestCarState] = useState({
    sensors: [0,0,0,0,0],
    status: 'ACTIVE',
    progress: 0,
    speed: 0,
    fitness: 0,
    distance: 0,
    collisions: 0,
    crashFrame: null,
    inputs: [0,0,0,0,0,0,0],
    outputs: [0,0,0]
  });

  const [selectedCarId, setSelectedCarId] = useState(null);
  const selectedCarRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  
  const [viewMode, setViewMode] = useState('FOLLOW_BEST');
  const [simSpeed, setSimSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const controlsRef = useRef({ isPlaying: false, isAuto: false, simSpeed: 1 });
  
  useEffect(() => {
    controlsRef.current.isPlaying = isPlaying;
    controlsRef.current.isAuto = isAuto;
    controlsRef.current.simSpeed = simSpeed;
    selectedCarRef.current = selectedCarId;
  }, [isPlaying, isAuto, simSpeed, selectedCarId]);

  const [genStats, setGenStats] = useState({
    evaluated: false,
    stats: null,
    generation: 0
  });
  
  useEffect(() => {
    let animId;
    let pendingNextGen = false;
    let uiFrameCount = 0;

    const update = () => {
      if (controlsRef.current.isPlaying && !pendingNextGen) {
        for (let i = 0; i < controlsRef.current.simSpeed; i++) {
          simState.current = simulationStep(simState.current);
          if (simState.current.evaluated) break;
        }
      }
      
      uiFrameCount++;
      const state = simState.current;

      // Throttle React UI updates to ~15 FPS to prevent massive overhead
      // Always force update if evaluated or not playing (paused state needs fresh data)
      if (uiFrameCount % 4 === 0 || state.evaluated || !controlsRef.current.isPlaying) {
        const activeCarId = selectedCarRef.current !== null ? selectedCarRef.current : state.bestCarId;
        const activeCar = state.cars.find(c => c.id === activeCarId);
      
      if (activeCar) {
        setBestCarState({
          id: activeCarId,
          isBest: activeCarId === state.bestCarId,
          sensors: [...activeCar.sensors],
          status: activeCar.status,
          progress: activeCar.progress,
          speed: activeCar.speed,
          fitness: activeCar.fitness,
          distance: activeCar.distanceTravelled,
          collisions: activeCar.collisions,
          crashFrame: activeCar.crashFrame,
          inputs: activeCar.lastInputs || [0,0,0,0,0,0,0],
          outputs: activeCar.lastOutputs || [0,0,0,0]
        });
      }

        setGenStats({
          evaluated: state.evaluated,
          stats: state.stats,
          generation: state.generation
        });
      }

      // Handle Auto Run
      if (state.evaluated && !pendingNextGen && controlsRef.current.isAuto && state.generation < 10) {
        pendingNextGen = true;
        const genome = state.stats.bestGenome;
        const nextGenNumber = state.generation + 1;
        setTimeout(() => {
          if (controlsRef.current.isAuto) {
            simState.current = initSimulation(10, genome);
            simState.current.generation = nextGenNumber;
          }
          pendingNextGen = false;
        }, 2000);
      }

      animId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleNextGen = () => {
    const state = simState.current;
    if (state.evaluated && state.generation < 10) {
      const genome = state.stats?.bestGenome;
      simState.current = initSimulation(10, genome);
      simState.current.generation = state.generation + 1;
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    simState.current = initSimulation(10, null);
    setIsPlaying(false);
    setIsAuto(false);
  };

  const s = genStats.stats || {};
  const isEval = genStats.evaluated;

  const getDisplayValue = (val, formatFn = (v) => v) => {
    if (!isEval) return '--';
    return formatFn(val);
  };

  return (
    <div className="learning-viz">
      {/* Controls */}
      <div className="epoch-switcher" style={{ display: 'flex', gap: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="epoch-btn" style={{ background: isPlaying ? 'rgba(255,45,85,0.2)' : 'rgba(0,255,136,0.2)', color: isPlaying ? '#ff2d55' : '#00ff88', borderColor: isPlaying ? '#ff2d55' : '#00ff88' }} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? 'PAUSE' : 'START'}
        </button>
        <button className="epoch-btn" onClick={handleReset}>RESET</button>
        <button 
          className={`epoch-btn ${isEval && genStats.generation < 10 ? 'active' : ''}`} 
          style={{ opacity: (!isEval || genStats.generation >= 10) ? 0.5 : 1, cursor: (!isEval || genStats.generation >= 10) ? 'not-allowed' : 'pointer' }}
          disabled={!isEval || genStats.generation >= 10}
          onClick={handleNextGen}
        >
          NEXT GENERATION
        </button>
        <button 
          className={`epoch-btn ${isAuto ? 'active' : ''}`}
          onClick={() => setIsAuto(!isAuto)}
        >
          AUTO RUN {isAuto ? 'ON' : 'OFF'}
        </button>

        {/* Simulation Speed Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 600 }}>SIM SPEED:</span>
          {[1, 2, 4, 8].map(s => (
            <button key={s} onClick={() => setSimSpeed(s)} style={{
              background: simSpeed === s ? 'rgba(0, 255, 136, 0.25)' : 'transparent',
              border: simSpeed === s ? '1px solid #00ff88' : '1px solid transparent',
              color: simSpeed === s ? '#00ff88' : '#888',
              padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold'
            }}>
              {s}x
            </button>
          ))}
        </div>
        
        <div style={{ padding: '8px 16px', marginLeft: 'auto', background: 'rgba(0, 212, 255, 0.1)', color: '#00d4ff', borderRadius: 8, fontSize: '1.1rem', fontWeight: 'bold', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
          Gen {genStats.generation || 0} / 10
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: 20 }}>
        {/* LEFT MAIN: Canvas & Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div 
            className="glass" 
            style={{ position: 'relative', height: 500, padding: 0, overflow: 'hidden', touchAction: 'none' }}
            onWheel={(e) => {
              e.preventDefault();
              setZoom(z => Math.min(8, Math.max(0.5, z - e.deltaY * 0.002)));
            }}
            onPointerDown={(e) => {
              if (viewMode === 'FREE') {
                isDragging.current = true;
                lastMouse.current = { x: e.clientX, y: e.clientY };
              }
            }}
            onPointerMove={(e) => {
              if (isDragging.current && viewMode === 'FREE') {
                const dx = e.clientX - lastMouse.current.x;
                const dy = e.clientY - lastMouse.current.y;
                setPan(p => ({ x: p.x + dx / zoom, y: p.y + dy / zoom }));
                lastMouse.current = { x: e.clientX, y: e.clientY };
              }
            }}
            onPointerUp={() => isDragging.current = false}
            onPointerLeave={() => isDragging.current = false}
          >
            {/* Camera View Mode Controls: OVERVIEW, FOLLOW BEST, FOLLOW SELECTED, FREE */}
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 6, background: 'rgba(10,10,15,0.6)', padding: '3px 6px', borderRadius: 6, backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { id: 'OVERVIEW', label: 'OVERVIEW' },
                { id: 'FOLLOW_BEST', label: 'FOLLOW BEST' },
                { id: 'FOLLOW_SELECTED', label: 'FOLLOW SELECTED' },
                { id: 'FREE', label: 'FREE' }
              ].map(m => (
                <button 
                  key={m.id} 
                  onClick={() => {
                    setViewMode(m.id);
                    if (m.id === 'FOLLOW_SELECTED' && selectedCarId === null) {
                      const state = simState.current;
                      if (state) setSelectedCarId(state.bestCarId);
                    }
                  }} 
                  style={{
                    background: viewMode === m.id ? 'rgba(0, 212, 255, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    border: viewMode === m.id ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                    color: viewMode === m.id ? '#00d4ff' : '#bbb',
                    padding: '4px 10px', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer', fontWeight: viewMode === m.id ? 600 : 400
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            
            {/* Camera Zoom Controls: 1x, 2x, 4x, 8x */}
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(10,10,15,0.6)', padding: '3px 8px', borderRadius: 6, backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 600, letterSpacing: '0.5px' }}>ZOOM:</span>
              {[1, 2, 4, 8].map(z => (
                <button 
                  key={z} 
                  onClick={() => setZoom(z)} 
                  style={{
                    background: zoom === z ? 'rgba(0, 212, 255, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    border: zoom === z ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                    color: zoom === z ? '#00d4ff' : '#bbb',
                    padding: '4px 8px', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer', fontWeight: zoom === z ? 'bold' : 'normal'
                  }}
                >
                  {z}x
                </button>
              ))}
            </div>

            <SensorCanvas simState={simState} selectedCarId={selectedCarId} viewMode={viewMode} zoom={zoom} pan={pan} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <div className="glass" style={{ padding: 15, textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Generation</div>
              <div style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 'bold' }}>{genStats.generation}</div>
            </div>
            <div className="glass" style={{ padding: 15, textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Status</div>
              <div style={{ fontSize: '1.4rem', color: isEval ? '#ff9500' : '#00ff88', fontWeight: 'bold' }}>{isEval ? 'EVAL' : 'SIM'}</div>
            </div>
            <div className="glass" style={{ padding: 15, textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Population</div>
              <div style={{ fontSize: '0.9rem', color: '#fff', marginTop: 5 }}>
                <span style={{ color: '#00ff88' }}>{s.activeAgents || 0} A</span> / 
                <span style={{ color: '#ff2d55' }}> {s.crashedAgents || 0} C</span> / 
                <span style={{ color: '#00d4ff' }}> {s.completedAgents || 0} F</span>
              </div>
            </div>
            <div className="glass" style={{ padding: 15, textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Best Fit</div>
              <div style={{ fontSize: '1.4rem', color: '#00d4ff', fontWeight: 'bold' }}>{getDisplayValue(s.bestFitness, v => v.toFixed(0))}</div>
            </div>
            <div className="glass" style={{ padding: 15, textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Avg Fit</div>
              <div style={{ fontSize: '1.4rem', color: '#ff9500', fontWeight: 'bold' }}>{getDisplayValue(s.avgFitness, v => v.toFixed(0))}</div>
            </div>
          </div>
          
          <div className="glass" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0, color: 'var(--neon-green)', fontSize: '1.1rem', textTransform: 'uppercase' }}>
                Agent {bestCarState.id} Detailed Metrics {bestCarState.isBest ? '(BEST)' : ''}
              </h3>
              <span style={{
                padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 'bold',
                background: bestCarState.status === 'CRASHED' ? 'rgba(255,45,85,0.2)' : bestCarState.status === 'COMPLETED' ? 'rgba(0,255,136,0.2)' : 'rgba(0,212,255,0.2)',
                color: bestCarState.status === 'CRASHED' ? '#ff2d55' : bestCarState.status === 'COMPLETED' ? '#00ff88' : '#00d4ff',
              }}>
                {bestCarState.status}
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 15 }}>
              {['Front', 'Front L', 'Front R', 'Left', 'Right'].map((lbl, i) => {
                const dist = bestCarState.sensors[i];
                const normDist = Math.max(0, Math.min(1, dist / 100));
                const color = normDist > 0.6 ? '#00ff88' : normDist > 0.3 ? '#ffcc00' : '#ff2d55';
                return (
                  <div key={lbl} style={{ background: 'rgba(255,255,255,0.03)', padding: 5, borderRadius: 4, textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '0.6rem', marginBottom: 2 }}>{lbl}</div>
                    <div style={{ color, fontSize: '0.8rem', fontWeight: 'bold' }}>{dist.toFixed(0)}px</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 15 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 5 }}>FITNESS</div>
                <div style={{ fontSize: '1.2rem', color: '#00ff88', fontWeight: 'bold' }}>{bestCarState.fitness.toFixed(0)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 5 }}>PROGRESS</div>
                <div style={{ fontSize: '1.2rem', color: '#fff' }}>{(bestCarState.progress * 100).toFixed(1)}%</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 5 }}>DISTANCE</div>
                <div style={{ fontSize: '1.2rem', color: '#fff' }}>{bestCarState.distance.toFixed(0)}m</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 5 }}>COLLISIONS</div>
                <div style={{ fontSize: '1.2rem', color: '#ff2d55' }}>{bestCarState.collisions}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 5 }}>AVG SPEED</div>
                <div style={{ fontSize: '1.2rem', color: '#00d4ff' }}>
                  {(bestCarState.distance / Math.max(1, (bestCarState.crashFrame || s.frame || 1) * (1/60))).toFixed(1)}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 5 }}>TIME</div>
                <div style={{ fontSize: '1.2rem', color: '#fff' }}>
                  {((bestCarState.crashFrame || s.frame || 0) * (1/60)).toFixed(1)}s
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Neural Network Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div className="glass" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#00d4ff', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Agent {bestCarState.id} Network</span>
              {bestCarState.isBest && <span style={{ color: '#ff9500', fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(255,149,0,0.1)', borderRadius: 12 }}>BEST AGENT</span>}
              {!bestCarState.isBest && selectedCarId !== null && <span style={{ color: '#00d4ff', fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(0,212,255,0.1)', borderRadius: 12, cursor: 'pointer' }} onClick={() => setSelectedCarId(null)}>RESET SELECTION</span>}
            </h3>
            
            <div style={{ padding: '10px 0' }}>
              <NetworkCanvas simState={simState} selectedCarId={selectedCarId} />
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 15 }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 10 }}>FLEET STATUS (CLICK TO INSPECT)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 120, overflowY: 'auto', paddingRight: 5 }}>
                {simState.current && simState.current.cars.map(c => {
                  const isActive = (selectedCarId !== null ? selectedCarId : simState.current.bestCarId) === c.id;
                  return (
                    <div key={c.id} 
                      onClick={() => setSelectedCarId(c.id === selectedCarId ? null : c.id)}
                      style={{ 
                        display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', 
                        padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                        background: isActive ? 'rgba(0,212,255,0.1)' : 'transparent',
                        color: c.crashed ? '#ff2d55' : c.completed ? '#00ff88' : '#ccc' 
                      }}>
                      <span>Agent {c.id} {c.id === simState.current.bestCarId && '★'}</span>
                      <span>{c.status}</span>
                      <span>{(c.progress*100).toFixed(0)}%</span>
                      <span>{c.fitness.toFixed(0)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="glass" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1rem' }}>How the AI Learns</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem', color: '#aaa', fontFamily: 'var(--font-mono)' }}>
              <div>1. <span style={{color: '#00d4ff'}}>Sensors</span> map environment</div>
              <div>2. <span style={{color: '#ff9500'}}>Neural Network</span> activates</div>
              <div>3. <span style={{color: '#00ff88'}}>Driving Decision</span> made</div>
              <div>4. <span style={{color: '#fff'}}>Physics Engine</span> applies force</div>
              <div>5. <span style={{color: '#ff2d55'}}>Fitness Score</span> calculated</div>
              <div>6. <span style={{color: '#00d4ff'}}>Elite Genome</span> preserved</div>
              <div>7. <span style={{color: '#ff9500'}}>Gaussian Mutation</span> applied</div>
              <div>8. <span style={{color: '#fff'}}>Next Generation</span> clones deploy</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
