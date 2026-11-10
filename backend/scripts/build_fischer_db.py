#!/usr/bin/env python3
"""Фаза 1 ТЗ: сбор и индексация данных.

Разбирает PGN-архив партий Фишера через python-chess, раскладывает каждую
партию по позициям (нормализованный FEN + маска пешек) и заливает в SQLite.
Заодно загружает тактические задачи Lichess.

Запуск:
    python scripts/build_fischer_db.py                # из встроенного data/fischer.pgn
    python scripts/build_fischer_db.py --pgn my.pgn   # из своего архива
    python scripts/build_fischer_db.py --download URL # скачать PGN или ZIP с PGN

Пользовательские таблицы (профиль, история партий) скрипт не трогает.
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

import chess
import chess.pgn

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import db  # noqa: E402
from app.positions import normalize_fen, pawn_hash  # noqa: E402

FISCHER_TAG = "fischer"


def load_openings(path: Path) -> dict[str, tuple[str, str]]:
    """Справочник Lichess: позиция (EPD) -> (ECO, название дебюта)."""
    book: dict[str, tuple[str, str]] = {}
    if not path.exists():
        return book
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            eco, name, pgn_moves = parts[0], parts[1], parts[2]
            board = chess.Board()
            try:
                for token in pgn_moves.split():
                    if token.endswith("."):
                        continue
                    board.push_san(token)
            except ValueError:
                continue
            book[normalize_fen(board)] = (eco, name)
    return book


def read_pgn_text(args: argparse.Namespace) -> str:
    if args.download:
        print(f"Скачиваю {args.download} ...")
        raw = urllib.request.urlopen(args.download, timeout=60).read()
        if raw[:2] == b"PK":  # ZIP-архив с PGN внутри
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                name = next(n for n in zf.namelist() if n.lower().endswith(".pgn"))
                raw = zf.read(name)
        return raw.decode("utf-8", errors="replace")
    return Path(args.pgn).read_text(encoding="utf-8", errors="replace")


def build(pgn_text: str, quiet: bool = False) -> dict[str, int]:
    """Пересоздаёт справочные таблицы. Возвращает статистику."""
    openings = load_openings(db.DATA_DIR / "openings.tsv")
    conn = db.connect()
    conn.executescript(db.REFERENCE_SCHEMA)
    db.ensure_user_schema(conn)

    games = positions = skipped = 0
    stream = io.StringIO(pgn_text)
    while True:
        game = chess.pgn.read_game(stream)
        if game is None:
            break
        h = game.headers
        white, black = h.get("White", "?"), h.get("Black", "?")
        if FISCHER_TAG in white.lower():
            color = "w"
        elif FISCHER_TAG in black.lower():
            color = "b"
        else:
            skipped += 1
            continue
        # Партии с нестандартной начальной позиции и с ошибками записи пропускаем:
        # лучше меньше партий, чем неверные «исторические факты».
        if h.get("FEN") or game.errors:
            skipped += 1
            continue
        moves = list(game.mainline_moves())
        if len(moves) < 10:
            skipped += 1
            continue

        board = game.board()
        rows = []
        opening_name, eco = None, h.get("ECO") or None
        for ply, move in enumerate(moves):
            key = normalize_fen(board)
            if key in openings:  # самое глубокое известное название
                eco_book, opening_name = openings[key]
                eco = eco or eco_book
            rows.append((key, pawn_hash(board), ply, board.san(move)))
            board.push(move)
        # Финальная позиция — без сделанного хода
        rows.append((normalize_fen(board), pawn_hash(board), len(moves), None))

        date = h.get("Date", "")
        year = int(date[:4]) if date[:4].isdigit() else None
        exporter = chess.pgn.StringExporter(headers=True, variations=False, comments=False)
        cur = conn.execute(
            "INSERT INTO fischer_games (event, site, year, round, white, black, result,"
            " eco, opening_name, pgn, fischer_color, plies) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (h.get("Event"), h.get("Site"), year, h.get("Round"), white, black,
             h.get("Result"), eco, opening_name, game.accept(exporter), color, len(moves)),
        )
        gid = cur.lastrowid
        conn.executemany(
            "INSERT INTO fischer_positions (game_id, fen_normalized, pawn_hash, ply, move_played)"
            " VALUES (?,?,?,?,?)",
            [(gid, *r) for r in rows],
        )
        games += 1
        positions += len(rows)

    # --- Задачи Lichess ---
    puzzles = 0
    puzzles_csv = db.DATA_DIR / "puzzles.csv"
    if puzzles_csv.exists():
        with puzzles_csv.open(encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                conn.execute(
                    "INSERT OR IGNORE INTO puzzles (id, fen, moves, rating, themes) VALUES (?,?,?,?,?)",
                    (r["PuzzleId"], r["FEN"], r["Moves"], int(r["Rating"]), r["Themes"]),
                )
                puzzles += 1

    conn.commit()
    conn.close()
    stats = {"games": games, "positions": positions, "skipped": skipped, "puzzles": puzzles}
    if not quiet:
        print(f"Готово: партий {games}, позиций {positions}, пропущено {skipped}, задач {puzzles}")
        print(f"База: {db.DB_PATH}")
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pgn", default=str(db.DATA_DIR / "fischer.pgn"), help="путь к PGN-архиву")
    ap.add_argument("--download", help="URL PGN-файла или ZIP-архива с PGN")
    args = ap.parse_args()
    build(read_pgn_text(args))


if __name__ == "__main__":
    main()
