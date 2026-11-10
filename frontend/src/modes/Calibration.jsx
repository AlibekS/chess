// Первичная калибровка уровня игры:
//   1) опросник из трёх вопросов;
//   2) адаптивный тест по тактике (10 задач: верно +100, ошибка −75);
//   3) мини-партия на 15 ходов против Stockfish (по желанию);
//   итог — стартовый рейтинг и индивидуальный план (считает бэкенд).
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, SkipForward } from 'lucide-react'
import Board from '../components/Board.jsx'
import Coach, { useCoach } from '../components/Coach.jsx'
import ModeLayout, { Panel } from '../components/Layout.jsx'
import MoveList from '../components/MoveList.jsx'
import PuzzleSolver from '../components/PuzzleSolver.jsx'
import { api } from '../api.js'
import { useBotGame } from '../lib/useBotGame.js'
import { moodForClass, say } from '../lib/coachLines.js'

const PUZZLE_COUNT = 10
const GAME_MOVES = 15
const STEP_UP = 100
const STEP_DOWN = 75

const EXPERIENCE = [
  ['novice', 'Новичок', 'Знаю, как ходят фигуры'],
  ['amateur', 'Любитель', 'Играю время от времени'],
  ['club', 'Клубный игрок', 'Играю регулярно, участвую в турнирах'],
  ['rated', 'Разрядник', 'Есть разряд или официальный рейтинг'],
]
const CONCEPTS = [
  ['none', 'Почти ничего', 'Вилка, связка, принципы дебюта — слышу впервые'],
  ['some', 'Кое-что', 'Знаю термины, но применяю не всегда'],
  ['all', 'Уверенно', 'Вилки, связки и дебютные принципы — рабочий инструмент'],
]
const BASE = { novice: 600, amateur: 1000, club: 1400, rated: 1800 }
const ADJ = { none: -100, some: 0, all: 100 }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function Choice({ options, value, onPick }) {
  return (
    <div className="grid gap-2">
      {options.map(([id, title, sub]) => (
        <button key={id} type="button" onClick={() => onPick(id)}
          className={`text-left rounded-xl p-3.5 transition-colors cursor-pointer border ${value === id ? 'bg-accent/15 border-accent' : 'bg-panel border-transparent hover:bg-panel-2'}`}>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-neutral-400">{sub}</div>
        </button>
      ))}
    </div>
  )
}

