import { useState, useRef, useEffect } from 'react'

export default function IntroVideo({ onVideoEnd }) {
  const [isFadingOut, setIsFadingOut] = useState(false)
  const videoRef = useRef(null)

  const handleSkipOrEnd = () => {
    if (isFadingOut) return
    setIsFadingOut(true)
    
    // Smooth cinematic fade out transition (1.5s)
    setTimeout(() => {
      onVideoEnd()
    }, 1500)
  }

  return (
    <div className={`intro-video-wrapper ${isFadingOut ? 'cinematic-fade-out' : 'cinematic-fade-in'}`}>
      {/* 
        ========================================================================
        MANUAL VIDEO REPLACEMENT
        Replace the default file with your own F1 intro video at:
        public/videos/neuraldrive_intro.mp4
        
        The system will automatically load and play it fullscreen.
        If the file is missing, the onError handler will skip directly to the landing page.
        ========================================================================
      */}
      <video
        ref={videoRef}
        className="intro-video-player"
        src="/videos/neuraldrive_intro.mp4"
        autoPlay
        muted // You can change to false if you want audio
        playsInline
        onEnded={handleSkipOrEnd}
        onError={handleSkipOrEnd} // Failsafe if video is missing
      />
      
      <button className="skip-intro-btn" onClick={handleSkipOrEnd}>
        SKIP INTRO
      </button>
    </div>
  )
}
