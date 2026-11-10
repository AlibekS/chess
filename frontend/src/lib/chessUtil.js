// Шахматные утилиты: классификация ходов, точность, подсказки в стиле тренера.
import { Chess } from 'chess.js'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

// Названия фигур: именительный, родительный, винительный падеж + род
const PIECES_RU = {
  p: { nom: 'пешка', gen: 'пешки', acc: 'пешку', fem: true },
  n: { nom: 'конь', gen: 'коня', acc: 'коня', fem: false },
  b: { nom: 'слон', gen: 'слона', acc: 'слона', fem: false },
  r: { nom: 'ладья', gen: 'ладьи', acc: 'ладью', fem: true },
  q: { nom: 'ферзь', gen: 'ферзя', acc: 'ферзя', fem: false },
  k: { nom: 'король', gen: 'короля', acc: 'короля', fem: false },
}
export const pieceRu = (type, form = 'nom') => PIECES_RU[type][form]

/** 'e2e4' / 'e7e8q' -> { from, to, promotion } */
export function parseUci(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
}
export const toUci = (m) => m.from + m.to + (m.promotion || '')

/** UCI -> SAN в данной позиции (null, если ход нелегален). */
export function uciToSan(fen, uci) {
  try {
    return new Chess(fen).move(parseUci(uci)).san
  } catch {
    return null
  }
}

const isDarkSquare = (sq) => (sq.charCodeAt(0) - 97 + Number(sq[1])) % 2 === 1

// ----------------------- Оценка -> шансы на победу -------------------------
/** Шансы на победу (0..100) по оценке в сантипешках — формула Lichess. */
export function winPercent(cp) {
  const c = Math.max(-1500, Math.min(1500, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1)
}

/** Точность одного хода (0..100) по падению шансов — формула Lichess. */
export function moveAccuracy(winBefore, winAfter) {
  const drop = Math.max(0, winBefore - winAfter)
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669))
}

// ------------------------- Классификация ходов -----------------------------
export const CLASSES = {
  brilliant: { label: 'Блестящий', symbol: '!!', color: '#26c2a3' },
  best: { label: 'Лучший', symbol: '★', color: '#81b64c' },
  excellent: { label: 'Отличный', symbol: '!', color: '#96bc4b' },
  good: { label: 'Хороший', symbol: '✓', color: '#95b776' },
  inaccuracy: { label: 'Неточность', symbol: '?!', color: '#f7c631' },
  mistake: { label: 'Ошибка', symbol: '?', color: '#ffa459' },
  blunder: { label: 'Зевок', symbol: '??', color: '#fa412d' },
}
export const CLASS_ORDER = ['brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']

/**
 * Жертва ли это: после хода фигура (не пешка) стоит под боем более дешёвой
 * фигуры либо под боем без защиты, и при этом сам ход не взял равноценный материал.
 */
export function isSacrifice(fenBefore, move) {
  if (move.piece === 'p' || move.piece === 'k') return false
  const after = new Chess(fenBefore)
  after.move(move)
  const enemy = after.turn()
  const me = enemy === 'w' ? 'b' : 'w'
  const attackers = after.attackers(move.to, enemy)
  if (!attackers.length) return false
  const gained = move.captured ? PIECE_VALUE[move.captured] : 0
  const risk = PIECE_VALUE[move.piece]
  if (gained >= risk) return false
  const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUE[after.get(sq).type]))
  const defended = after.attackers(move.to, me).length > 0
  return cheapest < risk || !defended
}

/**
 * Классифицирует ход.
 *  cpBefore / cpAfter — оценки с точки зрения ходившего (до и после хода);
 *  isBest — совпал ли ход с первой линией движка.
 */
export function classifyMove({ cpBefore, cpAfter, isBest, fenBefore, move }) {
  const wb = winPercent(cpBefore)
  const wa = winPercent(cpAfter)
  const drop = Math.max(0, wb - wa)
  let cls
  if (isBest || drop <= 0.5) cls = 'best'
  else if (drop <= 2) cls = 'excellent'
  else if (drop <= 5) cls = 'good'
  else if (drop <= 10) cls = 'inaccuracy'
  else if (drop <= 20) cls = 'mistake'
  else cls = 'blunder'
  // «Блестящий» — лучший ход с жертвой, когда партия ещё не решена
  if (cls === 'best' && wb < 92 && wa >= 45 && move && fenBefore && isSacrifice(fenBefore, move)) {
    cls = 'brilliant'
  }
  return { cls, drop, cpLoss: Math.max(0, cpBefore - cpAfter), accuracy: moveAccuracy(wb, wa) }
}

/** Формат оценки для шкалы: +1.3 / −0.5 / M4. */
export function formatEval(cp, mate) {
  if (mate !== undefined && mate !== null) return `M${Math.abs(mate)}`
  if (Math.abs(cp) >= 9000) return `M${Math.max(1, Math.round((10000 - Math.abs(cp)) / 10))}`
  const v = cp / 100
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1)
}

