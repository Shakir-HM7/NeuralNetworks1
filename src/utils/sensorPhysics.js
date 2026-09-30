export const TRACK_WIDTH = 16;
export const MAX_SPEED = 200;
export const DT = 1 / 60;
export const MAX_SENSOR_RANGE = 120;

const CONTROL_POINTS = [
  { x: 200, y: 520 }, { x: 350, y: 520 }, { x: 500, y: 520 },
  { x: 620, y: 520 }, { x: 700, y: 500 }, { x: 740, y: 450 }, { x: 730, y: 380 },
  { x: 700, y: 310 }, { x: 680, y: 260 }, { x: 630, y: 220 }, { x: 570, y: 200 },
  { x: 530, y: 170 }, { x: 540, y: 120 }, { x: 500, y: 80 }, { x: 400, y: 60 },
  { x: 280, y: 55 }, { x: 180, y: 70 }, { x: 110, y: 120 }, { x: 80, y: 200 },
  { x: 70, y: 290 }, { x: 50, y: 360 }, { x: 70, y: 410 }, { x: 120, y: 440 },
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

export const TRACK_POINTS = catmullRom(CONTROL_POINTS, 20);

export const TRACK_LENGTH_PX = (() => {
  let len = 0;
  for (let i = 1; i < TRACK_POINTS.length; i++) {
    const dx = TRACK_POINTS[i].x - TRACK_POINTS[i - 1].x;
    const dy = TRACK_POINTS[i].y - TRACK_POINTS[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
})();

export function getTrackState(progress) {
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

export function getCurvature(progress) {
  const s1 = getTrackState(progress - 0.005);
  const s2 = getTrackState(progress + 0.005);
  let a = Math.atan2(s2.tangent.y, s2.tangent.x) - Math.atan2(s1.tangent.y, s1.tangent.x);
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a / 0.01;
}

// Generate boundaries at the track asphalt edges for exact raycasting
export const TRACK_BOUNDARIES = (() => {
  const segments = [];
  const n = TRACK_POINTS.length;
  for (let i = 0; i < n; i++) {
    const ts1 = getTrackState(i / n);
    const ts2 = getTrackState((i + 1) / n);
    const w = TRACK_WIDTH;
    
    // Left boundary segment
    segments.push({
      x1: ts1.pos.x + ts1.normal.x * w, y1: ts1.pos.y + ts1.normal.y * w,
      x2: ts2.pos.x + ts2.normal.x * w, y2: ts2.pos.y + ts2.normal.y * w
    });
    // Right boundary segment
    segments.push({
      x1: ts1.pos.x - ts1.normal.x * w, y1: ts1.pos.y - ts1.normal.y * w,
      x2: ts2.pos.x - ts2.normal.x * w, y2: ts2.pos.y - ts2.normal.y * w
    });
  }
  return segments;
})();

// Intersection between ray (px, py, dx, dy) and line segment (x1, y1, x2, y2)
function rayIntersect(px, py, dx, dy, seg) {
  const x1 = seg.x1, y1 = seg.y1, x2 = seg.x2, y2 = seg.y2;
  const v1x = px - x1, v1y = py - y1;
  const v2x = x2 - x1, v2y = y2 - y1;
  const v3x = -dy, v3y = dx;
  
  const dot = v2x * v3x + v2y * v3y;
  if (Math.abs(dot) < 0.00001) return null;
  
  const t1 = (v2x * v1y - v2y * v1x) / dot;
  const t2 = (v1x * v3x + v1y * v3y) / dot;
  
  if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
    return t1;
  }
  return null;
}

export function castSensor(carX, carY, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let minDistance = MAX_SENSOR_RANGE;
  
  for (const seg of TRACK_BOUNDARIES) {
    const d = rayIntersect(carX, carY, dx, dy, seg);
    if (d !== null && d < minDistance) {
      minDistance = d;
    }
  }
  return minDistance;
}

// 7 Inputs -> 4 Hidden (Feature Extraction, Boundary Awareness, Path Planning, Speed Control) -> 4 Outputs (Steer L, Steer R, Throttle, Brake)
class NeuralNetwork {
  constructor(inputSize = 7, hiddenSize = 4, outputSize = 4, weights = null) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    
    // (7+1)*4 + (4+1)*4 = 32 + 20 = 52 parameters
    const numWeights = (inputSize + 1) * hiddenSize + (hiddenSize + 1) * outputSize;
    
    if (weights) {
      this.weights = new Float32Array(weights);
    } else {
      this.weights = new Float32Array(numWeights);
      const std1 = Math.sqrt(2 / (inputSize + hiddenSize));
      const std2 = Math.sqrt(2 / (hiddenSize + outputSize));
      
      let idx = 0;
      // Hidden layer weights & biases
      for (let i = 0; i < hiddenSize; i++) {
        this.weights[idx++] = (Math.random() - 0.5) * 0.2; // bias
        for (let j = 0; j < inputSize; j++) {
          this.weights[idx++] = randomGaussian() * std1;
        }
      }
      // Output layer weights & biases
      for (let i = 0; i < outputSize; i++) {
        // Output 2 = Throttle (slight positive drive bias to explore forward)
        // Output 3 = Brake (slight negative bias so cars roll forward initially)
        const initBias = (i === 2) ? 0.7 : (i === 3) ? -0.5 : 0.0;
        this.weights[idx++] = initBias + (Math.random() - 0.5) * 0.2;
        for (let j = 0; j < hiddenSize; j++) {
          this.weights[idx++] = randomGaussian() * std2;
        }
      }
    }
  }

  forward(inputs) {
    let wIdx = 0;
    
    // Hidden layer: 4 neurons
    // 0: Feature Extraction, 1: Boundary Awareness, 2: Path Planning, 3: Speed Control
    const hidden = new Float32Array(this.hiddenSize);
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = this.weights[wIdx++]; // bias
      for (let j = 0; j < this.inputSize; j++) {
        sum += inputs[j] * this.weights[wIdx++];
      }
      hidden[i] = Math.tanh(sum); // Tanh in [-1, 1]
    }

    // Output layer: 4 neurons
    // 0: Steer Left, 1: Steer Right, 2: Throttle, 3: Brake
    const outputs = new Float32Array(this.outputSize);
    for (let i = 0; i < this.outputSize; i++) {
      let sum = this.weights[wIdx++]; // bias
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hidden[j] * this.weights[wIdx++];
      }
      // Sigmoid in [0, 1]
      outputs[i] = 1 / (1 + Math.exp(-sum));
    }
    
    return { 
      finalOutputs: Array.from(outputs), 
      hidden: Array.from(hidden), 
      rawOutputs: Array.from(outputs) 
    };
  }
}

