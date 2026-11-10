// Режим «Тактика»: бесконечная серия задач Lichess, подстраивающаяся под рейтинг.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Flame } from 'lucide-react'
import Coach, { useCoach } from '../components/Coach.jsx'
import ModeLayout, { Panel } from '../components/Layout.jsx'
import PuzzleSolver from '../components/PuzzleSolver.jsx'
import { api } from '../api.js'
import { say } from '../lib/coachLines.js'

const THEMES = [['', 'Все темы'], ['fork', 'Вилки'], ['pin', 'Связки'], ['mateIn2', 'Мат в 2 хода'], ['sacrifice', 'Жертвы'], ['endgame', 'Эндшпиль'], ['rookEndgame', 'Ладейные окончания']]

export default function Tactics({ profile, onProfile, initialTheme = '' }) {
  const coach = useCoach('Тактика — это 99% шахмат на твоём уровне. Найди лучший ход.')
  const [theme, setTheme] = useState(initialTheme)
  const [puzzle, setPuzzle] = useState(null)
  const [result, setResult] = useState(null) // null | true | false
  const [streak, setStreak] = useState(0)
  const [session, setSession] = useState({ solved: 0, total: 0 })
  const [error, setError] = useState('')
  const seen = useRef([])
  const ratingRef = useRef(profile?.estimated_rating || 1200)
  ratingRef.current = profile?.estimated_rating || ratingRef.current

  const loadNext = useCallback((th) => {
    setResult(null)
    api.nextPuzzle(ratingRef.current, seen.current.slice(-40), th)
      .then((p) => {
        seen.current.push(p.id)
        setPuzzle(p)
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    loadNext(theme)
  }, [theme, loadNext])

  const onDone = (solved) => {
    setResult(solved)
    setStreak((s) => (solved ? s + 1 : 0))
    setSession((s) => ({ solved: s.solved + (solved ? 1 : 0), total: s.total + 1 }))
    coach.say(say(solved ? 'puzzleSolved' : 'puzzleFailed') + (solved ? '' : ' Верный ход — красная стрелка.'), solved ? 'pleased' : 'skeptical')
    api.puzzleResult(puzzle.id, solved, true).then(onProfile).catch(() => {})
  }

  if (error) return <div className="text-red-400">Не удалось загрузить задачу: {error}</div>
  const toMove = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'чёрных' : 'белых') : ''

  return (
    <ModeLayout
      board={puzzle ? <PuzzleSolver key={puzzle.id} puzzle={puzzle} onDone={onDone} onProgress={(t) => coach.say(t, 'pleased')} /> : <div className="aspect-square bg-panel rounded-lg" />}
      side={
        <>
          <Panel><Coach coach={coach} /></Panel>
          <Panel title="Задача">
            {puzzle && (
              <div className="text-sm">
                <div className="text-base font-semibold mb-1">Ход {toMove}. Найдите лучшее продолжение.</div>
                <div className="text-neutral-400">Сложность задачи: {puzzle.rating} · ваш рейтинг: {profile?.estimated_rating}</div>
              </div>
            )}
            <div className="flex gap-4 mt-3 text-sm">
              <div><div className="text-2xl font-bold text-accent">{session.solved}/{session.total}</div><div className="text-xs text-neutral-400">решено за сессию</div></div>
              <div><div className="text-2xl font-bold flex items-center gap-1">{streak}<Flame size={18} className={streak >= 3 ? 'text-orange-400' : 'text-neutral-500'} /></div><div className="text-xs text-neutral-400">серия</div></div>
            </div>
            {result !== null && (
              <button type="button" className="btn btn-primary w-full mt-3" onClick={() => loadNext(theme)}>
                Следующая задача <ArrowRight size={16} />
              </button>
            )}
          </Panel>
          <Panel title="Тема">
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map(([id, label]) => (
                <button key={id} type="button" className={`btn !py-1 !px-2.5 text-xs ${theme === id ? 'btn-primary' : ''}`} onClick={() => setTheme(id)}>{label}</button>
              ))}
            </div>
          </Panel>
        </>
      }
    />
  )
}
