// Решение одной тактической задачи (формат Lichess):
// первый ход в списке делает соперник, затем пользователь ищет решение.
import { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import Board from './Board.jsx'
import { parseUci, toUci } from '../lib/chessUtil.js'

/**
 * props:
 *  puzzle  — {id, fen, moves: [uci]}
 *  onDone  — (solved: boolean) => void — вызывается один раз
 *  onProgress — (text) => void — «верно, продолжай» после промежуточного хода
 */
export default function PuzzleSolver({ puzzle, onDone, onProgress }) {
  const chessRef = useRef(null)
  const [fen, setFen] = useState(puzzle.fen)
  const [lastMove, setLastMove] = useState(null)
  const [step, setStep] = useState(0) // индекс следующего хода в puzzle.moves
  const [locked, setLocked] = useState(true)
  const [solution, setSolution] = useState(null) // стрелка с верным ходом после ошибки
  const doneRef = useRef(false)

  // Сторона пользователя — та, что ходит ПОСЛЕ первого хода соперника
  const userColor = puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w'

  useEffect(() => {
    const chess = new Chess(puzzle.fen)
    chessRef.current = chess
    doneRef.current = false
    setFen(puzzle.fen)
    setLastMove(null)
    setSolution(null)
    setStep(0)
    setLocked(true)
    // Соперник делает вступительный ход с небольшой задержкой
    const t = setTimeout(() => {
      const mv = chess.move(parseUci(puzzle.moves[0]))
      setFen(chess.fen())
      setLastMove([mv.from, mv.to])
      setStep(1)
      setLocked(false)
    }, 600)
    return () => clearTimeout(t)
  }, [puzzle])

  const finish = (solved) => {
    if (doneRef.current) return
    doneRef.current = true
    setLocked(true)
    onDone(solved)
  }

  const onMove = (m) => {
    if (locked) return false
    const chess = chessRef.current
    let move
    try {
      move = chess.move({ ...m, promotion: m.promotion })
    } catch {
      return false
    }
    const expected = puzzle.moves[step]
    // Любой мат засчитывается (в задачах на мат бывает несколько решений)
    const correct = toUci(move) === expected || chess.isCheckmate()
    setFen(chess.fen())
    setLastMove([move.from, move.to])
    if (!correct) {
      setLocked(true)
      // Показываем верное решение: откатываем ход и рисуем стрелку
      setTimeout(() => {
        chess.undo()
        setFen(chess.fen())
        const sol = parseUci(expected)
        setSolution({ from: sol.from, to: sol.to, type: 'danger' })
        finish(false)
      }, 500)
      return true
    }
    const next = step + 1
    if (next >= puzzle.moves.length || chess.isCheckmate()) {
      finish(true)
      return true
    }
    // Ответ соперника
    setLocked(true)
    onProgress?.('Верно. Дальше.')
    setTimeout(() => {
      const reply = chess.move(parseUci(puzzle.moves[next]))
      setFen(chess.fen())
      setLastMove([reply.from, reply.to])
      setStep(next + 1)
      setLocked(false)
    }, 500)
    return true
  }

  return (
    <Board
      fen={fen}
      orientation={userColor}
      movable={locked ? null : userColor}
      onMove={onMove}
      lastMove={lastMove}
      arrows={solution ? [solution] : []}
    />
  )
}
