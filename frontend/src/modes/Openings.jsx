// Режим «Дебюты Фишера»: тренажёр репертуара.
//  «Учить»    — правильный ход показан стрелкой;
//  «Проверка» — ходы нужно вводить самому, ошибки считаются.
// Статистика Фишера в каждой позиции приходит с бэкенда (из базы партий).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { ArrowLeft, Check, Eye, GraduationCap, RotateCcw } from 'lucide-react'
import Board from '../components/Board.jsx'
import Coach, { useCoach } from '../components/Coach.jsx'
import ModeLayout, { Panel } from '../components/Layout.jsx'
import MoveList from '../components/MoveList.jsx'
import { api } from '../api.js'
import { START_FEN } from '../lib/chessUtil.js'
import { say } from '../lib/coachLines.js'

function StatsLine({ stats }) {
  if (!stats || !stats.games) {
    return <span className="text-neutral-500">В базе нет партий Фишера с этой позицией.</span>
  }
  return (
    <span>
      У Фишера эта позиция была в <b>{stats.games}</b> парт. · +{stats.wins} ={stats.draws} −{stats.losses} ·{' '}
      побед <b className="text-accent">{stats.win_pct}%</b>, очков {stats.score_pct}%
    </span>
  )
}

function Trainer({ line, onBack, onProfile, onProgress }) {
  const coach = useCoach(`«${line.title}». ${line.side === 'w' ? 'Ты играешь белыми.' : 'Ты играешь чёрными.'} Поехали.`)
  const [mode, setMode] = useState('learn') // learn | test
  const [ply, setPly] = useState(0) // сколько ходов линии уже на доске
  const [fen, setFen] = useState(START_FEN)
  const [lastMove, setLastMove] = useState(null)
  const [errors, setErrors] = useState(0)
  const [missesHere, setMissesHere] = useState(0)
  const [usedHints, setUsedHints] = useState(false)
  const [done, setDone] = useState(false)
  const chessRef = useRef(new Chess())
  const total = line.moves.length
  const userParity = line.side === 'w' ? 0 : 1
  const userTurn = !done && ply < total && ply % 2 === userParity

  const reset = (nextMode = mode) => {
    chessRef.current = new Chess()
    setMode(nextMode)
    setPly(0)
    setFen(START_FEN)
    setLastMove(null)
    setErrors(0)
    setMissesHere(0)
    setUsedHints(false)
    setDone(false)
    coach.say(nextMode === 'learn' ? 'Смотри на стрелку и запоминай идею, а не только ход.' : 'Теперь без подсказок. Покажи, что запомнил.')
  }

  const pushMove = (index) => {
    const mv = chessRef.current.move(line.moves[index].san)
    setFen(chessRef.current.fen())
    setLastMove([mv.from, mv.to])
    setPly(index + 1)
    return mv
  }

  // Ход соперника делается автоматически
  useEffect(() => {
    if (done || ply >= total || ply % 2 === userParity) return
    const t = setTimeout(() => {
      pushMove(ply)
      const c = line.moves[ply].comment
      if (c) coach.say(c)
    }, 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply, done])

  // Конец линии
  useEffect(() => {
    if (done || ply < total) return
    setDone(true)
    const withHints = mode === 'learn' || usedHints
    api.repertoireAttempt(line.id, errors, withHints)
      .then((res) => {
        onProfile?.(res.profile)
        onProgress?.()
      })
      .catch(() => {})
    const last = line.moves[total - 1].comment
    const tail = !withHints && errors === 0 ? say('openingPerfect') : say('openingDone')
    setTimeout(() => coach.say(`${last ? last + ' ' : ''}${tail}`, !withHints && errors === 0 ? 'pleased' : 'idle'), 900)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply, done])

  // Правильный ход в текущей позиции (для стрелки)
  const expected = useMemo(() => {
    if (!userTurn) return null
    const probe = new Chess(fen)
    try {
      return probe.move(line.moves[ply].san)
    } catch {
      return null
    }
  }, [fen, ply, userTurn, line])

  const onMove = (m) => {
    if (!userTurn || !expected) return false
    const ok = m.from === expected.from && m.to === expected.to
    if (!ok) {
      setErrors((e) => e + 1)
      setMissesHere((n) => n + 1)
      if (missesHere + 1 >= 2) setUsedHints(true) // после двух промахов показываем стрелку
      coach.say(say('openingWrong'), 'skeptical')
      return false
    }
    pushMove(ply)
    setMissesHere(0)
    const c = line.moves[ply].comment
    coach.say(c || say('openingRight'), 'pleased')
    return true
  }

  const showArrow = userTurn && expected && (mode === 'learn' || missesHere >= 2)
  const stats = ply > 0 ? line.moves[ply - 1].stats : null

  return (
    <ModeLayout
      board={
        <Board fen={fen} orientation={line.side} movable={userTurn ? line.side : null} onMove={onMove} lastMove={lastMove}
          arrows={showArrow ? [{ from: expected.from, to: expected.to, type: 'success' }] : []} />
      }
      side={
        <>
          <Panel><Coach coach={coach} /></Panel>
          <Panel title={line.group}>
            <div className="font-semibold mb-2">{line.title}</div>
            <div className="flex gap-2 mb-3">
              <button type="button" className={`btn flex-1 ${mode === 'learn' ? 'btn-primary' : ''}`} onClick={() => reset('learn')}>
                <Eye size={15} /> Учить
              </button>
              <button type="button" className={`btn flex-1 ${mode === 'test' ? 'btn-primary' : ''}`} onClick={() => reset('test')}>
                <GraduationCap size={15} /> Проверка
              </button>
            </div>
            <div className="h-2 bg-bg rounded overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${(ply / total) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-neutral-400 mt-1">
              <span>Ход {Math.ceil(ply / 2)} из {Math.ceil(total / 2)}</span>
              <span>Ошибок: {errors}</span>
            </div>
          </Panel>
          <Panel title="Статистика Фишера в этой позиции">
            <div className="text-sm">{ply === 0 ? <span className="text-neutral-500">Сделайте первый ход — статистика появится по ходу линии.</span> : <StatsLine stats={stats} />}</div>
          </Panel>
          <Panel title="Линия">
            <MoveList sans={line.moves.map((m) => m.san)} current={ply - 1} hiddenFrom={mode === 'test' ? ply : undefined} maxHeight={170} />
          </Panel>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" onClick={onBack}><ArrowLeft size={15} /> К списку</button>
            <button type="button" className="btn flex-1" onClick={() => reset()}><RotateCcw size={15} /> Заново</button>
          </div>
        </>
      }
    />
  )
}

export default function Openings({ onProfile }) {
  const [lines, setLines] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

  const refresh = () => api.repertoire().then(setLines).catch((e) => setError(e.message))
  useEffect(() => {
    refresh()
  }, [])

  if (selected) {
    const line = lines.find((l) => l.id === selected)
    return <Trainer key={line.id} line={line} onBack={() => setSelected(null)} onProfile={onProfile} onProgress={refresh} />
  }
  if (error) return <div className="text-red-400">Не удалось загрузить репертуар: {error}</div>
  if (!lines) return <div className="text-neutral-400">Загрузка репертуара…</div>

  const doneCount = lines.filter((l) => l.progress.completed > 0).length
  const sides = [['w', 'За белых: 1. e4 — «лучшее по результатам»'], ['b', 'За чёрных: Найдорф, староиндийская, Грюнфельд']]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Дебюты Фишера</h2>
          <p className="text-neutral-400 text-sm">Репертуар одиннадцатого чемпиона мира. Проценты — из его реальных партий.</p>
        </div>
        <div className="text-sm text-neutral-300">Пройдено без подсказок: <b className="text-accent">{doneCount}</b> из {lines.length}</div>
      </div>
      {sides.map(([side, heading]) => {
        const groups = [...new Set(lines.filter((l) => l.side === side).map((l) => l.group))]
        return (
          <section key={side} className="mb-6">
            <h3 className="text-lg font-semibold mb-2">{heading}</h3>
            {groups.map((group) => (
              <div key={group} className="mb-3">
                <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1.5">{group}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {lines.filter((l) => l.side === side && l.group === group).map((l) => (
                    <button key={l.id} type="button" onClick={() => setSelected(l.id)}
                      className="text-left bg-panel hover:bg-panel-2 rounded-xl p-3 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{l.title}</span>
                        {l.progress.completed > 0 && <Check size={18} className="text-accent shrink-0" />}
                      </div>
                      <div className="text-xs text-neutral-400 mt-1 font-mono truncate">
                        {l.moves.slice(0, 10).map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m.san}` : m.san)).join(' ')}…
                      </div>
                      <div className="text-xs mt-1.5 text-neutral-300">
                        {l.key_stats.games
                          ? <>Фишер после {l.key_stats.after}: {l.key_stats.games} парт., побед <b className="text-accent">{l.key_stats.win_pct}%</b> (+{l.key_stats.wins} ={l.key_stats.draws} −{l.key_stats.losses})</>
                          : 'Эта позиция в партиях Фишера не встречалась'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
