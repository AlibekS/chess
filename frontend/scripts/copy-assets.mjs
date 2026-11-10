// Копирует в public/vendor то, что должно раздаваться как статические файлы:
//  - спрайты и CSS доски cm-chessboard;
//  - движок Stockfish (WASM, однопоточная lite-сборка — не требует COOP/COEP-заголовков).
// Запускается автоматически перед `npm run dev` и `npm run build`.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vendor = join(root, 'public', 'vendor')
rmSync(vendor, { recursive: true, force: true })
mkdirSync(join(vendor, 'stockfish'), { recursive: true })

cpSync(join(root, 'node_modules/cm-chessboard/assets'), join(vendor, 'cm-chessboard'), { recursive: true })
for (const ext of ['js', 'wasm']) {
  const name = `stockfish-19-lite-single.${ext}`
  cpSync(join(root, 'node_modules/stockfish/bin', name), join(vendor, 'stockfish', name))
}
console.log('vendor-файлы скопированы в public/vendor')
