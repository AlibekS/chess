// Режим «Свободная игра с тренером»: партия с ботом заданного рейтинга,
// тренер реагирует на каждый ход, даёт подсказки и исторические справки.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Flag, Lightbulb, Play as PlayIcon, RotateCcw, Search } from 'lucide-react'
import Board from '../components/Board.jsx'
import Coach, { useCoach } from '../components/Coach.jsx'
import EvalBar from '../components/EvalBar.jsx'
import InsightCard from '../components/InsightCard.jsx'
import ModeLayout, { Panel } from '../components/Layout.jsx'
import MoveList from '../components/MoveList.jsx'
import { api } from '../api.js'
import { useBotGame } from '../lib/useBotGame.js'
import { buildPgn, CLASSES, coachHint, describeRefutation, parseUci } from '../lib/chessUtil.js'
import { lineForClass, moodForClass, say } from '../lib/coachLines.js'

export default function Play({ profile, onProfile, onReview }) {
  const coach = useCoach(say('welcome'))
  const [setup, setSetup] = useState({ color: 'w', rating: profile?.estimated_rating || 1200 })
  const [insight, setInsight] = useState(null) // { data, revealed }
  const [hint, setHint] = useState({ level: 0, uci: null }) // 1 — словами, 2 — фигура, 3 — стрелка
  const [classes, setClasses] = useState([])
  const [savedId, setSavedId] = useState(null)
  const insightFen = useRef('')

  const game = useBotGame({
    onUserTurn: ({ fen }) => {
      // Исторический факт по позиции перед ходом пользователя
      insightFen.current = fen
      api.positionCheck(fen)
        .then((data) => {
          if (insightFen.current === fen) setInsight(data.match === 'none' ? null : { data, revealed: false })
        })
        .catch(() => {})
    },
    onEvaluated: (rec) => {
      setClasses((c) => {
        const next = [...c]
        next[rec.ply] = rec.cls
        return next
      })
      let text = lineForClass(rec.cls)
      // Оценка упала больше чем на пешку — показываем конкретную угрозу
      if (rec.cpLoss >= 100 && rec.reply && ['inaccuracy', 'mistake', 'blunder'].includes(rec.cls)) {
        text += ' ' + describeRefutation(rec.fenAfter, rec.reply, rec.opponentMate)
      } else if (rec.cls === 'best' && rec.cpAfter > 400 && rec.cpBefore <= 400) {
        text = say('winning')
      }
      coach.say(text, moodForClass(rec.cls))
      // Раскрываем ход Фишера, если была загадка «найдёшь ли ты мой ход»
      setInsight((ins) => {
        if (!ins || ins.revealed || !ins.data.fischer_move) return ins
        const same = ins.data.fischer_move === rec.san
        return { ...ins, revealed: true, same }
      })
    },
    onBotMoved: ({ swing }) => {
      if (swing >= 150) coach.say(say('opponentBlunder'), 'pleased')
    },
    onGameOver: ({ result, reason }) => {
      const color = setupRef.current.color
      const won = (result === '1-0' && color === 'w') || (result === '0-1' && color === 'b')
      const key = result === '1/2-1/2' ? 'draw' : won ? 'userWon' : 'userLost'
      coach.say(say(key) + (reason === 'сдача' ? ' Сдаваться рано — плохая привычка.' : ''), won ? 'pleased' : 'idle')
      pendingSave.current = { result }
    },
  })

  const setupRef = useRef(setup)
  setupRef.current = setup
  const pendingSave = useRef(null)

  // Сохранение партии после окончания (когда состояние с ходами уже обновилось)
  useEffect(() => {
    if (game.status !== 'over' || !pendingSave.current || game.sans.length < 2) return
    const { result } = pendingSave.current
    pendingSave.current = null
    const { color, rating } = setupRef.current
    const pgn = buildPgn(game.sans, {
      Event: 'Тренировочная партия', Site: 'Fischer Chess Coach',
      Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      White: color === 'w' ? profile?.username || 'Player' : `Stockfish (${rating})`,
      Black: color === 'b' ? profile?.username || 'Player' : `Stockfish (${rating})`,
      Result: result,
    })
    api.saveGame({ pgn, user_color: color, result, opponent_rating: rating, kind: 'training' })
      .then((res) => {
        setSavedId(res.id)
        onProfile?.(res.profile)
      })
      .catch(() => {})
  }, [game.status, game.sans, profile, onProfile])

  const startGame = () => {
    setClasses([])
    setInsight(null)
    setHint({ level: 0, uci: null })
    setSavedId(null)
    game.start({ userColor: setup.color, botRating: setup.rating })
    coach.say(say(setup.color === 'w' ? 'gameStartWhite' : 'gameStartBlack'))
  }

  const onMove = (m) => {
    const ok = game.userMove(m)
    if (ok) setHint({ level: 0, uci: null })
    return ok
  }

  // «Спросить совет Бобби»: сначала наводка словами, потом фигура, потом стрелка
  const askHint = useCallback(async () => {
    if (game.status !== 'user') return
    const analysis = await game.currentAnalysis()
    if (!analysis?.bestmove) return
    const level = Math.min(3, (hint.uci === analysis.bestmove ? hint.level : 0) + 1)
    setHint({ level, uci: analysis.bestmove })
    const mate = analysis.mate !== undefined && ((analysis.mate > 0) === (setup.color === 'w')) ? Math.abs(analysis.mate) : null
    if (level === 1) coach.say(coachHint(game.fen, analysis.bestmove, mate), 'idle')
    else if (level === 2) coach.say('Ладно, покажу фигуру. Ход найди сам.', 'skeptical')
    else coach.say('Смотри на стрелку. В следующий раз считай сам — на турнире подсказок не будет.', 'skeptical')
  }, [game, hint, coach, setup.color])

  const hintMove = hint.uci ? parseUci(hint.uci) : null
  const playing = game.status !== 'idle'
  const over = game.status === 'over'

  let insightText = null
  if (insight) {
    const d = insight.data
    if (d.teaser && !insight.revealed) insightText = d.teaser
    else if (d.teaser && insight.revealed) insightText = insight.same ? `Да, это мой ход. ${d.reveal}` : d.reveal
    else insightText = d.message
  }

  return (
    <ModeLayout
      board={
        <div className="flex gap-2">
          <EvalBar cp={game.evalCp} mate={game.evalMate} orientation={setup.color} />
          <div className="flex-1 min-w-0">
            <Board
              fen={game.fen}
              orientation={playing ? game.userColor : setup.color}
              movable={game.status === 'user' ? game.userColor : null}
              onMove={onMove}
              lastMove={game.lastMove}
              hintSquares={hint.level >= 2 && hintMove ? [hintMove.from] : []}
              arrows={hint.level >= 3 && hintMove ? [{ from: hintMove.from, to: hintMove.to, type: 'warning' }] : []}
            />
          </div>
        </div>
      }
      side={
        <>
          <Panel>
            <Coach coach={coach} thinking={game.status === 'bot' || game.status === 'evaluating'} />
          </Panel>

          {insight && <InsightCard insight={insight.data} text={insightText} />}

          {!playing || over ? (
            <Panel title={over ? `Партия окончена: ${game.result} (${game.reason})` : 'Новая партия'}>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-sm text-neutral-300 mb-1">Ваш цвет</div>
                  <div className="flex gap-2">
                    {[['w', 'Белые'], ['b', 'Чёрные']].map(([c, label]) => (
                      <button key={c} type="button" className={`btn flex-1 ${setup.color === c ? 'btn-primary' : ''}`} onClick={() => setSetup((s) => ({ ...s, color: c }))}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="text-sm text-neutral-300">
                  Рейтинг бота: <b className="text-accent">{setup.rating}</b>
                  <input type="range" min="400" max="2400" step="50" value={setup.rating} className="w-full accent-[#81b64c] mt-1"
                    onChange={(e) => setSetup((s) => ({ ...s, rating: Number(e.target.value) }))} />
                </label>
                <button type="button" className="btn btn-primary" onClick={startGame}>
                  <PlayIcon size={16} /> {over ? 'Сыграть ещё' : 'Начать партию'}
                </button>
                {over && savedId && (
                  <button type="button" className="btn" onClick={() => onReview(savedId)}>
                    <Search size={16} /> Разобрать партию с тренером
                  </button>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <div className="flex gap-2 flex-wrap">
                <button type="button" className="btn btn-primary flex-1" onClick={askHint} disabled={game.status !== 'user'}>
                  <Lightbulb size={16} /> Спросить совет Бобби
                </button>
                <button type="button" className="btn btn-danger" onClick={game.resign} title="Сдаться">
                  <Flag size={16} />
                </button>
                <button type="button" className="btn" onClick={startGame} title="Начать заново">
                  <RotateCcw size={16} />
                </button>
              </div>
              <div className="text-xs text-neutral-400 mt-2">
                Бот: Stockfish ≈ {game.botRating} ·{' '}
                {game.status === 'user' ? 'ваш ход' : game.status === 'bot' ? 'соперник думает…' : 'тренер оценивает ход…'}
              </div>
            </Panel>
          )}

          <Panel title="Нотация">
            <MoveList sans={game.sans} current={game.sans.length - 1} classes={classes} />
            {classes.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-neutral-400">
                {['best', 'inaccuracy', 'mistake', 'blunder'].map((k) => (
                  <span key={k}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: CLASSES[k].color }} />{CLASSES[k].label}</span>
                ))}
              </div>
            )}
          </Panel>
        </>
      }
    />
  )
}
