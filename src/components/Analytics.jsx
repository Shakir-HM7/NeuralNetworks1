import { useMemo } from 'react'

const DEFAULT_DATA = {
  bestLap: '1:28.342',
  avgSpeed: 167,
  topSpeed: 224,
  collisions: 3,
  cornerAccuracy: 82,
  totalTime: '4:31.876',
  cars: [
    { name: 'SHAKIR', laps: 3, bestLap: '1:28.342', topSpeed: 224, isPlayer: true },
    { name: 'Neural-X Prime', laps: 3, bestLap: '1:24.517', topSpeed: 231, isPlayer: false },
    { name: 'Neural-X V2', laps: 3, bestLap: '1:31.092', topSpeed: 215, isPlayer: false },
    { name: 'Neural-X V1', laps: 3, bestLap: '1:42.661', topSpeed: 189, isPlayer: false },
  ]
}

export default function Analytics({ data }) {
  const d = data || DEFAULT_DATA

  const sortedCars = useMemo(() =>
    [...d.cars].sort((a, b) => {
      const timeA = a.bestLap === '--' ? Infinity : parseFloat(a.bestLap.replace(/[:]/g, ''))
      const timeB = b.bestLap === '--' ? Infinity : parseFloat(b.bestLap.replace(/[:]/g, ''))
      return timeA - timeB
    }), [d.cars])

  const bestLapOverall = sortedCars[0]?.bestLap
  const bestSpeedOverall = Math.max(...sortedCars.map(c => c.topSpeed))

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h2 className="analytics-title">Race Analytics</h2>
        <p className="analytics-sub">Performance breakdown — Human vs AI</p>
      </div>

      {/* KPI Cards */}
      <div className="analytics-grid">
        {[
          { label: 'Best Lap', value: d.bestLap, unit: 'TIME' },
          { label: 'Avg Speed', value: d.avgSpeed, unit: 'KM/H' },
          { label: 'Top Speed', value: d.topSpeed, unit: 'KM/H' },
          { label: 'Collisions', value: d.collisions, unit: 'TOTAL' },
          { label: 'Corner Accuracy', value: `${d.cornerAccuracy}%`, unit: 'PRECISION' },
        ].map((card, i) => (
          <div key={i} className="glass analytics-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="analytics-card-label">{card.label}</div>
            <div className="analytics-card-value">{card.value}</div>
            <div className="analytics-card-unit">{card.unit}</div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="glass analytics-comparison" style={{ padding: 24, borderRadius: 16 }}>
        <div className="comparison-title">Human vs AI Comparison</div>
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Driver</th>
              <th>Laps</th>
              <th>Best Lap</th>
              <th>Top Speed</th>
            </tr>
          </thead>
          <tbody>
            {sortedCars.map((car, i) => (
              <tr key={car.name}>
                <td style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                  {i + 1}
                </td>
                <td className={car.isPlayer ? 'driver-human' : 'driver-ai'}>
                  {car.isPlayer ? '🏎️ ' : '🤖 '}{car.name}
                </td>
                <td>{car.laps}</td>
                <td className={car.bestLap === bestLapOverall ? 'best' : ''}>
                  {car.bestLap}
                </td>
                <td className={car.topSpeed === bestSpeedOverall ? 'best' : ''}>
                  {car.topSpeed} km/h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Performance Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
          <div className="comparison-title" style={{ color: 'var(--neon-orange)' }}>
            Human Driver Analysis
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2.2 }}>
            <div>Total Time: <span style={{ color: '#fff' }}>{d.totalTime}</span></div>
            <div>Consistency: <span style={{ color: 'var(--neon-green)' }}>
              {d.cornerAccuracy > 80 ? 'High' : d.cornerAccuracy > 60 ? 'Medium' : 'Low'}
            </span></div>
            <div>Aggression Index: <span style={{ color: 'var(--neon-orange)' }}>
              {d.collisions > 5 ? 'Aggressive' : d.collisions > 2 ? 'Moderate' : 'Clean'}
            </span></div>
            <div>Speed Utilization: <span style={{ color: 'var(--neon-blue)' }}>
              {Math.round((d.avgSpeed / d.topSpeed) * 100)}%
            </span></div>
          </div>
        </div>

        <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
          <div className="comparison-title" style={{ color: 'var(--neon-blue)' }}>
            AI Performance Summary
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2.2 }}>
            <div>Best AI Model: <span style={{ color: 'var(--neon-purple)' }}>Neural-X Prime</span></div>
            <div>AI Fastest Lap: <span style={{ color: 'var(--neon-green)' }}>{sortedCars.find(c => !c.isPlayer)?.bestLap || '--'}</span></div>
            <div>Models Deployed: <span style={{ color: '#fff' }}>3</span></div>
            <div>Learning Rate: <span style={{ color: 'var(--neon-blue)' }}>3e-4</span></div>
            <div>Training Epochs: <span style={{ color: '#fff' }}>1,247</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
