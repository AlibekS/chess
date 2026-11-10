"""Режим «Угадай ход Фишера»: подборка знаменитых партий из базы.

SELECTORS — это не сами партии, а «адреса» в базе (белые, чёрные, год,
турнир, тур). Если партии с таким адресом в базе нет, она просто не
попадёт в список. Ходы всегда берутся из PGN в базе.
"""
from __future__ import annotations

import io
import sqlite3

import chess
import chess.pgn

from . import ru

TARGET_COUNT = 50
DEFAULT_START_PLY = 16  # угадывать начинаем после дебюта (примерно с 9-го хода)

# (белые, чёрные, год, часть названия турнира | None, тур | None, заголовок, стартовый полуход | None)
SELECTORS: list[tuple] = [
    ("Byrne, Donald", "Fischer", 1956, "Rosenwald", None, "«Партия века»", 21),
    ("Fischer", "Spassky", 1972, "World Championship", "6", "Рейкьявик, 6-я партия: ферзевый гамбит", None),
    ("Byrne, Robert", "Fischer", 1963, "USA-ch", None, "Блестящая миниатюра против Роберта Бирна", None),
    ("Spassky", "Fischer", 1972, "World Championship", "13", "Рейкьявик, 13-я партия: защита Алехина", None),
    ("Spassky", "Fischer", 1972, "World Championship", "3", "Рейкьявик, 3-я партия: первая победа над Спасским", None),
    ("Spassky", "Fischer", 1972, "World Championship", "5", "Рейкьявик, 5-я партия", None),
    ("Fischer", "Spassky", 1972, "World Championship", "10", "Рейкьявик, 10-я партия: испанская", None),
    ("Fischer", "Larsen", 1958, "Portoroz", None, "Разгром «дракона»", None),
    ("Fischer", "Tal", 1961, "Bled", None, "Победа над Талем в Бледе", None),
    ("Fischer", "Benko", 1963, "USA-ch", None, "Знаменитая жертва ладьи на f6", None),
    ("Fischer", "Petrosian", 1971, "Candidats final", "7", "Финал претендентов, 7-я партия", None),
    ("Fischer", "Taimanov", 1971, "Candidats", "4", "Матч с Таймановым, 4-я партия", None),
    ("Fischer", "Larsen", 1971, "Candidats", "1", "Матч с Ларсеном, 1-я партия", None),
    ("Fischer", "Petrosian", 1970, "URS-World", "1", "«Матч века», 1-я партия", None),
    ("Letelier", "Fischer", 1960, "Leipzig", None, "Олимпиада в Лейпциге: жертва ферзя", None),
    ("Fischer", "Myagmarsuren", 1967, "Sousse", None, "Староиндийская атака в Сусе", None),
    ("Fischer", "Stein", 1967, "Sousse", None, "Испанская против Штейна", None),
    ("Fischer", "Reshevsky", 1958, "USA-ch", None, "Ловушка для Решевского", None),
    ("Fischer", "Gligoric", 1966, "olm", None, "Разменный вариант испанской", None),
    ("Fischer", "Portisch", 1966, "olm", None, "Разменный вариант: эндшпиль", None),
    ("Fischer", "Unzicker", 1970, "Siegen", None, "Олимпиада в Зигене", None),
    ("Fischer", "Rubinetti", 1970, "Palma", None, "Атака Созина в Пальме", None),
    ("Fischer", "Najdorf", 1962, "Varna", None, "Победа над автором варианта", None),
    ("Keres", "Fischer", 1959, "Candidats", None, "Турнир претендентов: победа над Кересом", None),
    ("Fischer", "Bolbochan", 1962, "Stockholm", None, "Межзональный в Стокгольме", None),
    ("Saidy", "Fischer", 1963, "USA-ch", None, "11 из 11: последняя партия", None),
    ("Fischer", "Spassky", 1992, None, "1", "Возвращение: 1-я партия матча 1992 года", None),
    ("Fischer", "Andersson", 1970, "Siegen", None, "1.b3 против Андерссона", None),
    ("Fischer", "Panno", 1970, "Buenos Aires", None, "Староиндийское начало в Буэнос-Айресе", None),
    ("Fischer", "Bisguier", 1963, "USA-ch", None, "Испанская против Бисгайера", None),
    ("Fischer", "Euwe", 1960, "Leipzig", None, "Победа над экс-чемпионом мира", None),
    ("Smyslov", "Fischer", 1970, None, None, "Блиц в Херцег-Нови: Смыслов", None),
    ("Larsen", "Fischer", 1971, "Candidats", None, "Матч с Ларсеном", None),
    ("Taimanov", "Fischer", 1971, "Candidats", None, "Матч с Таймановым", None),
    ("Petrosian", "Fischer", 1971, "Candidats final", None, "Финал претендентов", None),
    ("Fischer", "Mecking", 1970, "Palma", None, "Межзональный в Пальме", None),
    ("Fischer", "Sherwin", 1957, None, None, "Юный Фишер против Шервина", None),
    ("Pilnik", "Fischer", 1959, "Mar del Plata", None, "Мар-дель-Плата, 1959", None),
    ("Fischer", "Gligoric", 1959, "Candidats", None, "Турнир претендентов: атака Созина", None),
    ("Fischer", "Benko", 1959, "Candidats", None, "Турнир претендентов: Бенко", None),
    ("Szabo", "Fischer", 1960, "Leipzig", None, "Олимпиада в Лейпциге: Сабо", None),
    ("Bertok", "Fischer", 1962, "Stockholm", None, "Стокгольм: висячие пешки", None),
    ("Fischer", "Geller", 1961, "Bled", None, "Миниатюра против Геллера", None),
    ("Fischer", "Keres", 1962, "Candidats", None, "Кюрасао: победа над Кересом", None),
    ("Fischer", "Kortschnoj", 1962, None, None, "Победа над Корчным", None),
    ("Fischer", "Dely", 1967, "Skopje", None, "Миниатюра в Скопье", None),
    ("Fischer", "Gheorghiu", 1970, "Buenos Aires", None, "Русская партия против Георгиу", None),
    ("Fischer", "Schweber", 1970, "Buenos Aires", None, "Комбинация против Швебера", None),
    ("Fischer", "Ivkov", 1970, None, None, "Блиц в Херцег-Нови: Ивков", None),
    ("Uhlmann", "Fischer", 1970, "Palma", None, "Победа чёрными над Ульманом", None),
    ("Gligoric", "Fischer", 1970, None, None, "Староиндийская против Глигорича", None),
]


