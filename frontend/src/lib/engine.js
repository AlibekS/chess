// Stockfish (WASM) в Web Worker: общение по протоколу UCI.
//
// Один воркер на всё приложение, запросы выполняются строго по очереди.
// Все оценки возвращаются С ТОЧКИ ЗРЕНИЯ БЕЛЫХ в сантипешках (cp),
// мат переводится в большое число (см. scoreToCp).

const ENGINE_URL = '/vendor/stockfish/stockfish-19-lite-single.js'
export const MATE_SCORE = 10000

/** {cp} или {mate} -> число. Мат в N: ±(10000 − N·10). */
export function scoreToCp(score) {
  if (score.mate !== undefined) {
    const sign = score.mate > 0 ? 1 : -1
    return sign * (MATE_SCORE - Math.min(Math.abs(score.mate), 99) * 10)
  }
  return score.cp
}

class Engine {
  constructor() {
    this.worker = null
    this.listeners = new Set()
    this.queue = Promise.resolve()
    this.ready = null
  }

  /** Ленивая инициализация: движок грузится при первом обращении. */
  init() {
    if (!this.ready) {
      this.ready = new Promise((resolve, reject) => {
        try {
          this.worker = new Worker(ENGINE_URL)
        } catch (e) {
          reject(e)
          return
        }
        this.worker.onerror = (e) => reject(e)
        this.worker.onmessage = (e) => {
          const line = typeof e.data === 'string' ? e.data : ''
          for (const fn of [...this.listeners]) fn(line)
        }
        this.waitFor((l) => l === 'uciok').then(() => {
          this.waitFor((l) => l === 'readyok').then(resolve)
          this.send('isready')
        })
        this.send('uci')
      })
    }
    return this.ready
  }

  send(cmd) {
    this.worker.postMessage(cmd)
  }

  waitFor(predicate) {
    return new Promise((resolve) => {
      const fn = (line) => {
        if (predicate(line)) {
          this.listeners.delete(fn)
          resolve(line)
        }
      }
      this.listeners.add(fn)
    })
  }

  /** Ставит задачу в очередь: движок однопоточный и считает одну позицию за раз. */
  enqueue(task) {
    const run = this.queue.then(() => this.init()).then(task)
    this.queue = run.catch(() => {})
    return run
  }

  /**
   * Низкоуровневый поиск.
   * options: { depth, movetime, multipv, skill (0..20), elo (>=1320) }
   * Возвращает { bestmove, lines: [{ cp (от белых), mate, pv: [uci], depth }] }.
   */
  search(fen, options = {}) {
    const { depth, movetime, multipv = 1, skill = 20, elo = null } = options
    return this.enqueue(async () => {
      const whiteToMove = fen.split(' ')[1] === 'w'
      const lines = []
      const onInfo = (line) => {
        if (!line.startsWith('info') || !line.includes(' pv ')) return
        const m = line.match(/ depth (\d+).* multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/)
        if (!m) return
        const raw = m[3] === 'cp' ? { cp: Number(m[4]) } : { mate: Number(m[4]) }
        let cp = scoreToCp(raw)
        let mate = raw.mate
        if (!whiteToMove) {
          cp = -cp
          if (mate !== undefined) mate = -mate
        }
        lines[Number(m[2]) - 1] = { cp, mate, pv: m[5].trim().split(' '), depth: Number(m[1]) }
      }
      this.listeners.add(onInfo)
      this.send(`setoption name MultiPV value ${multipv}`)
      if (elo) {
        this.send('setoption name UCI_LimitStrength value true')
        this.send(`setoption name UCI_Elo value ${elo}`)
      } else {
        this.send('setoption name UCI_LimitStrength value false')
        this.send(`setoption name Skill Level value ${skill}`)
      }
      this.send(`position fen ${fen}`)
      const limits = [depth ? `depth ${depth}` : '', movetime ? `movetime ${movetime}` : ''].join(' ').trim()
      const done = this.waitFor((l) => l.startsWith('bestmove'))
      this.send(`go ${limits || 'depth 12'}`)
      const best = await done
      this.listeners.delete(onInfo)
      const bestmove = best.split(' ')[1]
      return { bestmove: bestmove === '(none)' ? null : bestmove, lines: lines.filter(Boolean) }
    })
  }

  /** Анализ в полную силу: лучший ход и оценка позиции (от белых). */
  async analyze(fen, { depth = 14, movetime = 2000, multipv = 1 } = {}) {
    const res = await this.search(fen, { depth, movetime, multipv })
    const top = res.lines[0]
    return { bestmove: res.bestmove, cp: top ? top.cp : 0, mate: top?.mate, pv: top?.pv || [], lines: res.lines }
  }

  /**
   * Ход бота заданного рейтинга.
   *  - от 1320: штатное ограничение силы Stockfish (UCI_Elo);
   *  - ниже: минимальный Skill Level, малая глубина и доля случайных ходов
   *    (чем ниже рейтинг, тем чаще бот «зевает»).
   */
  async botMove(fen, rating, legalUciMoves) {
    if (rating >= 1320) {
      const res = await this.search(fen, { elo: Math.min(rating, 3190), movetime: 400 })
      return res.bestmove
    }
    const blunderChance = Math.max(0, (1320 - rating) / 2600) // 400 -> ~35 %, 1200 -> ~5 %
    if (legalUciMoves.length > 1 && Math.random() < blunderChance) {
      return legalUciMoves[Math.floor(Math.random() * legalUciMoves.length)]
    }
    const skill = Math.max(0, Math.min(6, Math.round((rating - 400) / 150)))
    const depth = rating < 800 ? 2 : rating < 1100 ? 4 : 6
    const res = await this.search(fen, { skill, depth })
    return res.bestmove
  }
}

export const engine = new Engine()
