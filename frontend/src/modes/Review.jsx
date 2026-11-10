// Режим «Анализ» (Game Review): разбор партии движком, график преимущества,
// классификация ходов и итоговый вердикт тренера с рекомендацией.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, Upload } from 'lucide-react'
import Board from '../components/Board.jsx'
import Coach, { useCoach } from '../components/Coach.jsx'
import EvalBar from '../components/EvalBar.jsx'
import ModeLayout, { Panel } from '../components/Layout.jsx'
import MoveList from '../components/MoveList.jsx'
import { api } from '../api.js'
import { engine } from '../lib/engine.js'
import {
  CLASS_ORDER, CLASSES, classifyMove, describeRefutation, gamePhase, parseUci, toUci, uciToSan, winPercent,
} from '../lib/chessUtil.js'

const side = (cpWhite, color) => (color === 'w' ? cpWhite : -cpWhite)

/** Полный анализ партии: оценка каждой позиции + классификация каждого хода. */
async function analyzeGame(pgn, onProgress, isCancelled) {
  const chess = new Chess()
  chess.loadPgn(pgn)
  const moves = chess.history({ verbose: true })
  const fens = [moves.length ? moves[0].before : chess.fen(), ...moves.map((m) => m.after)]
  const evals = []
  for (let i = 0; i < fens.length; i++) {
    if (isCancelled()) return null
    const pos = new Chess(fens[i])
    if (pos.isCheckmate()) evals.push({ cp: pos.turn() === 'w' ? -10000 : 10000, mate: 0, bestmove: null, pv: [] })
    else if (pos.isGameOver()) evals.push({ cp: 0, bestmove: null, pv: [] })
    else evals.push(await engine.analyze(fens[i], { depth: 14, movetime: 1500 }))
    onProgress((i + 1) / fens.length)
  }
  const records = moves.map((move, i) => {
    const color = move.color
    const isBest = toUci(move) === evals[i].bestmove
    const cpBefore = side(evals[i].cp, color)
    const raw = side(evals[i + 1].cp, color)
    const cpAfter = isBest ? Math.max(raw, cpBefore - 5) : raw
    return {
      ply: i, san: move.san, color, move, fenBefore: fens[i], fenAfter: fens[i + 1], isBest,
      bestUci: evals[i].bestmove, reply: evals[i + 1].bestmove,
      opponentMate: evals[i + 1].mate !== undefined && raw < 0 ? Math.abs(evals[i + 1].mate) : null,
      phase: gamePhase(fens[i], i),
      ...classifyMove({ cpBefore, cpAfter, isBest, fenBefore: fens[i], move }),
    }
  })
  return { fens, evals, records, sans: moves.map((m) => m.san) }
}

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

/** Сводка по стороне: точность, счётчики классов, слабая фаза. */
function summarize(records, color) {
  const mine = records.filter((r) => r.color === color)
  const counts = Object.fromEntries(CLASS_ORDER.map((k) => [k, mine.filter((r) => r.cls === k).length]))
  const phases = {}
  for (const ph of ['opening', 'middlegame', 'endgame']) {
    const part = mine.filter((r) => r.phase === ph)
    phases[ph] = { moves: part.length, avgDrop: mean(part.map((r) => r.drop)) }
  }
  return { accuracy: mean(mine.map((r) => r.accuracy)), counts, phases, moves: mine.length }
}