def _fischer_outcome(row: sqlite3.Row) -> str:
    return ru.RESULT_FOR_FISCHER.get((row["result"], row["fischer_color"]), "unknown")


def _resolve(conn: sqlite3.Connection) -> list[dict]:
    chosen: list[dict] = []
    used: set[int] = set()
    for white, black, year, event, rnd, title, start in SELECTORS:
        sql = "SELECT * FROM fischer_games WHERE white LIKE ? AND black LIKE ? AND year = ?"
        params: list = [f"{white}%", f"{black}%", year]
        if event:
            sql += " AND event LIKE ?"
            params.append(f"%{event}%")
        if rnd:
            sql += " AND round = ?"
            params.append(rnd)
        # Если адрес неоднозначен — берём победу Фишера, затем самую раннюю запись
        rows = conn.execute(sql + " ORDER BY id", params).fetchall()
        rows = [r for r in rows if r["id"] not in used]
        if not rows:
            continue
        wins = [r for r in rows if _fischer_outcome(r) == "win"]
        row = (wins or rows)[0]
        used.add(row["id"])
        chosen.append({"row": row, "title": title, "start": start})

    # Добираем до 50 победами над сильнейшими соперниками (без блица и сеансов)
    if len(chosen) < TARGET_COUNT:
        rows = conn.execute(
            "SELECT * FROM fischer_games WHERE plies BETWEEN 40 AND 120"
            " AND event NOT LIKE '%blitz%' AND event NOT LIKE '% sim' ORDER BY year DESC, id"
        ).fetchall()
        for r in rows:
            if len(chosen) >= TARGET_COUNT:
                break
            opp = r["black"] if r["fischer_color"] == "w" else r["white"]
            if r["id"] in used or _fischer_outcome(r) != "win" or not ru.is_known_opponent(opp):
                continue
            used.add(r["id"])
            chosen.append({"row": r, "title": None, "start": None})
    return chosen[:TARGET_COUNT]


def _summary(item: dict) -> dict:
    r = item["row"]
    color = r["fischer_color"]
    opp = r["black"] if color == "w" else r["white"]
    nom, _ = ru.opponent_names(opp)
    pairing = f"Фишер — {nom}" if color == "w" else f"{nom} — Фишер"
    return {
        "id": r["id"],
        "title": item["title"] or pairing,
        "pairing": pairing,
        "year": r["year"],
        "ref": ru.game_ref(r["event"], r["site"], r["year"], r["round"]),
        "opening_ru": ru.opening_ru(r["opening_name"]),
        "eco": r["eco"],
        "fischer_color": color,
        "result": r["result"],
        "moves_count": (r["plies"] + 1) // 2,
    }


def list_games(conn: sqlite3.Connection) -> list[dict]:
    return [_summary(item) for item in _resolve(conn)]


def get_game(conn: sqlite3.Connection, game_id: int) -> dict | None:
    for item in _resolve(conn):
        if item["row"]["id"] == game_id:
            break
    else:
        return None
    r = item["row"]
    game = chess.pgn.read_game(io.StringIO(r["pgn"]))
    board = game.board()
    sans = []
    for mv in game.mainline_moves():
        sans.append(board.san(mv))
        board.push(mv)
    # Первый полуход, который угадываем: ход Фишера не раньше стартового
    start = item["start"] if item["start"] is not None else DEFAULT_START_PLY
    fischer_parity = 0 if r["fischer_color"] == "w" else 1
    if start % 2 != fischer_parity:
        start += 1
    start = min(start, max(fischer_parity, len(sans) - 2))
    return {**_summary(item), "moves": sans, "start_ply": start,
            "white": r["white"], "black": r["black"]}
