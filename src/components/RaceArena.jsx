import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Line, Text } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

// ======================== TRACK DEFINITION ========================
// Oval-ish circuit with interesting curves
function generateTrackPoints(segments = 200) {
  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2
    // Interesting figure-8 ish layout
    const x = Math.sin(t) * 30 + Math.sin(t * 2) * 8
    const z = Math.cos(t) * 20 + Math.cos(t * 3) * 5
    points.push(new THREE.Vector3(x, 0, z))
  }
  return points
}

function getTrackPosition(trackPoints, progress) {
  const totalLen = trackPoints.length - 1
  const idx = (progress % 1) * totalLen
  const i = Math.floor(idx)
  const f = idx - i
  const p1 = trackPoints[i % trackPoints.length]
  const p2 = trackPoints[(i + 1) % trackPoints.length]
  return {
    position: new THREE.Vector3().lerpVectors(p1, p2, f),
    direction: new THREE.Vector3().subVectors(p2, p1).normalize(),
  }
}

// ======================== TRACK MESH ========================
function RaceTrack({ trackPoints }) {
  const trackWidth = 6

  const { leftEdge, rightEdge, surfaceGeo } = useMemo(() => {
    const left = []
    const right = []

    for (let i = 0; i < trackPoints.length; i++) {
      const curr = trackPoints[i]
      const next = trackPoints[(i + 1) % trackPoints.length]
      const dir = new THREE.Vector3().subVectors(next, curr).normalize()
      const normal = new THREE.Vector3(-dir.z, 0, dir.x)

      left.push(new THREE.Vector3().addVectors(curr, normal.clone().multiplyScalar(trackWidth / 2)))
      right.push(new THREE.Vector3().addVectors(curr, normal.clone().multiplyScalar(-trackWidth / 2)))
    }

    // Build track surface geometry
    const vertices = []
    const indices = []
    for (let i = 0; i < left.length - 1; i++) {
      const baseIdx = i * 2
      vertices.push(left[i].x, 0.01, left[i].z)
      vertices.push(right[i].x, 0.01, right[i].z)

      if (i < left.length - 2) {
        indices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    return { leftEdge: left, rightEdge: right, surfaceGeo: geo }
  }, [trackPoints])

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0a0f0a" roughness={0.95} metalness={0.1} />
      </mesh>

      {/* Track surface */}
      <mesh geometry={surfaceGeo}>
        <meshStandardMaterial
          color="#1a1a2e"
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>

      {/* Track edges */}
      <Line points={leftEdge} color="#00d4ff" lineWidth={2} transparent opacity={0.4} />
      <Line points={rightEdge} color="#00d4ff" lineWidth={2} transparent opacity={0.4} />

      {/* Center line dashed */}
      <Line points={trackPoints} color="#ffffff" lineWidth={1} transparent opacity={0.1}
        dashed dashScale={4} dashSize={1} dashOffset={0} />

      {/* Start/finish line */}
      <mesh position={[trackPoints[0].x, 0.02, trackPoints[0].z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[trackWidth, 0.5]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

// ======================== CAR ========================
function RaceCar({ position, rotation, color, name, isPlayer }) {
  return (
    <group position={[position.x, 0.3, position.z]} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh>
        <boxGeometry args={[0.6, 0.25, 1.4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isPlayer ? 0.8 : 0.4}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.15, -0.1]}>
        <boxGeometry args={[0.35, 0.15, 0.5]} />
        <meshStandardMaterial color="#111" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Front wing */}
      <mesh position={[0, -0.05, 0.8]}>
        <boxGeometry args={[0.9, 0.05, 0.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Rear wing */}
      <mesh position={[0, 0.25, -0.65]}>
        <boxGeometry args={[0.7, 0.2, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

// ======================== RACE SCENE ========================
const CARS = [
  { id: 'human', name: 'SHAKIR', color: '#ff9500', isPlayer: true },
  { id: 'v1', name: 'Neural-X V1', color: '#00d4ff', isPlayer: false },
  { id: 'v2', name: 'Neural-X V2', color: '#00ff88', isPlayer: false },
  { id: 'prime', name: 'Neural-X Prime', color: '#bf5af2', isPlayer: false },
]

const TOTAL_LAPS = 3
const CHECKPOINT_COUNT = 20

function RaceScene({
  raceStarted, steering, carStates, trackPoints,
  onCarPositions, cameraMode
}) {
  const { camera } = useThree()
  const statesRef = useRef(carStates)
  statesRef.current = carStates

  // Broadcast camera following leader
  useFrame(() => {
    if (!raceStarted) return
    const states = statesRef.current

    // Find player car
    const player = states.find(s => s.id === 'human')
    if (!player) return

    const { position: playerPos, direction: playerDir } = getTrackPosition(trackPoints, player.progress)

    // Camera behind and above player
    const camOffset = new THREE.Vector3(
      -playerDir.x * 15 + playerDir.z * 3,
      12,
      -playerDir.z * 15 - playerDir.x * 3
    )
    const targetCam = playerPos.clone().add(camOffset)
    camera.position.lerp(targetCam, 0.03)
    camera.lookAt(playerPos.x, 0, playerPos.z)
  })

  return (
    <>
      {/* Environment */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[20, 30, 10]} intensity={1} color="#ffeedd" castShadow />
      <pointLight position={[0, 15, 0]} intensity={0.5} color="#00d4ff" />
      <hemisphereLight groundColor="#0a0a0f" skyColor="#1a1a3e" intensity={0.4} />
      <fog attach="fog" args={['#0a0a0f', 30, 100]} />

      <RaceTrack trackPoints={trackPoints} />

      {/* Cars */}
      {carStates.map(car => {
        const { position, direction } = getTrackPosition(trackPoints, car.progress)
        const rotation = Math.atan2(direction.x, direction.z)
        return (
          <RaceCar
            key={car.id}
            position={position}
            rotation={rotation}
            color={car.color}
            name={car.name}
            isPlayer={car.isPlayer}
          />
        )
      })}

      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.3} radius={0.6} />
        <Vignette darkness={0.5} offset={0.3} />
      </EffectComposer>
    </>
  )
}

// ======================== MAIN COMPONENT ========================
export default function RaceArena({ onRaceEnd }) {
  const trackPoints = useMemo(() => generateTrackPoints(200), [])
  const [raceState, setRaceState] = useState('pre') // pre, countdown, racing, finished
  const [countdown, setCountdown] = useState(3)
  const [steering, setSteering] = useState(0) // -1 to 1
  const [lapData, setLapData] = useState({ current: 0, total: TOTAL_LAPS })
  const [raceTime, setRaceTime] = useState(0)
  const [arActive, setArActive] = useState(false)
  const [speed, setSpeed] = useState(0)

  // Car states
  const [carStates, setCarStates] = useState(
    CARS.map((c, i) => ({
      ...c,
      progress: i * 0.002, // Slight offset
      speed: 0,
      lap: 0,
      lapTimes: [],
      crashes: 0,
      lastLapStart: 0,
      checkpoint: 0,
      topSpeed: 0,
    }))
  )

  // Sorted positions
  const positions = useMemo(() => {
    return [...carStates].sort((a, b) => {
      if (b.lap !== a.lap) return b.lap - a.lap
      return b.progress - a.progress
    })
  }, [carStates])

  // Webcam & hand tracking
  const videoRef = useRef(null)
  const steerRef = useRef(0)

  useEffect(() => {
    // Try to get webcam
    navigator.mediaDevices?.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setArActive(true)
        }
      })
      .catch(() => { /* Webcam not available, keyboard fallback */ })

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Keyboard steering fallback
  useEffect(() => {
    const keys = new Set()
    const onDown = (e) => {
      keys.add(e.key)
      updateSteer()
    }
    const onUp = (e) => {
      keys.delete(e.key)
      updateSteer()
    }
    const updateSteer = () => {
      let s = 0
      if (keys.has('ArrowLeft') || keys.has('a')) s -= 1
      if (keys.has('ArrowRight') || keys.has('d')) s += 1
      steerRef.current = s
      setSteering(s)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // Start race
  const startRace = useCallback(() => {
    setRaceState('countdown')
    setCountdown(3)
    let c = 3
    const interval = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(interval)
        setTimeout(() => {
          setRaceState('racing')
          setRaceTime(0)
        }, 500)
      }
    }, 1000)
  }, [])

  // Game loop
  useEffect(() => {
    if (raceState !== 'racing') return

    let lastTime = performance.now()
    let raf

    const loop = () => {
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.05) // Cap dt
      lastTime = now

      setRaceTime(prev => prev + dt)

      setCarStates(prev => {
        const newStates = prev.map(car => {
          const s = { ...car }
          const steerInput = car.isPlayer ? steerRef.current : 0

          if (car.isPlayer) {
            // Player: auto-accelerate, user steers laterally
            s.speed = Math.min(s.speed + dt * 8, 180 + Math.random() * 20)
            // Steering affects progress (simplified — lateral offset not modeled, progress speed varies)
            const speedFactor = s.speed / 200
            s.progress += speedFactor * dt * 0.015
          } else {
            // AI cars: each with different base speed + slight randomness
            const aiSpeeds = { v1: 140, v2: 165, prime: 185 }
            const baseSpeed = aiSpeeds[car.id] || 160
            s.speed = baseSpeed + Math.sin(performance.now() * 0.001 + car.progress * 10) * 15
            const speedFactor = s.speed / 200
            s.progress += speedFactor * dt * 0.015
          }

          s.topSpeed = Math.max(s.topSpeed, s.speed)

          // Lap tracking
          const newLapProgress = s.progress % 1
          const prevLapProgress = car.progress % 1
          if (newLapProgress < prevLapProgress && s.progress > 0.5) {
            s.lap++
            const lapTime = raceTime - s.lastLapStart
            s.lapTimes.push(lapTime)
            s.lastLapStart = raceTime

            // Check finish
            if (s.lap >= TOTAL_LAPS && s.isPlayer) {
              setTimeout(() => setRaceState('finished'), 100)
            }
          }

          return s
        })
        return newStates
      })

      if (raceState === 'racing') {
        raf = requestAnimationFrame(loop)
      }
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [raceState])

  // Update speed display
  useEffect(() => {
    const player = carStates.find(c => c.isPlayer)
    if (player) setSpeed(Math.round(player.speed))
  }, [carStates])

  const formatTime = (t) => {
    if (!t || t <= 0) return '0:00.000'
    const mins = Math.floor(t / 60)
    const secs = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const playerCar = carStates.find(c => c.isPlayer)

  const handleFinish = () => {
    const player = carStates.find(c => c.isPlayer)
    const bestLap = player?.lapTimes.length > 0
      ? Math.min(...player.lapTimes) : raceTime / TOTAL_LAPS
    onRaceEnd?.({
      bestLap: formatTime(bestLap),
      avgSpeed: Math.round(player?.topSpeed * 0.75 || 0),
      topSpeed: Math.round(player?.topSpeed || 0),
      collisions: player?.crashes || 0,
      cornerAccuracy: Math.round(75 + Math.random() * 20),
      totalTime: formatTime(raceTime),
      cars: carStates.map(c => ({
        name: c.name,
        laps: c.lap,
        bestLap: c.lapTimes.length > 0 ? formatTime(Math.min(...c.lapTimes)) : '--',
        topSpeed: Math.round(c.topSpeed),
        isPlayer: c.isPlayer,
      }))
    })
  }

  return (
    <div className="race-arena">
      <Canvas
        camera={{ position: [0, 30, 40], fov: 55 }}
        gl={{ antialias: true }}
        
      >
        <RaceScene
          raceStarted={raceState === 'racing'}
          steering={steering}
          carStates={carStates}
          trackPoints={trackPoints}
        />
      </Canvas>

      {/* HUD */}
      {raceState === 'racing' && (
        <>
          <div className="race-hud">
            <div className="glass hud-panel">
              <div className="hud-label">Lap</div>
              <div className="hud-value">{Math.min(playerCar?.lap + 1 || 1, TOTAL_LAPS)}/{TOTAL_LAPS}</div>
            </div>
            <div className="glass hud-panel">
              <div className="hud-label">Time</div>
              <div className="hud-value">{formatTime(raceTime)}</div>
            </div>
          </div>

          <div className="race-positions glass">
            <div className="hud-label" style={{ marginBottom: 8 }}>Positions</div>
            {positions.map((car, i) => (
              <div key={car.id} className="race-position-item">
                <div className="race-position-num">{i + 1}</div>
                <div className="race-position-name" style={{ color: car.color }}>{car.name}</div>
                <div className="race-position-gap">L{car.lap}</div>
              </div>
            ))}
          </div>

          <div className="race-bottom-hud">
            <div className="glass speed-display">
              <div className="speed-value">{speed}</div>
              <div className="speed-unit">KM/H</div>
            </div>
            {arActive && (
              <div className="glass ar-status">
                <div className="ar-status-dot" />
                AR CONTROL ACTIVE
              </div>
            )}
          </div>

          {/* Steering indicator */}
          <div style={{
            position: 'absolute', bottom: 24, left: 24,
            fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
            color: 'var(--text-muted)', zIndex: 50,
          }}>
            STEER: ← A/D →
          </div>
        </>
      )}

      {/* Webcam */}
      {arActive && raceState === 'racing' && (
        <div className="webcam-container glass">
          <div className="webcam-label">CAMERA</div>
          <video ref={videoRef} className="webcam-video" autoPlay muted playsInline />
        </div>
      )}

      {/* Pre-race overlay */}
      {raceState === 'pre' && (
        <div className="race-start-overlay">
          <button className="race-start-btn" onClick={startRace}>
            START RACE
          </button>
        </div>
      )}

      {/* Countdown */}
      {raceState === 'countdown' && (
        <div className={`race-countdown ${countdown <= 0 ? 'go' : ''}`}>
          {countdown > 0 ? countdown : 'GO!'}
        </div>
      )}

      {/* Race complete */}
      {raceState === 'finished' && (
        <div className="race-complete-overlay">
          <div className="race-complete-title">RACE COMPLETE</div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Total Time: {formatTime(raceTime)}
          </div>
          <button className="race-complete-btn" onClick={handleFinish}>
            VIEW ANALYTICS
          </button>
        </div>
      )}
    </div>
  )
}