/** Вердикт тренера: общая оценка + худший ход + персональная рекомендация. */
function buildVerdict(records, color) {
  const s = summarize(records, color)
  if (!s.moves) return { text: 'В этой партии нечего разбирать.', mood: 'idle', action: null }
  const acc = Math.round(s.accuracy)
  let head
  let mood = 'idle'
  if (acc >= 90) { head = `Точность ${acc}%. Сильная партия — так и держи.`; mood = 'pleased' }
  else if (acc >= 78) head = `Точность ${acc}%. Неплохо, но до настоящей игры ещё работать.`
  else if (acc >= 62) { head = `Точность ${acc}%. Средне: слишком много подарков сопернику.`; mood = 'skeptical' }
  else { head = `Точность ${acc}%. Слабо. Так партии не выигрывают.`; mood = 'skeptical' }

  const bad = s.counts.blunder + s.counts.mistake
  if (bad) head += ` Зевков: ${s.counts.blunder}, ошибок: ${s.counts.mistake}.`

  const worst = records.filter((r) => r.color === color).sort((a, b) => b.drop - a.drop)[0]
  let worstText = ''
  if (worst && worst.drop > 10) {
    const no = Math.floor(worst.ply / 2) + 1
    worstText = ` Худший ход — ${no}${worst.color === 'w' ? '.' : '…'} ${worst.san}.`
    if (worst.reply) worstText += ' ' + describeRefutation(worst.fenAfter, worst.reply, worst.opponentMate)
  }

  // Слабая фаза: где в среднем терялось больше всего (нужно хотя бы 3 хода в фазе)
  const ranked = Object.entries(s.phases).filter(([, v]) => v.moves >= 3).sort((a, b) => b[1].avgDrop - a[1].avgDrop)
  let advice = ' Продолжай в том же духе и повышай рейтинг соперника.'
  let action = { mode: 'play', label: 'Сыграть ещё партию' }
  if (ranked.length && ranked[0][1].avgDrop > 2.5) {
    const phase = ranked[0][0]
    if (phase === 'opening') {
      advice = ' Дебют ты разыгрываешь слабо: теряешь темпы раньше, чем фигуры вышли в игру. Сегодня учим линии.'
      action = { mode: 'openings', label: 'Открыть «Дебюты Фишера»' }
    } else if (phase === 'middlegame') {
      advice = ' Главная беда — миттельшпиль: ты зеваешь тактику. Задачи каждый день, пока не перестанешь.'
      action = { mode: 'tactics', label: 'Решать тактику' }
    } else {
      advice = ' У тебя хромает эндшпиль. Мы повторим ладейные окончания сегодня же.'
      action = { mode: 'tactics', theme: 'endgame', label: 'Тренировать эндшпиль' }
    }
  }
  return { text: head + worstText + advice, mood, action, accuracy: s.accuracy }
}