// Box-Muller transform for Gaussian random numbers
function randomGaussian() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function mutateWeights(baseWeights, mutationRate = 0.25, mutationStrength = 0.3) {
  const newWeights = new Float32Array(baseWeights.length);
  for (let i = 0; i < baseWeights.length; i++) {
    if (Math.random() < mutationRate) {
      newWeights[i] = baseWeights[i] + randomGaussian() * mutationStrength;
    } else {
      newWeights[i] = baseWeights[i];
    }
  }
  return newWeights;
}

export function initSimulation(numCars, bestGenome = null) {
  const cars = [];
  for (let i = 0; i < numCars; i++) {
    let network;
    if (bestGenome) {
      if (i === 0) {
        // Agent 0: Elite clone (exact inheritance of best genome)
        network = new NeuralNetwork(7, 4, 4, new Float32Array(bestGenome));
      } else if (i <= 3) {
        // Subtle fine-tuning mutation of champion
        network = new NeuralNetwork(7, 4, 4, mutateWeights(bestGenome, 0.15, 0.15));
      } else if (i <= 7) {
        // Moderate exploration around champion
        network = new NeuralNetwork(7, 4, 4, mutateWeights(bestGenome, 0.3, 0.35));
      } else {
        // Broad exploratory mutations
        network = new NeuralNetwork(7, 4, 4, mutateWeights(bestGenome, 0.5, 0.6));
      }
    } else {
      // Generation 0: Clean heuristic initialization
      network = new NeuralNetwork(7, 4, 4);
    }

    const startProg = 0.08 + (i * 0.001);
    cars.push({
      id: i,
      startProgress: startProg,
      progress: startProg,
      speed: 25,
      cte: (i - numCars / 2) * 0.25, // Stagger laterally near center
      steerAngle: 0,
      reward: 0,
      fitness: 0,
      collisions: 0,
      lapCount: 0,
      collided: false,
      crashed: false,
      status: 'ACTIVE', // ACTIVE, CRASHED, FAILED, COMPLETED
      stallFrames: 0,
      crashFrame: null,
      completed: false,
      distanceTravelled: 0,
      sensors: [0, 0, 0, 0, 0], // Front, Front-left, Front-right, Left, Right
      lastInputs: [0, 0, 0, 0, 0, 0, 0],
      lastHidden: [0, 0, 0, 0],
      lastOutputs: [0, 0, 0, 0],
      lastRawOutputs: [0, 0, 0, 0],
      carX: 0, carY: 0, heading: 0,
      trail: [],
      network
    });
  }
  return {
    frame: 0,
    cars,
    bestCarId: 0,
    generation: bestGenome ? 1 : 0,
    bestGenome: bestGenome,
    evaluated: false,
    stats: null
  };
}

