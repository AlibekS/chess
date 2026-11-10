"""FastAPI-приложение «Fischer Chess Coach».

Запуск для разработки:
    uvicorn app.main:app --reload --port 8000

Если собран фронтенд (frontend/dist), он раздаётся этим же сервером —
тогда весь сайт живёт на http://localhost:8000.
"""
from __future__ import annotations

import io
import json
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterator, Optional

import chess
import chess.pgn
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, guess, insights, rating, repertoire


def ensure_database() -> None:
    """При первом запуске индексирует встроенный архив партий Фишера."""
    conn = db.connect()
    try:
        db.ensure_user_schema(conn)
        ready = db.reference_ready(conn)
    finally:
        conn.close()
    if not ready:
        import sys

        sys.path.insert(0, str(db.BACKEND_DIR))
        from scripts.build_fischer_db import build

        print("База партий Фишера не найдена — индексирую встроенный архив (несколько секунд)...")
        build((db.DATA_DIR / "fischer.pgn").read_text(encoding="utf-8", errors="replace"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_database()
    yield


app = FastAPI(title="Fischer Chess Coach", lifespan=lifespan)
# Vite dev-сервер ходит на бэкенд с другого порта
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn() -> Iterator[sqlite3.Connection]:
    conn = db.connect()
    try:
        yield conn
    finally:
        conn.close()


def profile_dict(conn: sqlite3.Connection) -> dict:
    row = dict(conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone())
    row["calibrated"] = bool(row["calibrated"])
    row["training_plan"] = json.loads(row["training_plan"]) if row["training_plan"] else None
    return row


# ------------------------------ Служебное ----------------------------------
@app.get("/api/health")
def health(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    return {
        "status": "ok",
        "fischer_games": conn.execute("SELECT COUNT(*) FROM fischer_games").fetchone()[0],
        "fischer_positions": conn.execute("SELECT COUNT(*) FROM fischer_positions").fetchone()[0],
        "puzzles": conn.execute("SELECT COUNT(*) FROM puzzles").fetchone()[0],
    }


# ------------------------- Исторические инсайты ----------------------------
class FenIn(BaseModel):
    fen: str


@app.post("/api/position-check")
def position_check(body: FenIn, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    """Фронтенд шлёт FEN — бэкенд отдаёт факт из партий Фишера (или match: none)."""
    try:
        return insights.check_position(conn, body.fen)
    except ValueError:
        raise HTTPException(400, "Некорректный FEN")


# -------------------------------- Профиль ----------------------------------
class ProfileIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)


@app.get("/api/profile")
def get_profile(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    return profile_dict(conn)


@app.put("/api/profile")
def update_profile(body: ProfileIn, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    conn.execute("UPDATE user_profile SET username = ? WHERE id = 1", (body.username.strip(),))
    conn.commit()
    return profile_dict(conn)


@app.post("/api/profile/reset")
def reset_profile(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    """Сброс профиля: стирает историю и возвращает к калибровке."""
    for table in ("user_profile", "user_games", "repertoire_progress", "puzzle_attempts"):
        conn.execute(f"DELETE FROM {table}")
    conn.execute("INSERT INTO user_profile (id) VALUES (1)")
    conn.commit()
    return profile_dict(conn)


# ------------------------------- Калибровка --------------------------------
class PuzzleOutcome(BaseModel):
    rating: int
    solved: bool
    themes: str = ""


class CalibrationGame(BaseModel):
    acpl: float
    moves: int


class CalibrationIn(BaseModel):
    experience: str
    concepts: str
    self_rating: Optional[int] = Field(default=None, ge=400, le=2400)
    puzzles: list[PuzzleOutcome] = []
    game: Optional[CalibrationGame] = None


@app.post("/api/calibration")
def calibration(body: CalibrationIn, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    result = rating.calibrate(body.model_dump())
    conn.execute(
        "UPDATE user_profile SET estimated_rating = ?, calibrated = 1, training_plan = ? WHERE id = 1",
        (result["rating"], json.dumps(result["plan"], ensure_ascii=False)),
    )
    conn.commit()
    return {**result, "profile": profile_dict(conn)}


# --------------------------------- Задачи ----------------------------------
def puzzle_payload(row: sqlite3.Row) -> dict:
    """Формат Lichess: первый ход в moves делает соперник, дальше решение."""
    return {"id": row["id"], "fen": row["fen"], "moves": row["moves"].split(),
            "rating": row["rating"], "themes": row["themes"]}


@app.get("/api/puzzles/next")
def next_puzzle(
    target: int = Query(1200, alias="rating", ge=0, le=3500),
    exclude: str = "",
    theme: str = Query("", pattern="^[A-Za-z0-9]*$"),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    """Задача, ближайшая по сложности к rating и ещё не решавшаяся.

    theme — необязательный фильтр по теме Lichess (например, rookEndgame).
    """
    skip = {x for x in exclude.split(",") if x}
    skip |= {r[0] for r in conn.execute("SELECT puzzle_id FROM puzzle_attempts")}
    rows = conn.execute(
        "SELECT * FROM puzzles WHERE themes LIKE ? ORDER BY ABS(rating - ?), RANDOM() LIMIT ?",
        (f"%{theme}%", target, len(skip) + 8),
    ).fetchall()
    fresh = [r for r in rows if r["id"] not in skip]
    if not fresh:  # всё перерешали — разрешаем повторы
        fresh = [r for r in rows if r["id"] not in {x for x in exclude.split(",") if x}] or rows
    if not fresh:
        raise HTTPException(404, "Задачи не загружены")
    # Немного случайности среди ближайших, чтобы сессии не были одинаковыми
    import random

    return puzzle_payload(random.choice(fresh[:4]))


class PuzzleResultIn(BaseModel):
    puzzle_id: str
    solved: bool
    rated: bool = True  # в калибровке рейтинг не трогаем — его посчитает /api/calibration


@app.post("/api/puzzles/result")
def puzzle_result(body: PuzzleResultIn, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    row = conn.execute("SELECT rating FROM puzzles WHERE id = ?", (body.puzzle_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Нет такой задачи")
    conn.execute("INSERT INTO puzzle_attempts (puzzle_id, solved) VALUES (?, ?)",
                 (body.puzzle_id, int(body.solved)))
    if body.solved:
        conn.execute("UPDATE user_profile SET tactics_solved = tactics_solved + 1 WHERE id = 1")
    if body.rated:
        me = conn.execute("SELECT estimated_rating FROM user_profile WHERE id = 1").fetchone()[0]
        new = rating.elo_update(me, row["rating"], 1.0 if body.solved else 0.0, k=10)
        conn.execute("UPDATE user_profile SET estimated_rating = ? WHERE id = 1", (new,))
    conn.commit()
    return profile_dict(conn)


# -------------------------------- Репертуар --------------------------------
@app.get("/api/repertoire")
def get_repertoire(conn: sqlite3.Connection = Depends(get_conn)) -> list[dict]:
    return repertoire.all_lines(conn)


class AttemptIn(BaseModel):
    errors: int = Field(ge=0)
    with_hints: bool = False


@app.post("/api/repertoire/{line_id}/attempt")
def repertoire_attempt(line_id: str, body: AttemptIn, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    try:
        progress = repertoire.record_attempt(conn, line_id, body.errors, body.with_hints)
    except KeyError:
        raise HTTPException(404, "Нет такой линии")
    return {"progress": progress, "profile": profile_dict(conn)}


# ------------------------------ Угадай ход ---------------------------------
@app.get("/api/guess/games")
def guess_games(conn: sqlite3.Connection = Depends(get_conn)) -> list[dict]:
    return guess.list_games(conn)


@app.get("/api/guess/games/{game_id}")
def guess_game(game_id: int, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    game = guess.get_game(conn, game_id)
    if not game:
        raise HTTPException(404, "Партия не найдена")
    return game


class PointsIn(BaseModel):
    points: int = Field(ge=0, le=2000)


@app.post("/api/guess/score")
def guess_score(body: PointsIn, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    conn.execute("UPDATE user_profile SET guess_points = guess_points + ? WHERE id = 1", (body.points,))
    conn.commit()
    return profile_dict(conn)


# ---------------------------- История партий -------------------------------
class GameIn(BaseModel):
    pgn: str = Field(min_length=1, max_length=100_000)
    user_color: str = Field(pattern="^[wb]$")
    result: str = Field(pattern=r"^(1-0|0-1|1/2-1/2|\*)$")
    opponent_rating: Optional[int] = None
    kind: str = "training"
    accuracy: Optional[float] = None
    coach_summary: Optional[str] = None


class GamePatch(BaseModel):
    accuracy: Optional[float] = None
    coach_summary: Optional[str] = None


def normalize_pgn(pgn: str) -> str:
    """Проверяет PGN через python-chess и возвращает его в каноническом виде."""
    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None or game.errors or not list(game.mainline_moves()):
        raise HTTPException(400, "Не удалось разобрать PGN")
    return game.accept(chess.pgn.StringExporter(headers=True, variations=False, comments=False))


@app.post("/api/games")
def save_game(body: GameIn, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    pgn = normalize_pgn(body.pgn)
    cur = conn.execute(
        "INSERT INTO user_games (pgn, user_color, result, accuracy, coach_summary, opponent_rating, kind)"
        " VALUES (?,?,?,?,?,?,?)",
        (pgn, body.user_color, body.result, body.accuracy, body.coach_summary,
         body.opponent_rating, body.kind),
    )
    # Рейтинг пересчитываем только за доигранные тренировочные партии с ботом
    if body.kind == "training" and body.result != "*" and body.opponent_rating:
        prof = conn.execute("SELECT estimated_rating, games_played FROM user_profile WHERE id = 1").fetchone()
        if body.result == "1/2-1/2":
            score = 0.5
        else:
            score = 1.0 if (body.result == "1-0") == (body.user_color == "w") else 0.0
        new = rating.elo_update(prof["estimated_rating"], body.opponent_rating, score,
                                rating.k_factor(prof["games_played"]))
        conn.execute(
            "UPDATE user_profile SET estimated_rating = ?, games_played = games_played + 1 WHERE id = 1",
            (new,),
        )
    conn.commit()
    return {"id": cur.lastrowid, "profile": profile_dict(conn)}


@app.get("/api/games")
def list_user_games(conn: sqlite3.Connection = Depends(get_conn)) -> list[dict]:
    rows = conn.execute(
        "SELECT id, date, user_color, result, accuracy, coach_summary, opponent_rating, kind"
        " FROM user_games ORDER BY id DESC LIMIT 100"
    ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/games/{game_id}")
def get_user_game(game_id: int, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    row = conn.execute("SELECT * FROM user_games WHERE id = ?", (game_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Партия не найдена")
    return dict(row)


@app.patch("/api/games/{game_id}")
def patch_user_game(game_id: int, body: GamePatch, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    """Дописывает результаты анализа (точность, вердикт тренера)."""
    cur = conn.execute(
        "UPDATE user_games SET accuracy = COALESCE(?, accuracy),"
        " coach_summary = COALESCE(?, coach_summary) WHERE id = ?",
        (body.accuracy, body.coach_summary, game_id),
    )
    conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, "Партия не найдена")
    return {"ok": True}


# ------------------------- Раздача собранного фронтенда --------------------
STATIC_DIR = Path(os.environ.get("COACH_STATIC_DIR", db.BACKEND_DIR.parent / "frontend" / "dist"))
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    if (STATIC_DIR / "vendor").is_dir():
        app.mount("/vendor", StaticFiles(directory=STATIC_DIR / "vendor"), name="vendor")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        """Одностраничное приложение: всё, что не API, отдаёт index.html."""
        if path.startswith("api/"):
            raise HTTPException(404)
        candidate = (STATIC_DIR / path).resolve()
        if path and candidate.is_file() and STATIC_DIR.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
