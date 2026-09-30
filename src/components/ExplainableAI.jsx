import { useState, useEffect, useRef, useCallback } from 'react'

const PIPELINE = [
  { id: 'camera', icon: '📷', name: 'Camera Input', status: 'ACTIVE' },
  { id: 'feature', icon: '🔬', name: 'Feature Extraction', status: 'PROCESSING' },
  { id: 'lane', icon: '🛣️', name: 'Lane Detection', status: 'ANALYZING' },
  { id: 'neural', icon: '🧠', name: 'Neural Processing', status: 'COMPUTING' },
  { id: 'output', icon: '🎮', name: 'Steering Output', status: 'EXECUTING' },
]

function HeatmapCanvas({ type, color }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = 240
    canvas.height = 140

    const animate = () => {
      const t = Date.now() * 0.001
      ctx.fillStyle = 'rgba(10, 10, 15, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (type === 'heatmap') {
        for (let i = 0; i < 6; i++) {
          const x = canvas.width / 2 + Math.sin(t + i * 1.2) * 60
          const y = canvas.height / 2 + Math.cos(t * 0.7 + i) * 40
          const r = 30 + Math.sin(t * 2 + i) * 15
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
          gradient.addColorStop(0, `${color}88`)
          gradient.addColorStop(0.5, `${color}33`)
          gradient.addColorStop(1, 'transparent')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      } else if (type === 'attention') {
        ctx.strokeStyle = `${color}44`
        ctx.lineWidth = 1
        for (let i = 0; i < 8; i++) {
          const x = 20 + i * 28
          const y1 = canvas.height / 2 + Math.sin(t * 2 + i * 0.8) * 40
          ctx.beginPath()
          ctx.arc(x, y1, 8 + Math.sin(t + i) * 4, 0, Math.PI * 2)
          ctx.strokeStyle = `${color}${Math.floor(40 + Math.sin(t + i) * 30).toString(16).padStart(2, '0')}`
          ctx.fillStyle = `${color}22`
          ctx.fill()
          ctx.stroke()
        }
      } else if (type === 'path') {
        ctx.beginPath()
        ctx.moveTo(20, canvas.height - 20)
        for (let x = 20; x < canvas.width - 20; x += 2) {
          const progress = (x - 20) / (canvas.width - 40)
          const y = canvas.height - 20 - progress * (canvas.height - 40)
            + Math.sin(progress * 6 + t) * 15
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `${color}88`
        ctx.lineWidth = 2
        ctx.stroke()

        // Prediction cone
        const tipX = canvas.width - 40
        const tipY = 30 + Math.sin(t) * 10
        ctx.beginPath()
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(tipX + 30, tipY - 20)
        ctx.lineTo(tipX + 30, tipY + 20)
        ctx.closePath()
        ctx.fillStyle = `${color}22`
        ctx.fill()
        ctx.strokeStyle = `${color}44`
        ctx.stroke()
      } else if (type === 'timeline') {
        const barWidth = 12
        const gap = 4
        const total = Math.floor(canvas.width / (barWidth + gap))
        for (let i = 0; i < total; i++) {
          const h = 20 + Math.abs(Math.sin(t * 1.5 + i * 0.5)) * (canvas.height - 40)
          const x = i * (barWidth + gap) + 8
          const y = canvas.height - 10 - h
          ctx.fillStyle = `${color}${Math.floor(30 + Math.sin(t + i) * 20).toString(16).padStart(2, '0')}`
          ctx.fillRect(x, y, barWidth, h)
        }
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [type, color])

  return <canvas ref={canvasRef} className="heatmap-canvas" />
}

export default function ExplainableAI() {
  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage(prev => (prev + 1) % PIPELINE.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="explainable-ai">
      <div className="explainable-header">
        <h2 className="explainable-title">Explainable AI Pipeline</h2>
        <p className="explainable-desc">Real-time visualization of the neural decision-making process</p>
      </div>

      {/* Pipeline */}
      <div className="pipeline-container">
        {PIPELINE.map((stage, i) => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              className={`pipeline-stage ${i <= activeStage ? 'active' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="pipeline-stage-icon">{stage.icon}</div>
              <div className="pipeline-stage-name">{stage.name}</div>
              <div className="pipeline-stage-status">{stage.status}</div>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={`pipeline-arrow ${i < activeStage ? 'active' : ''}`}>
                →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* XAI Visualization Panels */}
      <div className="xai-panels">
        <div className="glass xai-panel">
          <div className="xai-panel-viz">
            <HeatmapCanvas type="heatmap" color="#ff2d55" />
          </div>
          <div className="xai-panel-title">Heatmap</div>
        </div>
        <div className="glass xai-panel">
          <div className="xai-panel-viz">
            <HeatmapCanvas type="attention" color="#00d4ff" />
          </div>
          <div className="xai-panel-title">Attention Map</div>
        </div>
        <div className="glass xai-panel">
          <div className="xai-panel-viz">
            <HeatmapCanvas type="path" color="#00ff88" />
          </div>
          <div className="xai-panel-title">Path Prediction</div>
        </div>
        <div className="glass xai-panel">
          <div className="xai-panel-viz">
            <HeatmapCanvas type="timeline" color="#ff9500" />
          </div>
          <div className="xai-panel-title">Decision Timeline</div>
        </div>
      </div>
    </div>
  )
}
