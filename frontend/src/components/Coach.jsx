// Блок тренера: аватар + облачко диалога с эффектом печати и кнопкой озвучки.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import FischerAvatar from './FischerAvatar.jsx'
import { speak, speechSupported, stopSpeaking } from '../lib/speech.js'

/**
 * Хук состояния тренера для режима.
 * say(text, mood) — произнести реплику и принять настроение после неё.
 */
export function useCoach(initialText = '', initialMood = 'idle') {
  const [state, setState] = useState({ text: initialText, mood: initialMood, id: 0 })
  const say = useCallback((text, mood = 'idle') => {
    setState((s) => ({ text, mood, id: s.id + 1 }))
  }, [])
  const setMood = useCallback((mood) => setState((s) => ({ ...s, mood })), [])
  return { ...state, say, setMood }
}

const AUTO_SPEAK_KEY = 'fcc-auto-speak'

/**
 * props: coach (из useCoach), thinking — движок считает (аватар «думает»).
 */
export default function Coach({ coach, thinking = false, children }) {
  const { text, mood, id } = coach
  const [shown, setShown] = useState(text)
  const [typing, setTyping] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem(AUTO_SPEAK_KEY) === '1')
  const autoRef = useRef(autoSpeak)
  autoRef.current = autoSpeak

  // Эффект печати: текст появляется по буквам, пока идёт — аватар «говорит»
  useEffect(() => {
    if (!text) {
      setShown('')
      return
    }
    setTyping(true)
    setShown('')
    let i = 0
    const step = Math.max(1, Math.ceil(text.length / 90))
    const timer = setInterval(() => {
      i += step
      setShown(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(timer)
        setTyping(false)
      }
    }, 22)
    if (autoRef.current) speak(text)
    return () => clearInterval(timer)
  }, [id, text])

  useEffect(() => () => stopSpeaking(), [])

  const toggleAuto = () => {
    const next = !autoSpeak
    setAutoSpeak(next)
    localStorage.setItem(AUTO_SPEAK_KEY, next ? '1' : '0')
    if (next) speak(text)
    else stopSpeaking()
  }

  const avatarMood = typing ? 'talking' : thinking ? 'thinking' : mood

  return (
    <div className="flex gap-3 items-start">
      <div className="shrink-0">
        <FischerAvatar mood={avatarMood} size={116} />
        <div className="text-center text-[11px] text-neutral-400 mt-1">Бобби Фишер</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="speech-bubble relative bg-neutral-100 text-neutral-900 rounded-xl px-3.5 py-3 text-[15px] leading-snug min-h-[92px]" aria-live="polite">
          {shown || <span className="text-neutral-400">…</span>}
          {typing && <span className="inline-block w-1.5 h-4 bg-neutral-500 ml-0.5 align-middle animate-pulse" />}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {speechSupported() && (
            <>
              <button type="button" onClick={() => speak(text)} className="btn-ghost text-xs" title="Озвучить реплику">
                <Volume2 size={14} /> Озвучить
              </button>
              <button type="button" onClick={toggleAuto} className={`btn-ghost text-xs ${autoSpeak ? 'text-accent' : ''}`} title="Автоматически озвучивать все реплики">
                {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />} Авто: {autoSpeak ? 'вкл' : 'выкл'}
              </button>
            </>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