export default function Calibration({ onDone }) {
  const coach = useCoach('Прежде чем учить, я должен увидеть, как ты играешь. Три вопроса, десять задач и короткая партия. Отвечай честно — себя не обманешь.')
  const [step, setStep] = useState('intro')
  const [answers, setAnswers] = useState({ experience: null, concepts: null, selfRating: 1200, knowsRating: true })
  // --- тактика ---
  const [target, setTarget] = useState(1200)
  const [puzzle, setPuzzle] = useState(null)
  const [outcomes, setOutcomes] = useState([])
  const [waitNext, setWaitNext] = useState(false)
  const seen = useRef([])
  // --- итог ---
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const outcomesRef = useRef(outcomes)
  outcomesRef.current = outcomes

  const submit = (gameStats) => {
    setStep('result')
    coach.say('Считаю твой уровень…', 'thinking')
    api.calibrate({
      experience: answers.experience,
      concepts: answers.concepts,
      self_rating: answers.knowsRating ? answers.selfRating : null,
      puzzles: outcomesRef.current,
      game: gameStats,
    })
      .then((res) => {
        setResult(res)
        coach.say(`Твой стартовый рейтинг — ${res.rating}. ${res.rating >= 1800 ? 'Есть с чем работать.' : res.rating >= 1200 ? 'База есть, но дыр хватает.' : 'Работы много. Начнём с простого.'} План я составил.`, 'idle')
      })
      .catch((e) => setError(e.message))
  }

  // --- мини-партия ---
  const game = useBotGame({
    onEvaluated: (rec) => coach.say(say(rec.cls), moodForClass(rec.cls)),
    onGameOver: ({ records }) => {
      const losses = records.map((r) => Math.min(r.cpLoss, 500))
      const acpl = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 100
      submit({ acpl, moves: records.length })
    },
  })

  const loadPuzzle = (rating) => {
    setWaitNext(false)
    setPuzzle(null)
    api.nextPuzzle(rating, seen.current)
      .then((p) => {
        seen.current.push(p.id)
        setPuzzle(p)
      })
      .catch((e) => setError(e.message))
  }

  const startTactics = () => {
    const prior = BASE[answers.experience] + ADJ[answers.concepts]
    const start = clamp(Math.round(answers.knowsRating ? (prior + answers.selfRating) / 2 : prior), 500, 2000)
    setTarget(start)
    setStep('tactics')
    coach.say('Десять задач. Каждая верная — следующая будет труднее. Не торопись: один неверный ход — и задача не засчитана.')
    loadPuzzle(start)
  }

  const onPuzzleDone = (solved) => {
    setOutcomes((o) => [...o, { rating: puzzle.rating, solved, themes: puzzle.themes }])
    api.puzzleResult(puzzle.id, solved, false).catch(() => {})
    setTarget((t) => clamp(t + (solved ? STEP_UP : -STEP_DOWN), 400, 2600))
    coach.say(say(solved ? 'puzzleSolved' : 'puzzleFailed'), solved ? 'pleased' : 'skeptical')
    setWaitNext(true)
  }

  const nextAfterPuzzle = () => {
    if (outcomes.length >= PUZZLE_COUNT) {
      setStep('gameOffer')
      const solved = outcomes.filter((o) => o.solved).length
      coach.say(`Тактика: ${solved} из ${PUZZLE_COUNT}. Теперь партия на ${GAME_MOVES} ходов — хочу увидеть, как ты разыгрываешь дебют и принимаешь решения. Можно пропустить, но оценка будет грубее.`)
    } else {
      loadPuzzle(target)
    }
  }

  const startGame = () => {
    setStep('game')
    game.start({ userColor: 'w', botRating: clamp(target, 400, 2400), moveLimit: GAME_MOVES })
    coach.say(say('gameStartWhite'))
  }

  useEffect(() => {
    if (error) coach.say('Что-то сломалось на сервере. Проверь, что бэкенд запущен.', 'skeptical')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  // ------------------------------- Экраны ---------------------------------
  if (step === 'tactics') {
    const n = Math.min(outcomes.length + (waitNext ? 0 : 1), PUZZLE_COUNT)
    const toMove = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'чёрных' : 'белых') : ''
    return (
      <ModeLayout
        board={puzzle ? <PuzzleSolver key={puzzle.id} puzzle={puzzle} onDone={onPuzzleDone} onProgress={(t) => coach.say(t, 'pleased')} /> : <div className="aspect-square bg-panel rounded-lg" />}
        side={
          <>
            <Panel><Coach coach={coach} /></Panel>
            <Panel title={`Этап 2 из 3 · задача ${n} из ${PUZZLE_COUNT}`}>
              <div className="flex gap-1 mb-3">
                {Array.from({ length: PUZZLE_COUNT }, (_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded ${i < outcomes.length ? (outcomes[i].solved ? 'bg-accent' : 'bg-red-500') : 'bg-bg'}`} />
                ))}
              </div>
              {puzzle && <div className="text-base font-semibold">Ход {toMove}. Найдите лучшее продолжение.</div>}
              {puzzle && <div className="text-sm text-neutral-400">Сложность задачи: {puzzle.rating}</div>}
              {waitNext && (
                <button type="button" className="btn btn-primary w-full mt-3" onClick={nextAfterPuzzle}>
                  {outcomes.length >= PUZZLE_COUNT ? 'К следующему этапу' : 'Следующая задача'} <ArrowRight size={16} />
                </button>
              )}
              {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
            </Panel>
          </>
        }
      />
    )
  }

  if (step === 'game') {
    const userMoves = Math.ceil(game.sans.length / 2)
    return (
      <ModeLayout
        board={<Board fen={game.fen} orientation="w" movable={game.status === 'user' ? 'w' : null} onMove={game.userMove} lastMove={game.lastMove} />}
        side={
          <>
            <Panel><Coach coach={coach} thinking={game.status === 'bot' || game.status === 'evaluating'} /></Panel>
            <Panel title={`Этап 3 из 3 · мини-партия · ход ${Math.min(userMoves + 1, GAME_MOVES)} из ${GAME_MOVES}`}>
              <div className="h-2 bg-bg rounded overflow-hidden mb-3">
                <div className="h-full bg-accent transition-all" style={{ width: `${(Math.min(userMoves, GAME_MOVES) / GAME_MOVES) * 100}%` }} />
              </div>
              <MoveList sans={game.sans} current={game.sans.length - 1} maxHeight={160} />
            </Panel>
          </>
        }
      />
    )
  }

  // Шаги без доски: вступление, вопросы, предложение партии, результат
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <Panel><Coach coach={coach} /></Panel>

      {step === 'intro' && (
        <button type="button" className="btn btn-primary text-base py-3" onClick={() => { setStep('q1'); coach.say('Вопрос первый. Какой у тебя опыт?') }}>
          Начать калибровку <ArrowRight size={18} />
        </button>
      )}

      {step === 'q1' && (
        <Panel title="Этап 1 из 3 · вопрос 1 из 3 · опыт игры">
          <Choice options={EXPERIENCE} value={answers.experience} onPick={(id) => {
            setAnswers((a) => ({ ...a, experience: id }))
            setStep('q2')
            coach.say('Второй. Вилка, связка, дебютные принципы — что из этого ты действительно знаешь?')
          }} />
        </Panel>
      )}

      {step === 'q2' && (
        <Panel title="Этап 1 из 3 · вопрос 2 из 3 · базовые концепции">
          <Choice options={CONCEPTS} value={answers.concepts} onPick={(id) => {
            setAnswers((a) => ({ ...a, concepts: id, selfRating: BASE[a.experience] + ADJ[id] }))
            setStep('q3')
            coach.say('Третий. Как сам оцениваешь свой рейтинг? Цифры скажут правду позже, но мне интересно твоё мнение.')
          }} />
        </Panel>
      )}

      {step === 'q3' && (
        <Panel title="Этап 1 из 3 · вопрос 3 из 3 · предполагаемый рейтинг">
          <div className={answers.knowsRating ? '' : 'opacity-40'}>
            <div className="text-4xl font-bold text-accent text-center tabular-nums">{answers.selfRating}</div>
            <input type="range" min="400" max="2400" step="50" value={answers.selfRating} disabled={!answers.knowsRating} aria-label="Предполагаемый рейтинг"
              onChange={(e) => setAnswers((a) => ({ ...a, selfRating: Number(e.target.value) }))} className="w-full accent-[#81b64c] mt-2" />
            <div className="flex justify-between text-xs text-neutral-500"><span>400</span><span>1400</span><span>2400</span></div>
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
            <input type="checkbox" checked={!answers.knowsRating} onChange={(e) => setAnswers((a) => ({ ...a, knowsRating: !e.target.checked }))} className="accent-[#81b64c]" />
            Не знаю свой рейтинг
          </label>
          <button type="button" className="btn btn-primary w-full mt-4" onClick={startTactics}>К тактическому тесту <ArrowRight size={16} /></button>
        </Panel>
      )}

      {step === 'gameOffer' && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn btn-primary flex-1 py-3" onClick={startGame}>Сыграть мини-партию <ArrowRight size={16} /></button>
          <button type="button" className="btn flex-1 py-3" onClick={() => submit(null)}><SkipForward size={16} /> Пропустить</button>
        </div>
      )}

      {step === 'result' && error && <div className="text-red-400">Ошибка: {error}</div>}
      {step === 'result' && result && (
        <>
          <Panel title="Стартовый рейтинг">
            <div className="text-6xl font-bold text-accent text-center tabular-nums py-2">{result.rating}</div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm mt-2">
              {[['Опросник', result.components.questionnaire], ['Тактика', result.components.tactics], ['Партия', result.components.game]].map(([label, v]) => (
                <div key={label} className="bg-bg rounded-lg p-2">
                  <div className="font-bold text-lg">{v ?? '—'}</div>
                  <div className="text-xs text-neutral-400">{label}</div>
                </div>
              ))}
            </div>
            {result.weak_themes.length > 0 && (
              <p className="text-sm text-neutral-300 mt-3">Слабые места по тесту: {result.weak_themes.join(', ')}.</p>
            )}
          </Panel>
          <Panel title="Индивидуальный план">
            <ol className="flex flex-col gap-2">
              {result.plan.map((item, i) => (
                <li key={i} className="bg-bg rounded-lg p-3">
                  <div className="font-semibold">{i + 1}. {item.title}</div>
                  <div className="text-sm text-neutral-300">{item.text}</div>
                </li>
              ))}
            </ol>
          </Panel>
          <button type="button" className="btn btn-primary text-base py-3" onClick={() => onDone(result.profile)}>
            К тренировкам <ArrowRight size={18} />
          </button>
        </>
      )}
    </div>
  )
}