export function simulationStep(state) {
  if (state.evaluated) {
    return state;
  }

  const nextCars = state.cars.map(car => {
    // Inactive agents skip all physics, sensors, and neural network updates
    if (car.status !== 'ACTIVE') {
      return car;
    }

    let { progress, speed, cte, steerAngle, collisions, lapCount, network, distanceTravelled, stallFrames } = car;
    
    // Strict Stall Detection: speed < 0.5 km/h for > 5 seconds (300 frames)
    if (speed < 0.5) {
      stallFrames++;
    } else {
      stallFrames = 0;
    }

    if (stallFrames >= 300) {
      return { 
        ...car, 
        status: 'FAILED', 
        crashed: true, 
        crashFrame: state.frame, 
        speed: 0, 
        stallFrames 
      };
    }

    const curvature = getCurvature(progress);
    
    const ts = getTrackState(progress);
    const carX = ts.pos.x + ts.normal.x * cte;
    const carY = ts.pos.y + ts.normal.y * cte;
    const trackHeading = Math.atan2(ts.tangent.y, ts.tangent.x);
    const heading = trackHeading + steerAngle * 0.45;

    // Real Geometric Sensor Raycasting
    const sensorAngles = [0, -Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2];
    const sensors = sensorAngles.map(a => castSensor(carX, carY, heading + a));

    // Neural Network Input Vector (Real Normalized Physical Values)
    const inputs = [
      sensors[0] / MAX_SENSOR_RANGE, // Front Sensor
      sensors[1] / MAX_SENSOR_RANGE, // Front Left Sensor
      sensors[2] / MAX_SENSOR_RANGE, // Front Right Sensor
      sensors[3] / MAX_SENSOR_RANGE, // Left Sensor
      sensors[4] / MAX_SENSOR_RANGE, // Right Sensor
      speed / MAX_SPEED,             // Speed
      curvature * 0.1                // Curvature (normalized)
    ];

    // REAL NEURAL NETWORK INFERENCE
    const { finalOutputs, hidden, rawOutputs } = network.forward(inputs);
    const [steerLeft, steerRight, throttle, brake] = finalOutputs;
    
    // Steering decision from dual outputs [-1, 1]
    const rawSteer = steerRight - steerLeft;

    // Progressive speed capability by generation
    let maxAllowedSpeed = MAX_SPEED;
    if (state.generation === 0) {
      maxAllowedSpeed *= 0.35;
    } else if (state.generation <= 3) {
      maxAllowedSpeed *= 0.55;
    } else if (state.generation <= 6) {
      maxAllowedSpeed *= 0.75;
    }

    // Steering Physics: steer angle smoothly tracks rawSteer
    steerAngle += (rawSteer - steerAngle) * Math.min(1, 6.0 * DT);
    steerAngle = Math.max(-1, Math.min(1, steerAngle));

    // Acceleration & Braking Dynamics
    const driveAccel = throttle * 140;
    const brakeDecel = (speed > 5) ? brake * 90 : 0;
    // Base idle creep ensures cars roll forward unless brake is engaged
    const idleRoll = (speed < 15 && brake < 0.2) ? 20 : 0;

    speed += (driveAccel - brakeDecel + idleRoll) * DT;
    speed *= 0.995; // Aerodynamic drag
    speed = Math.max(0, Math.min(speed, maxAllowedSpeed));

    const distanceStep = speed * DT;
    distanceTravelled += distanceStep;
    
    let newProgress = progress + distanceStep / TRACK_LENGTH_PX;
    let completed = false;
    let status = 'ACTIVE';
    
    // Check full lap completion (distance traveled >= full circuit)
    if (distanceTravelled >= TRACK_LENGTH_PX * 0.98) {
      completed = true;
      status = 'COMPLETED';
      lapCount++;
      speed = 0;
    }
    progress = newProgress % 1.0;
    
    // Realistic Lateral Control: Steering provides direct lateral velocity; curvature introduces inertia
    const steeringRate = steerAngle * Math.min(1.0, speed / 20) * 1.5;
    const inertiaDrift = -Math.sign(curvature) * Math.min(1.2, Math.pow(speed / 80, 2) * Math.abs(curvature) * 0.02);
    cte += (steeringRate + inertiaDrift) * DT * 20;

    let crashed = false;
    let crashFrame = null;
    let collided = false;
    
    // Collision Detection: curb limit at (TRACK_WIDTH - 2) pixels from center
    if (Math.abs(cte) >= TRACK_WIDTH - 2) {
      collided = true;
      crashed = true;
      crashFrame = state.frame;
      status = 'CRASHED';
      cte = Math.sign(cte) * (TRACK_WIDTH - 2);
      speed = 0;
      collisions += 1;
    }

    // Update vehicle trail
    const trail = [...car.trail];
    if (state.frame % 3 === 0 && !crashed) {
      trail.push({ x: carX, y: carY });
      if (trail.length > 30) trail.shift();
    }

    return {
      ...car,
      progress, speed, cte, steerAngle, collisions, lapCount,
      carX, carY, heading, sensors, collided, crashed, crashFrame, completed, status, distanceTravelled, stallFrames, fitness: 0,
      trail,
      lastInputs: inputs,
      lastHidden: hidden,
      lastOutputs: finalOutputs,
      lastRawOutputs: rawOutputs
    };
  });

  let activeAgents = 0;
  let completedAgents = 0;
  let crashedAgents = 0;
  let failedAgents = 0;

  // Real Fitness Function: Monotonically rewards forward progress and eliminates stationary cars
  nextCars.forEach(car => {
    let fit = 0;
    
    // 1. Lap Fraction / Progress along circuit (dominant positive objective)
    const lapFraction = car.distanceTravelled / TRACK_LENGTH_PX;
    fit += lapFraction * 20000;
    
    // 2. Physical distance travelled
    fit += car.distanceTravelled * 4.0;
    
    // 3. Lap Completion Massive Reward
    if (car.status === 'COMPLETED' || car.completed) {
      fit += 30000;
      // Faster completion time bonus
      const frameBonus = Math.max(0, (4000 - state.frame) * 5);
      fit += frameBonus;
    }
    
    // 4. Pace / Average Speed reward
    const liveTime = Math.max(0.2, (car.crashFrame || state.frame) * DT);
    const avgSpeed = car.distanceTravelled / liveTime;
    fit += avgSpeed * 6.0;
    
    // 5. Staying on track / Near racing line (low CTE)
    const centeringScore = Math.max(0, 1 - Math.abs(car.cte) / TRACK_WIDTH) * 300;
    fit += centeringScore;
    
    // 6. Strict Penalties
    if (car.status === 'FAILED') {
      // Stalled vehicles receive heavy penalty so stopping is NEVER selected
      fit = -10000;
    } else if (car.status === 'CRASHED') {
      // Moderate collision deduction so driving further is ALWAYS better than crashing early
      fit -= 400;
    }

    car.fitness = fit;

    if (car.status === 'CRASHED') crashedAgents++;
    else if (car.status === 'COMPLETED') completedAgents++;
    else if (car.status === 'FAILED') failedAgents++;
    else activeAgents++;
  });

  // Timeout safety limit
  const timeoutLimit = 15000;
  if (state.frame > timeoutLimit && activeAgents > 0) {
    nextCars.forEach(car => {
      if (car.status === 'ACTIVE') {
        car.status = 'FAILED';
        car.crashed = true;
        car.crashFrame = state.frame;
        activeAgents--;
        failedAgents++;
      }
    });
  }

  const evaluated = (activeAgents === 0);

  let bestCarId = state.bestCarId;
  let maxFit = -Infinity;
  let minFit = Infinity;
  let totalFit = 0;

  // Select champion genome
  let bestNetworkWeights = null;
  nextCars.forEach(car => {
    if (car.fitness > maxFit) {
      maxFit = car.fitness;
      bestCarId = car.id;
      bestNetworkWeights = new Float32Array(car.network.weights);
    }
    if (car.fitness < minFit) minFit = car.fitness;
    totalFit += car.fitness;
  });

  const stats = {
    bestFitness: maxFit,
    worstFitness: minFit,
    avgFitness: totalFit / nextCars.length,
    activeAgents,
    completedAgents,
    crashedAgents,
    failedAgents,
    frame: state.frame,
    bestGenome: bestNetworkWeights
  };

  return {
    frame: state.frame + 1,
    cars: nextCars,
    bestCarId,
    generation: state.generation,
    bestGenome: state.bestGenome,
    evaluated,
    stats
  };
}