// ------------------------------ Фазы партии --------------------------------
/** Фаза позиции: opening / middlegame / endgame. */
export function gamePhase(fen, ply) {
  const board = fen.split(' ')[0]
  let material = 0
  for (const ch of board) {
    const v = { q: 9, r: 5, b: 3, n: 3 }[ch.toLowerCase()]
    if (v) material += v
  }
  if (material <= 26) return 'endgame'
  if (ply < 24) return 'opening'
  return 'middlegame'
}

// ------------------------ Подсказка в стиле Фишера -------------------------
/**
 * Наводка без называния хода. bestUci — лучший ход движка, mate — мат в N (если есть).
 */
export function coachHint(fen, bestUci, mate) {
  const chess = new Chess(fen)
  let move
  try {
    move = chess.move(parseUci(bestUci))
  } catch {
    return 'Смотри на всю доску. Ищи самый активный ход.'
  }
  chess.undo()
  const me = chess.turn()
  const enemy = me === 'w' ? 'b' : 'w'

  if (mate && mate > 0 && mate <= 4) {
    return mate === 1 ? 'Мат в один ход. Найди его.' : `Здесь форсированный мат в ${mate} хода. Начинай с шахов.`
  }
  if (move.captured) {
    const target = move.captured
    const undefended = chess.attackers(move.to, enemy).length === 0
    let name = pieceRu(target, 'acc')
    if (target === 'b') name = `${isDarkSquare(move.to) ? 'чернопольного' : 'белопольного'} слона`
    if (undefended) {
      const verb = PIECES_RU[target].fem ? 'она осталась' : 'он остался'
      return `Обрати внимание на ${name} соперника: ${verb} без защиты.`
    }
    if (PIECE_VALUE[target] > PIECE_VALUE[move.piece]) {
      return 'У соперника есть фигура, которую можно выгодно разменять. Считай взятия на одном поле.'
    }
    return 'Есть выгодное взятие. Считай размены до конца, а не «примерно».'
  }
  if (move.san.includes('+')) return 'Шах здесь не ради шаха — он выигрывает темп. Найди его.'
  if (move.san.startsWith('O-O')) return 'Твой король засиделся в центре. Убери его, пока не поздно.'
  if (move.promotion) return 'Пешка рвётся в ферзи. Не тормози её.'

  const homeRank = me === 'w' ? '1' : '8'
  if ((move.piece === 'n' || move.piece === 'b') && move.from[1] === homeRank) {
    return `У тебя ${pieceRu(move.piece)} до сих пор не в игре. Фигуры должны работать, а не стоять.`
  }
  if (move.piece === 'p' && 'cde'.includes(move.from[0])) {
    return 'Борись за центр пешкой. Пространство — это свобода для фигур.'
  }
  if (move.piece === 'p') return 'Здесь нужен пешечный ход на фланге. Подумай, какую линию он вскрывает.'
  if (move.piece === 'r') return 'Ладье нужна открытая линия. Найди её.'
  if (move.piece === 'q') return 'Ферзь может встать активнее. Ищи поле, откуда он создаёт угрозы.'
  if (move.piece === 'k') return 'Иногда лучший ход — королём. Посмотри, куда ему безопаснее.'
  return `Улучши позицию ${pieceRu(move.piece, 'gen')}: сейчас эта фигура стоит пассивно.`
}

/** Описание угрозы после ошибки: что соперник делает лучшим ответом. */
export function describeRefutation(fenAfter, replyUci, mateForOpponent) {
  const san = uciToSan(fenAfter, replyUci)
  if (!san) return ''
  if (mateForOpponent) {
    return mateForOpponent === 1 ? `Теперь ${san} — и это мат.` : `Теперь ${san}, и мат в ${mateForOpponent} неизбежен.`
  }
  const chess = new Chess(fenAfter)
  const mv = chess.move(parseUci(replyUci))
  if (mv.captured) return `Теперь ${san} — и ты теряешь ${pieceRu(mv.captured, 'acc')}.`
  if (san.includes('+')) return `Теперь ${san} с шахом, и позиция разваливается.`
  return `Теперь у соперника есть ${san} с сильной угрозой.`
}

/** PGN из списка SAN-ходов с заголовками. */
export function buildPgn(sans, headers = {}) {
  const chess = new Chess()
  for (const san of sans) chess.move(san)
  for (const [k, v] of Object.entries(headers)) chess.setHeader(k, String(v))
  return chess.pgn()
}

/** Результат оконченной партии по chess.js ('*', если не окончена). */
export function gameResult(chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0'
  if (chess.isDraw() || chess.isStalemate()) return '1/2-1/2'
  return '*'
}
