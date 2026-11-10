// Режим «Угадай ход Фишера»: реальная партия воспроизводится до ключевого
// момента, дальше пользователь ищет ходы Фишера.
//   ход Фишера                 — +10 очков и цитата;
//   первая линия движка        — +7 («я сыграл острее»);
//   остальное                  — 0 и разбор.
import { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { ArrowLeft, SkipForward, Trophy } from 'lucide-react'
import Board from '../components/Board.jsx'
import Coach, { useCoach } from '../components/Coach.jsx'
import ModeLayout, { Panel } from '../components/Layout.jsx'
import MoveList from '../components/MoveList.jsx'
import { api } from '../api.js'
import { engine } from '../lib/engine.js'
import { describeRefutation, toUci } from '../lib/chessUtil.js'
import { randomQuote, say } from '../lib/coachLines.js'

const side = (cpWhite, color) => (color === 'w' ? cpWhite : -cpWhite)

function Session({ game, onBack, onProfile }) {
  const coach = useCoach(`${game.title}. ${game.ref.charAt(0).toUpperCase() + game.ref.slice(1)}. Я играю ${game.fischer_color === 'w' ? 'белыми' : 'чёрными'}. Найди мой ход.`)
  const chessRef = useRef(null)
  const [ply, setPly] = useState(game.start_ply)
  const [fen, setFen] = useState('')
  const [lastMove, setLastMove] = useState(null)
  const [busy, setBusy] = useState(false)
  const [score, setScore] = useState(0)
  const [guesses, setGuesses] = useState(0)
  const [exact, setExact] = useState(0)
  const [finished, setFinished] = useState(false)
  const [arrow, setArrow] = useState(null)
  const prep = useRef(null)
  const alive = useRef(true)
  const total = game.moves.length
  const color = game.fischer_color

  // Доводим партию до стартовой позиции
  useEffect(() => {
    alive.current = true
    const chess = new Chess()
    let mv = null
    for (let i = 0; i < game.start_ply; i++) mv = chess.move(game.moves[i])
    chessRef.current = chess
    setFen(chess.fen())
    setLastMove(mv ? [mv.from, mv.to] : null)
    prep.current = engine.analyze(chess.fen())
    return () => {
      alive.current = false
    }
  }, [game])

  const finish = (finalScore, finalGuesses, finalExact) => {
    setFinished(true)
    const max = finalGuesses * 10
    const pct = max ? Math.round((100 * finalScore) / max) : 0
    let verdict
    if (!finalGuesses) verdict = 'Ты даже не попробовал. Так не учатся.'
    else if (pct >= 75) verdict = 'Отлично. Ты понимаешь, как я играл.'
    else if (pct >= 50) verdict = 'Неплохо. Но половина ходов — не мои. Разбирай партию ещё раз.'
    else verdict = 'Слабо. Переиграй партию и думай над каждым ходом дольше.'
    coach.say(`Итог: ${finalScore} из ${max} очков, моих ходов угадано ${finalExact} из ${finalGuesses}. ${verdict}`, pct >= 75 ? 'pleased' : pct >= 50 ? 'idle' : 'skeptical')
    if (finalScore > 0) api.guessScore(finalScore).then(onProfile).catch(() => {})
  }

  /** Показывает на доске настоящий ход Фишера и ответ соперника, готовит следующий вопрос. */
  const advance = async (fromPly, newScore, newGuesses, newExact) => {
    const chess = chessRef.current
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const fm = chess.move(game.moves[fromPly])
    setFen(chess.fen())
    setLastMove([fm.from, fm.to])
    let next = fromPly + 1
    if (next < total) {
      await wait(700)
      if (!alive.current) return
      const om = chess.move(game.moves[next])
      setFen(chess.fen())
      setLastMove([om.from, om.to])
      next += 1
    }
    setArrow(null)
    setPly(next)
    if (next >= total) {
      finish(newScore, newGuesses, newExact)
    } else {
      prep.current = engine.analyze(chess.fen())
    }
    setBusy(false)
  }

  const onMove = (m) => {
    if (busy || finished) return false
    const chess = chessRef.current
    const fenBefore = chess.fen()
    let move
    try {
      move = chess.move(m)
    } catch {
      return false
    }
    const fenAfter = chess.fen()
    const fischerSan = game.moves[ply]
    setBusy(true)
    setFen(fenAfter)
    setLastMove([move.from, move.to])

    ;(async () => {
      let points = 0
      let isExact = false
      if (move.san === fischerSan) {
        points = 10
        isExact = true
        const q = randomQuote()
        coach.say(`${say('guessRight')} +10. «${q.text}» — Р. Фишер, ${q.source}${q.note ? ` (${q.note})` : ''}.`, 'pleased')
      } else {
        coach.setMood('thinking')
        const before = await prep.current
        const over = chess.isGameOver()
        const after = over ? { cp: chess.isCheckmate() ? (color === 'w' ? 10000 : -10000) : 0 } : await engine.analyze(fenAfter)
        if (!alive.current) return
        const loss = side(before.cp, color) - side(after.cp, color)
        const fischerMove = new Chess(fenBefore).move(fischerSan)
        setArrow({ from: fischerMove.from, to: fischerMove.to, type: 'success' })
        if (toUci(move) === before.bestmove || loss <= 10) {
          points = 7
          coach.say(`${say('guessEngine')} +7. В партии было ${fischerSan}.`, 'idle')
        } else if (loss < 80) {
          coach.say(`${say('guessOk')} 0 очков. Я сыграл ${fischerSan}.`, 'idle')
        } else {
          const why = after.bestmove ? ' ' + describeRefutation(fenAfter, after.bestmove, after.mate !== undefined && side(after.cp, color) < 0 ? Math.abs(after.mate) : null) : ''
          coach.say(`${say('guessWrong')}${why} Я сыграл ${fischerSan}.`, 'skeptical')
        }
        // Возвращаем позицию и показываем ход Фишера
        await new Promise((r) => setTimeout(r, 1100))
        if (!alive.current) return
        chess.undo()
        setFen(chess.fen())
      }
      if (isExact) chess.undo() // advance сам сделает ход Фишера
      const ns = score + points
      const ng = guesses + 1
      const ne = exact + (isExact ? 1 : 0)
      setScore(ns)
      setGuesses(ng)
      setExact(ne)
      advance(ply, ns, ng, ne)
    })()
    return true
  }

  return (
    <ModeLayout
      board={<Board fen={fen || new Chess().fen()} orientation={color} movable={!busy && !finished && fen ? color : null} onMove={onMove} lastMove={lastMove} arrows={arrow ? [arrow] : []} />}
      side={
        <>
          <Panel><Coach coach={coach} thinking={busy} /></Panel>
          <Panel title="Партия">
            <div className="font-semibold">{game.pairing}</div>
            <div className="text-sm text-neutral-400">{game.ref}</div>
            {game.opening_ru && <div className="text-sm text-neutral-400">{game.opening_ru} ({game.eco})</div>}
            <div className="flex gap-4 mt-3 text-sm">
              <div><div className="text-2xl font-bold text-accent">{score}</div><div className="text-xs text-neutral-400">очков из {guesses * 10}</div></div>
              <div><div className="text-2xl font-bold">{exact}/{guesses}</div><div className="text-xs text-neutral-400">ходов Фишера</div></div>
              <div><div className="text-2xl font-bold">{Math.max(0, Math.ceil((total - ply) / 2))}</div><div className="text-xs text-neutral-400">осталось</div></div>
            </div>
          </Panel>
          <Panel title="Нотация">
            <MoveList sans={game.moves} current={ply - 1} hiddenFrom={finished ? undefined : ply} maxHeight={180} />
          </Panel>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" onClick={onBack}><ArrowLeft size={15} /> К партиям</button>
            {!finished && (
              <button type="button" className="btn flex-1" disabled={busy} onClick={() => finish(score, guesses, exact)}>
                <SkipForward size={15} /> Завершить
              </button>
            )}
          </div>
        </>
      }
    />
  )
}

export default function Guess({ profile, onProfile }) {
  const [games, setGames] = useState(null)
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.guessGames().then(setGames).catch((e) => setError(e.message))
  }, [])

  if (game) return <Session key={game.id} game={game} onBack={() => setGame(null)} onProfile={onProfile} />
  if (error) return <div className="text-red-400">Не удалось загрузить партии: {error}</div>
  if (!games) return <div className="text-neutral-400">Загрузка партий…</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Угадай ход Фишера</h2>
          <p className="text-neutral-400 text-sm">{games.length} лучших партий. Ход Фишера — 10 очков, первая линия движка — 7.</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm"><Trophy size={16} className="text-accent" /> Всего очков: <b className="text-accent">{profile?.guess_points ?? 0}</b></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <button key={g.id} type="button" onClick={() => api.guessGame(g.id).then(setGame).catch((e) => setError(e.message))}
            className="text-left bg-panel hover:bg-panel-2 rounded-xl p-3 transition-colors cursor-pointer">
            <div className="font-semibold leading-tight">{g.title}</div>
            <div className="text-sm text-neutral-300 mt-0.5">{g.pairing}</div>
            <div className="text-xs text-neutral-400 mt-1">{g.ref}</div>
            <div className="text-xs text-neutral-400">{g.opening_ru}{g.opening_ru ? ' · ' : ''}{g.moves_count} ход. · {g.result}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
