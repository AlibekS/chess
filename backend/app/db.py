"""SQLite: путь к базе, подключение и схема.

Одна база `coach.db` хранит и справочные данные (партии Фишера, задачи),
и пользовательские (профиль, история). Скрипт `build_fischer_db.py`
пересоздаёт только справочные таблицы — профиль и история не теряются.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
# Каталог с изменяемой базой можно вынести в docker-volume через COACH_DB_DIR.
DB_DIR = Path(os.environ.get("COACH_DB_DIR", BACKEND_DIR / "var"))
DB_PATH = DB_DIR / "coach.db"

# --- Справочные таблицы (пересоздаются при сборке базы) ---------------------
REFERENCE_SCHEMA = """
DROP TABLE IF EXISTS fischer_positions;
DROP TABLE IF EXISTS fischer_games;
DROP TABLE IF EXISTS puzzles;

-- Партии Бобби Фишера
CREATE TABLE fischer_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT,
    site TEXT,
    year INTEGER,
    round TEXT,
    white TEXT,
    black TEXT,
    result TEXT,
    eco TEXT,
    opening_name TEXT,          -- название дебюта (англ., справочник Lichess)
    pgn TEXT,
    fischer_color TEXT,         -- 'w' / 'b' — каким цветом играл Фишер
    plies INTEGER               -- длина партии в полуходах
);

-- Индексированные позиции партий Фишера для быстрого поиска
CREATE TABLE fischer_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER,
    fen_normalized TEXT,        -- FEN без счётчиков: фигуры + очередь + рокировки + e.p.
    pawn_hash TEXT,             -- маска пешек (белые/чёрные) для поиска по структуре
    ply INTEGER,                -- сколько полуходов сделано ДО этой позиции
    move_played TEXT,           -- ход (SAN), сделанный в партии из этой позиции
    annotation TEXT,
    FOREIGN KEY(game_id) REFERENCES fischer_games(id)
);
CREATE INDEX idx_fp_fen ON fischer_positions(fen_normalized);
CREATE INDEX idx_fp_pawn ON fischer_positions(pawn_hash);
CREATE INDEX idx_fp_game ON fischer_positions(game_id, ply);

-- Тактические задачи (открытая база Lichess, CC0)
CREATE TABLE puzzles (
    id TEXT PRIMARY KEY,
    fen TEXT,                   -- позиция ДО хода соперника
    moves TEXT,                 -- UCI через пробел: первый ход — соперника, далее решение
    rating INTEGER,
    themes TEXT
);
CREATE INDEX idx_puzzles_rating ON puzzles(rating);
"""

# --- Пользовательские таблицы (создаются один раз) --------------------------
USER_SCHEMA = """
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY,
    username TEXT DEFAULT 'Player',
    estimated_rating INTEGER DEFAULT 1200,
    games_played INTEGER DEFAULT 0,
    tactics_solved INTEGER DEFAULT 0,
    fischer_repertoire_progress REAL DEFAULT 0.0,
    calibrated INTEGER DEFAULT 0,     -- пройдена ли калибровка
    guess_points INTEGER DEFAULT 0,   -- очки режима «Угадай ход Фишера»
    training_plan TEXT                -- индивидуальный план (JSON)
);

CREATE TABLE IF NOT EXISTS user_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pgn TEXT,
    user_color TEXT,
    result TEXT,
    accuracy REAL,
    coach_summary TEXT,
    opponent_rating INTEGER,
    kind TEXT DEFAULT 'training'      -- training / calibration / imported
);

-- Прогресс по линиям репертуара Фишера
CREATE TABLE IF NOT EXISTS repertoire_progress (
    line_id TEXT PRIMARY KEY,
    completed INTEGER DEFAULT 0,      -- сколько раз линия пройдена без подсказок
    attempts INTEGER DEFAULT 0,
    best_errors INTEGER
);

-- Уже решавшиеся задачи (чтобы не повторяться)
CREATE TABLE IF NOT EXISTS puzzle_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puzzle_id TEXT,
    solved INTEGER,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def connect() -> sqlite3.Connection:
    """Новое подключение (по одному на запрос — SQLite это переносит легко)."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    # check_same_thread=False: FastAPI может открыть и закрыть подключение в разных
    # потоках пула. Подключение при этом всё равно обслуживает ровно один запрос.
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_user_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(USER_SCHEMA)
    conn.execute("INSERT OR IGNORE INTO user_profile (id) VALUES (1)")
    conn.commit()


def reference_ready(conn: sqlite3.Connection) -> bool:
    """Есть ли уже проиндексированные партии Фишера."""
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fischer_positions'"
    ).fetchone()
    if not row:
        return False
    return conn.execute("SELECT COUNT(*) FROM fischer_positions").fetchone()[0] > 0
