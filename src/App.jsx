import { useState, useCallback, useEffect } from 'react'
import LoadingScreen from './components/LoadingScreen'
import IntroVideo from './components/IntroVideo'
import LandingPage from './components/LandingPage'
import Navigation from './components/Navigation'
import TrainingCenter from './components/TrainingCenter'
import ExplainableAI from './components/ExplainableAI'
import RaceArena from './components/RaceArena'
import Analytics from './components/Analytics'
import LearningViz from './components/LearningViz'
import './App.css'

const SECTIONS = ['training', 'learning', 'explainable', 'race', 'analytics']

export default function App() {
  const [appStage, setAppStage] = useState('loading') // 'loading', 'intro', 'landing', 'main'
  const [section, setSection] = useState('training')
  const [raceData, setRaceData] = useState(null)

  useEffect(() => {
    if (appStage === 'loading') {
      const timer = setTimeout(() => {
        setAppStage('intro')
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [appStage])

  const handleSkipIntro = useCallback(() => setAppStage('landing'), [])
  const handleEnterSimulation = useCallback(() => setAppStage('main'), [])

  const handleRaceEnd = useCallback((data) => {
    setRaceData(data)
    setSection('analytics')
  }, [])

  return (
    <div className="app-container">
      {appStage === 'loading' && <LoadingScreen />}
      
      {appStage === 'intro' && (
        <IntroVideo onVideoEnd={handleSkipIntro} />
      )}
      
      {appStage === 'landing' && (
        <LandingPage onEnter={handleEnterSimulation} />
      )}

      {appStage === 'main' && (
        <>
          <Navigation active={section} onChange={setSection} />
          <main className="main-content">
            {section === 'training' && <TrainingCenter />}
            {section === 'learning' && <LearningViz />}
            {section === 'explainable' && <ExplainableAI />}
            {section === 'race' && <RaceArena onRaceEnd={handleRaceEnd} />}
            {section === 'analytics' && <Analytics data={raceData} />}
          </main>
        </>
      )}
    </div>
  )
}
