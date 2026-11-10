// Хук партии против бота: правила (chess.js), ходы бота и оценка каждого
// хода пользователя движком. Используется в «Игре с тренером» и в
// калибровочной мини-партии.
import { useCallback, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { engine } from './engine.js'
import { classifyMove, gameResult, parseUci, START_FEN, toUci } from './chessUtil.js'

const sideCp = (cpWhite, color) => (color === 'w' ? cpWhite : -cpWhite)

/**
 * callbacks:
 *  onUserTurn({fen, analysis})          — позиция перед ходом пользователя посчитана
 *  onEvaluated(record)                  — ход пользователя оценён
 *  onBotMoved({move, swing})            — бот сходил; swing > 0 — бот ошибся (в сантипешках)
 *  onGameOver({result, reason})
 */
export function useBotGame(callbacks = {}) {
  const cb = useRef(callbacks)
  cb.current = callbacks

  const chessRef = useRef(new Chess())
  const cfg = useRef({ userColor: 'w', botRating: 1200, moveLimit: null })
  const prep = useRef(null) // Promise анализа текущей позиции пользователя
  const gameId = useRef(0) // защита от «опоздавших» ответов движка после новой партии
  const records = useRef([])

  const [state, setState] = useState({
    fen: START_FEN, sans: [], status: 'idle', lastMove: null, evalCp: 0, evalMate: undefined,
    result: '*', reason: '', userColor: 'w',
  })
  const patch = (p) => setState((s) => ({ ...s, ...p }))

  const finish = useCallback((result, reason) => {
    patch({ status: 'over', result, reason })
    cb.current.onGameOver?.({ result, reason, records: records.current })
  }, [])

  /** Готовит ход пользователя: считает позицию заранее (оценка «до» и лучший ход). */
  const prepareUserTurn = useCallback((id) => {
    const fen = chessRef.current.fen()
    prep.current = engine.analyze(fen).then((analysis) => {
      if (id !== gameId.current) return analysis
      patch({ evalCp: analysis.cp, evalMate: analysis.mate })
      cb.current.onUserTurn?.({ fen, analysis })
      return analysis
    })
    patch({ status: 'user' })
  }, [])

  const botTurn = useCallback(async (id, cpBeforeWhite) => {
    const chess = chessRef.current
    patch({ status: 'bot' })
    const legal = chess.moves({ verbose: true }).map(toUci)
    const uci = await engine.botMove(chess.fen(), cfg.current.botRating, legal)
    if (id !== gameId.current) return
    const move = chess.move(parseUci(uci || legal[0]))
    patch({ fen: chess.fen(), sans: chess.history(), lastMove: [move.from, move.to] })
    if (chess.isGameOver()) {
      finish(gameResult(chess), chess.isCheckmate() ? 'мат' : 'ничья')
      return
    }
    prepareUserTurn(id)
    // Насколько бот ухудшил свою позицию — узнаем, когда досчитается анализ
    prep.current.then((analysis) => {
      if (id !== gameId.current || cpBeforeWhite === null) return
      const swing = sideCp(analysis.cp, cfg.current.userColor) - sideCp(cpBeforeWhite, cfg.current.userColor)
      cb.current.onBotMoved?.({ move, swing })
    })
  }, [finish, prepareUserTurn])

  /** Новая партия. moveLimit — оборвать после N ходов пользователя (калибровка). */
  const start = useCallback(({ userColor = 'w', botRating = 1200, moveLimit = null } = {}) => {
    gameId.current += 1
    const id = gameId.current
    chessRef.current = new Chess()
    cfg.current = { userColor, botRating, moveLimit }
    records.current = []
    setState({ fen: START_FEN, sans: [], status: 'user', lastMove: null, evalCp: 0, evalMate: undefined,
      result: '*', reason: '', userColor })
    if (userColor === 'w') prepareUserTurn(id)
    else botTurn(id, null)
  }, [botTurn, prepareUserTurn])

  /** Ход пользователя с доски. Возвращает false, если ход нелегален или сейчас не его очередь. */
  const userMove = useCallback((m) => {
    const chess = chessRef.current
    const id = gameId.current
    if (state.status !== 'user' || chess.turn() !== cfg.current.userColor) return false
    const fenBefore = chess.fen()
    let move
    try {
      move = chess.move(m)
    } catch {
      return false
    }
    const fenAfter = chess.fen()
    const over = chess.isGameOver()
    patch({ fen: fenAfter, sans: chess.history(), lastMove: [move.from, move.to], status: 'evaluating' })

    ;(async () => {
      const before = await prep.current
      if (id !== gameId.current) return
      const color = cfg.current.userColor
      // Оценка «после»: мат/пат известны без движка
      let after
      if (chess.isCheckmate()) after = { cp: color === 'w' ? 10000 : -10000, mate: 0, pv: [], bestmove: null }
      else if (over) after = { cp: 0, pv: [], bestmove: null }
      else after = await engine.analyze(fenAfter)
      if (id !== gameId.current) return

      const isBest = toUci(move) === before.bestmove
      const cpBefore = sideCp(before.cp, color)
      const cpAfter = isBest ? Math.max(sideCp(after.cp, color), cpBefore - 5) : sideCp(after.cp, color)
      const record = {
        ply: chess.history().length - 1, san: move.san, move, fenBefore, fenAfter, isBest,
        bestUci: before.bestmove, cpBefore, cpAfter, reply: after.bestmove,
        // Мат, который теперь ставит соперник (если ход пользователя его допустил)
        opponentMate: after.mate !== undefined && sideCp(after.cp, color) < 0 ? Math.abs(after.mate) : null,
        ...classifyMove({ cpBefore, cpAfter, isBest, fenBefore, move }),
      }
      records.current.push(record)
      patch({ evalCp: after.cp, evalMate: after.mate })
      cb.current.onEvaluated?.(record)

      if (over) {
        finish(gameResult(chess), chess.isCheckmate() ? 'мат' : 'ничья')
        return
      }
      const limit = cfg.current.moveLimit
      if (limit && records.current.length >= limit) {
        finish('*', 'лимит ходов')
        return
      }
      botTurn(id, after.cp)
    })()
    return true
  }, [state.status, botTurn, finish])

  const resign = useCallback(() => {
    if (state.status === 'over' || state.status === 'idle') return
    gameId.current += 1 // отменяем ожидающие ответы движка
    finish(cfg.current.userColor === 'w' ? '0-1' : '1-0', 'сдача')
  }, [state.status, finish])

  /** Лучший ход для текущей позиции пользователя (для подсказок). */
  const currentAnalysis = useCallback(() => prep.current, [])

  return { ...state, start, userMove, resign, currentAnalysis, records, botRating: cfg.current.botRating }
}
