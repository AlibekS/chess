// Обёртка React над cm-chessboard.
//
// Компонент «управляемый»: позицию задаёт проп fen. Когда пользователь делает
// ход, вызывается onMove({from, to, promotion}); если он вернул true, родитель
// обязан обновить fen — доска анимирует разницу (рокировка, взятие на проходе).
import { useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import { Chessboard, COLOR, INPUT_EVENT_TYPE } from 'cm-chessboard/src/Chessboard.js'
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js'
import { Arrows, ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows.js'
import { PromotionDialog, PROMOTION_DIALOG_RESULT_TYPE } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js'

const LAST_MOVE = { class: 'marker-last-move', slice: 'markerSquare' }
const HINT = { class: 'marker-hint', slice: 'markerCircle' }

/**
 * props:
 *  fen          — позиция
 *  orientation  — 'w' | 'b' (кто снизу)
 *  movable      — 'w' | 'b' | 'both' | null — кому разрешён ввод ходов
 *  onMove       — ({from,to,promotion}) => boolean
 *  lastMove     — [from, to] для подсветки
 *  arrows       — [{from, to, type: 'success'|'info'|'danger'|'warning'}]
 *  hintSquares  — [square] — кружки-подсказки
 */
export default function Board({ fen, orientation = 'w', movable = null, onMove, lastMove, arrows, hintSquares }) {
  const elRef = useRef(null)
  const boardRef = useRef(null)
  const inputOn = useRef(false)
  // Обработчик ввода живёт дольше одного рендера — актуальные пропсы берём из ref
  const latest = useRef({})
  latest.current = { fen, onMove, movable }

  // Создание доски (один раз)
  useEffect(() => {
    const board = new Chessboard(elRef.current, {
      position: fen,
      orientation: orientation === 'w' ? COLOR.white : COLOR.black,
      assetsUrl: '/vendor/cm-chessboard/',
      style: { cssClass: 'green', showCoordinates: true, pieces: { file: 'pieces/staunty.svg' }, animationDuration: 220 },
      extensions: [
        { class: Markers, props: { autoMarkers: MARKER_TYPE.frame } },
        { class: Arrows },
        { class: PromotionDialog },
      ],
    })
    boardRef.current = board
    return () => {
      inputOn.current = false
      board.destroy()
      boardRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Позиция
  useEffect(() => {
    boardRef.current?.setPosition(fen, true)
  }, [fen])

  // Ориентация
  useEffect(() => {
    boardRef.current?.setOrientation(orientation === 'w' ? COLOR.white : COLOR.black)
  }, [orientation])

  // Ввод ходов
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    if (inputOn.current) {
      board.disableMoveInput()
      inputOn.current = false
    }
    if (!movable) return

    const handler = (event) => {
      const { fen: curFen, onMove: cb } = latest.current
      const chess = new Chess(curFen)
      if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
        const moves = chess.moves({ square: event.squareFrom, verbose: true })
        board.addLegalMovesMarkers(moves)
        return moves.length > 0
      }
      if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
        board.removeLegalMovesMarkers()
        const candidates = chess
          .moves({ square: event.squareFrom, verbose: true })
          .filter((m) => m.to === event.squareTo)
        if (!candidates.length) return false
        if (candidates[0].promotion) {
          // Превращение: фигура возвращается, выбираем фигуру в диалоге
          board.showPromotionDialog(event.squareTo, chess.turn() === 'w' ? COLOR.white : COLOR.black, (res) => {
            if (res.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) {
              cb?.({ from: event.squareFrom, to: event.squareTo, promotion: res.piece.charAt(1) })
            }
          })
          return false
        }
        return cb ? cb({ from: event.squareFrom, to: event.squareTo }) !== false : false
      }
      if (event.type === INPUT_EVENT_TYPE.moveInputCanceled || event.type === INPUT_EVENT_TYPE.moveInputFinished) {
        board.removeLegalMovesMarkers()
      }
      return true
    }
    const color = movable === 'both' ? undefined : movable === 'w' ? COLOR.white : COLOR.black
    board.enableMoveInput(handler, color)
    inputOn.current = true
  }, [movable])

  // Подсветка последнего хода и подсказок
  const lastKey = lastMove ? lastMove.join('') : ''
  const hintKey = (hintSquares || []).join('')
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    board.removeMarkers(LAST_MOVE)
    board.removeMarkers(HINT)
    if (lastMove) lastMove.forEach((sq) => board.addMarker(LAST_MOVE, sq))
    ;(hintSquares || []).forEach((sq) => board.addMarker(HINT, sq))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey, hintKey])

  // Стрелки
  const arrowKey = (arrows || []).map((a) => a.from + a.to + (a.type || '')).join(',')
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    board.removeArrows()
    ;(arrows || []).forEach((a) => board.addArrow(ARROW_TYPE[a.type || 'success'], a.from, a.to))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrowKey])

  return <div ref={elRef} className="board-host w-full" />
}
