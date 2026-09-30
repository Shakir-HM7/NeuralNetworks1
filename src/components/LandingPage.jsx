import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// Living Background Component
function CinematicBackground() {
  const pointsCount = 1500
  const linesCount = 50

  const { pointPositions, linePositions } = useMemo(() => {
    const pPos = new Float32Array(pointsCount * 3)
    for (let i = 0; i < pointsCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 50
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 50
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 50
    }

    const lPos = new Float32Array(linesCount * 6)
    for (let i = 0; i < linesCount; i++) {
      const x = (Math.random() - 0.5) * 40
      const y = (Math.random() - 0.5) * 40
      const z = (Math.random() - 0.5) * 40
      // Start point
      lPos[i * 6] = x
      lPos[i * 6 + 1] = y
      lPos[i * 6 + 2] = z
      // End point (streak)
      lPos[i * 6 + 3] = x + (Math.random() - 0.5) * 5
      lPos[i * 6 + 4] = y + (Math.random() - 0.5) * 5
      lPos[i * 6 + 5] = z + (Math.random() - 0.5) * 15
    }

    return { pointPositions: pPos, linePositions: lPos }
  }, [pointsCount, linesCount])

  const pointsRef = useRef()
  const linesRef = useRef()

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.x -= delta * 0.02
      pointsRef.current.rotation.y -= delta * 0.03
    }
    if (linesRef.current) {
      linesRef.current.rotation.z += delta * 0.05
      linesRef.current.rotation.y += delta * 0.02
      // Pulsing effect
      linesRef.current.material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.2
    }
  })

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pointsCount}
            array={pointPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.08} color="#00d4ff" transparent opacity={0.5} sizeAttenuation={true} />
      </points>

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linesCount * 2}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#bf5af2" transparent opacity={0.4} />
      </lineSegments>
    </>
  )
}

export default function LandingPage({ onEnter }) {
  return (
    <div className="landing-page-container cinematic-fade-in">
      {/* 3D Living Background */}
      <div className="landing-canvas-wrapper">
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <ambientLight intensity={0.5} />
          <CinematicBackground />
          <EffectComposer>
            <Bloom intensity={1.5} luminanceThreshold={0.2} luminanceSmoothing={0.9} radius={0.8} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Grid Overlay */}
      <div className="cinematic-grid-overlay" />
      <div className="cinematic-vignette" />

      {/* Main Content */}
      <div className="landing-cinematic-content">
        <div className="logo-section">
          <div className="ai-badge">
            <span className="ai-badge-dot"></span>
            AUTONOMOUS RACING INTELLIGENCE
          </div>
          
          <h1 className="cinematic-logo">
            NeuralDrive <span className="logo-accent">F1</span>
          </h1>
          
          <div className="cinematic-subtitle">
            <p>Training Intelligence.</p>
            <p className="subtitle-highlight">Racing the Future.</p>
          </div>
        </div>

        <button className="cinematic-enter-btn" onClick={onEnter}>
          <span className="btn-content">ENTER SIMULATION</span>
          <span className="btn-glow"></span>
        </button>
      </div>
    </div>
  )
}