/** График преимущества: шансы белых по ходам, клик — переход к позиции. */
function EvalGraph({ evals, records, current, onSelect }) {
  const W = 600
  const H = 90
  const n = evals.length
  const x = (i) => (n > 1 ? (i / (n - 1)) * W : 0)
  const y = (cp) => H - (winPercent(cp) / 100) * H
  const line = evals.map((e, i) => `${x(i).toFixed(1)},${y(e.cp).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24 rounded bg-[#403d39] cursor-pointer" preserveAspectRatio="none"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onSelect(Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)) - 1)
      }}>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill="#f1f1f1" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#888" strokeWidth="1" strokeDasharray="4 4" />
      {records.filter((r) => ['mistake', 'blunder', 'brilliant'].includes(r.cls)).map((r) => (
        <circle key={r.ply} cx={x(r.ply + 1)} cy={y(evals[r.ply + 1].cp)} r="4" fill={CLASSES[r.cls].color} stroke="#1e1e1e" strokeWidth="1" />
      ))}
      <line x1={x(current + 1)} x2={x(current + 1)} y1="0" y2={H} stroke="#81b64c" strokeWidth="2" />
    </svg>
  )
}

export default function Review({ gameId, profile, onNavigate }) {
  const coach = useCoach('Покажи партию. Разберём каждый ход — без скидок.')
  const [games, setGames] = useState([])
  const [source, setSource] = useState(null) // { id?, pgn, userColor }
  const [progress, setProgress] = useState(0)
  const [data, setData] = useState(null)
  const [current, setCurrent] = useState(-1) // индекс последнего сделанного полухода
  const [pasted, setPasted] = useState('')
  const [pastedColor, setPastedColor] = useState('w')
  const [error, setError] = useState('')
  const runId = useRef(0)

  useEffect(() => {
    api.games().then(setGames).catch(() => {})
  }, [])

  const load = useCallback(async (src) => {
    const id = ++runId.current
    setSource(src)
    setData(null)
    setProgress(0)
    setCurrent(-1)
    setError('')
    coach.say('Считаю варианты. Подожди.', 'thinking')
    try {
      const result = await analyzeGame(src.pgn, (p) => id === runId.current && setProgress(p), () => id !== runId.current)
      if (!result || id !== runId.current) return
      const verdict = buildVerdict(result.records, src.userColor)
      setData({ ...result, verdict })
      setCurrent(result.sans.length - 1)
      coach.say(verdict.text, verdict.mood)
      if (src.id) api.patchGame(src.id, { accuracy: Math.round(verdict.accuracy * 10) / 10, coach_summary: verdict.text }).catch(() => {})
    } catch (e) {
      setError('Не удалось разобрать партию: ' + e.message)
      setSource(null)
    }
  }, [coach])

  // Переход из «Игры с тренером»: сразу открываем нужную партию
  useEffect(() => {
    if (!gameId) return
    api.game(gameId).then((g) => load({ id: g.id, pgn: g.pgn, userColor: g.user_color })).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  const importPgn = async () => {
    setError('')
    try {
      const probe = new Chess()
      probe.loadPgn(pasted)
      if (!probe.history().length) throw new Error('в PGN нет ходов')
      const res = await api.saveGame({ pgn: pasted, user_color: pastedColor, result: '*', kind: 'imported' })
      load({ id: res.id, pgn: pasted, userColor: pastedColor })
    } catch (e) {
      setError('Не удалось прочитать PGN: ' + e.message)
    }
  }

  // Навигация стрелками клавиатуры
  const total = data ? data.sans.length : 0
  useEffect(() => {
    if (!data) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(-1, c - 1))
      if (e.key === 'ArrowRight') setCurrent((c) => Math.min(total - 1, c + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data, total])

  const stats = useMemo(() => {
    if (!data) return null
    return { w: summarize(data.records, 'w'), b: summarize(data.records, 'b') }
  }, [data])

  // ------------------------- Экран выбора партии --------------------------
  if (!source) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <Panel><Coach coach={coach} /></Panel>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <Panel title="Ваши партии">
          {games.length === 0 && <p className="text-neutral-400 text-sm">Пока пусто. Сыграйте партию с тренером или вставьте PGN ниже.</p>}
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {games.map((g) => (
              <button key={g.id} type="button" className="btn justify-between text-left"
                onClick={() => api.game(g.id).then((full) => load({ id: full.id, pgn: full.pgn, userColor: full.user_color }))}>
                <span className="flex items-center gap-2">
                  <FileText size={15} />
                  {g.kind === 'imported' ? 'Импорт' : `Бот ${g.opponent_rating ?? '?'}`} · {g.user_color === 'w' ? 'белыми' : 'чёрными'} · {g.result}
                </span>
                <span className="text-xs text-neutral-400 font-normal">
                  {g.accuracy != null ? `точность ${g.accuracy}% · ` : ''}{(g.date || '').slice(0, 16)}
                </span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Разобрать свою партию (PGN)">
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ..."
            className="w-full bg-bg rounded-lg p-2.5 text-sm font-mono border border-white/10 focus:border-accent outline-none" />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-sm text-neutral-300">Я играл:</span>
            {[['w', 'белыми'], ['b', 'чёрными']].map(([c, label]) => (
              <button key={c} type="button" className={`btn ${pastedColor === c ? 'btn-primary' : ''}`} onClick={() => setPastedColor(c)}>{label}</button>
            ))}
            <button type="button" className="btn btn-primary ml-auto" disabled={!pasted.trim()} onClick={importPgn}>
              <Upload size={16} /> Разобрать
            </button>
          </div>
        </Panel>
      </div>
    )
  }

  // ----------------------------- Экран разбора ----------------------------
  const fen = data ? data.fens[current + 1] : new Chess().fen()
  const ev = data ? data.evals[current + 1] : { cp: 0 }
  const rec = data && current >= 0 ? data.records[current] : null
  const lastMove = rec ? [rec.move.from, rec.move.to] : null
  // Стрелка «как надо было» — для ходов слабее «хорошего»
  const showBetter = rec && !rec.isBest && ['inaccuracy', 'mistake', 'blunder'].includes(rec.cls) && rec.bestUci
  const better = showBetter ? parseUci(rec.bestUci) : null

  return (
    <ModeLayout
      board={
        <div className="flex gap-2">
          <EvalBar cp={ev.cp} mate={ev.mate} orientation={source.userColor} />
          <div className="flex-1 min-w-0">
            <Board fen={fen} orientation={source.userColor} lastMove={lastMove}
              arrows={better ? [{ from: better.from, to: better.to, type: 'success' }] : []} />
          </div>
        </div>
      }
      below={data && (
        <div>
          <EvalGraph evals={data.evals} records={data.records} current={current} onSelect={(i) => setCurrent(Math.max(-1, Math.min(total - 1, i)))} />
          <div className="flex justify-center gap-2 mt-2">
            <button type="button" className="btn" onClick={() => setCurrent(-1)} aria-label="В начало"><ChevronsLeft size={18} /></button>
            <button type="button" className="btn" onClick={() => setCurrent((c) => Math.max(-1, c - 1))} aria-label="Назад"><ChevronLeft size={18} /></button>
            <button type="button" className="btn" onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))} aria-label="Вперёд"><ChevronRight size={18} /></button>
            <button type="button" className="btn" onClick={() => setCurrent(total - 1)} aria-label="В конец"><ChevronsRight size={18} /></button>
          </div>
        </div>
      )}
      side={
        <>
          <Panel>
            <Coach coach={coach} thinking={!data} />
            {data?.verdict.action && (
              <button type="button" className="btn btn-primary w-full mt-3"
                onClick={() => onNavigate(data.verdict.action.mode, { theme: data.verdict.action.theme })}>
                {data.verdict.action.label}
              </button>
            )}
          </Panel>

          {!data && (
            <Panel title="Анализ партии">
              <div className="h-2.5 bg-bg rounded overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="text-xs text-neutral-400 mt-1.5">Stockfish считает позиции: {Math.round(progress * 100)}%</div>
            </Panel>
          )}

          {rec && (
            <Panel>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-full text-xs font-bold text-neutral-900" style={{ background: CLASSES[rec.cls].color }}>
                  {CLASSES[rec.cls].symbol}
                </span>
                <span>
                  <b>{Math.floor(rec.ply / 2) + 1}{rec.color === 'w' ? '.' : '…'} {rec.san}</b> — {CLASSES[rec.cls].label.toLowerCase()}
                </span>
              </div>
              {showBetter && (
                <p className="text-sm text-neutral-300 mt-1.5">
                  Сильнее было <b className="text-accent">{uciToSan(rec.fenBefore, rec.bestUci)}</b> (зелёная стрелка).
                </p>
              )}
            </Panel>
          )}

          {stats && (
            <Panel title="Итоги">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-neutral-400 text-xs">
                    <th className="text-left font-normal">{source.userColor === 'w' ? `Белые (${profile?.username || 'вы'})` : 'Белые'}</th>
                    <th />
                    <th className="text-right font-normal">{source.userColor === 'b' ? `Чёрные (${profile?.username || 'вы'})` : 'Чёрные'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-bold text-base">
                    <td>{stats.w.accuracy.toFixed(1)}%</td>
                    <td className="text-center text-xs font-normal text-neutral-400">точность</td>
                    <td className="text-right">{stats.b.accuracy.toFixed(1)}%</td>
                  </tr>
                  {CLASS_ORDER.map((k) => (
                    <tr key={k}>
                      <td>{stats.w.counts[k]}</td>
                      <td className="text-center text-xs" style={{ color: CLASSES[k].color }}>{CLASSES[k].label}</td>
                      <td className="text-right">{stats.b.counts[k]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {data && (
            <Panel title="Нотация">
              <MoveList sans={data.sans} current={current} classes={data.records.map((r) => r.cls)} onSelect={setCurrent} maxHeight={200} />
            </Panel>
          )}
          <button type="button" className="btn" onClick={() => { runId.current++; setSource(null); setData(null); api.games().then(setGames).catch(() => {}) }}>
            ← К списку партий
          </button>
        </>
      }
    />
  )
}
