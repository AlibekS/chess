// Каркас приложения: боковое меню режимов + активный режим.
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Crosshair, Gauge, Home as HomeIcon, LineChart, Swords, Target, Zap } from 'lucide-react'
import { api } from './api.js'
import Calibration from './modes/Calibration.jsx'
import Guess from './modes/Guess.jsx'
import Home from './modes/Home.jsx'
import Openings from './modes/Openings.jsx'
import Play from './modes/Play.jsx'
import Review from './modes/Review.jsx'
import Tactics from './modes/Tactics.jsx'

const MODES = [
  { id: 'home', label: 'План тренировок', icon: HomeIcon },
  { id: 'calibration', label: 'Калибровка', icon: Gauge },
  { id: 'play', label: 'Игра с тренером', icon: Swords },
  { id: 'tactics', label: 'Тактика', icon: Zap },
  { id: 'openings', label: 'Дебюты Фишера', icon: BookOpen },
  { id: 'guess', label: 'Угадай ход Фишера', icon: Target },
  { id: 'review', label: 'Анализ', icon: LineChart },
]

export default function App() {
  const [profile, setProfile] = useState(null)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('home')
  const [params, setParams] = useState({}) // параметры перехода (партия для анализа, тема тактики)
  const [visit, setVisit] = useState(0) // меняется при каждом переходе — режим стартует заново

  useEffect(() => {
    Promise.all([api.profile(), api.health()])
      .then(([p, h]) => {
        setProfile(p)
        setHealth(h)
        // Первый запуск — сразу на калибровку
        if (!p.calibrated) setMode('calibration')
      })
      .catch((e) => setError(e.message))
  }, [])

  const navigate = useCallback((next, nextParams = {}) => {
    setMode(next)
    setParams(nextParams)
    setVisit((v) => v + 1)
  }, [])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-panel rounded-xl p-6 max-w-md text-center">
          <Crosshair className="mx-auto text-red-400 mb-2" />
          <h1 className="text-lg font-bold mb-1">Бэкенд недоступен</h1>
          <p className="text-sm text-neutral-300">Запустите сервер: <code className="bg-bg px-1.5 py-0.5 rounded">uvicorn app.main:app --port 8000</code> в каталоге <code>backend</code>.</p>
          <p className="text-xs text-neutral-500 mt-2">{error}</p>
        </div>
      </div>
    )
  }
  if (!profile) return <div className="h-full flex items-center justify-center text-neutral-400">Загрузка…</div>

  const common = { profile, onProfile: setProfile }
  let screen
  if (mode === 'calibration') screen = <Calibration key={visit} onDone={(p) => { setProfile(p); navigate('home') }} />
  else if (mode === 'play') screen = <Play key={visit} {...common} onReview={(id) => navigate('review', { gameId: id })} />
  else if (mode === 'tactics') screen = <Tactics key={visit} {...common} initialTheme={params.theme || ''} />
  else if (mode === 'openings') screen = <Openings key={visit} {...common} />
  else if (mode === 'guess') screen = <Guess key={visit} {...common} />
  else if (mode === 'review') screen = <Review key={visit} {...common} gameId={params.gameId} onNavigate={navigate} />
  else screen = <Home key={`${visit}-${profile.calibrated}-${profile.estimated_rating}`} {...common} health={health} onNavigate={navigate} />

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      {/* Боковое меню (на мобильных — горизонтальная лента сверху) */}
      <nav className="md:w-56 shrink-0 bg-[#171716] md:min-h-screen md:sticky md:top-0 md:self-start flex md:flex-col" aria-label="Режимы">
        <div className="hidden md:block px-4 pt-4 pb-3">
          <div className="text-lg font-extrabold leading-tight"><span className="text-accent">Fischer</span> Chess Coach</div>
          <div className="text-xs text-neutral-500">персональный тренажёр</div>
        </div>
        <div className="flex md:flex-col overflow-x-auto md:overflow-visible flex-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => navigate(id)} aria-current={mode === id ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors border-b-2 md:border-b-0 md:border-l-4 ${
                mode === id ? 'bg-panel text-white border-accent' : 'text-neutral-400 hover:text-white hover:bg-white/5 border-transparent'}`}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        <div className="hidden md:block px-4 py-3 mt-auto border-t border-white/5">
          <div className="text-sm font-semibold truncate">{profile.username}</div>
          <div className="text-xs text-neutral-400">Рейтинг: <b className="text-accent">{profile.estimated_rating}</b></div>
        </div>
      </nav>
      <main className="flex-1 min-w-0 p-3 md:p-5">{screen}</main>
    </div>
  )
}
