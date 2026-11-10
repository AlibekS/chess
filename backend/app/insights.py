"""Исторические инсайты тренера (Zero-Hallucination).

Все факты — соперник, год, турнир, сыгранный ход, результат — берутся
ТОЛЬКО из таблиц fischer_games / fischer_positions. Текст собирается по
шаблонам из строк базы; если совпадений нет, тренер молчит.

Единственное, что не из базы, — общие планы игры для дебютных семейств
(PLANS): это не факты о партиях, а стандартные шахматные идеи.
"""
from __future__ import annotations

import sqlite3
from collections import Counter

import chess

from . import ru
from .positions import normalize_fen, pawn_hash, structure_is_distinctive

# Типовые планы по дебютным семействам (английское название из справочника)
PLANS: dict[str, str] = {
    "Sicilian Defense": "Ключевой план чёрных — давление по полуоткрытой линии «c» и контригра на ферзевом фланге; белые обязаны атаковать, пока у них перевес в развитии.",
    "Ruy Lopez": "Белые долго держат давление на e5 и готовят d4. Терпение: позиция сама подскажет момент для прорыва в центре.",
    "King's Indian Defense": "Центр закрыт — значит, играют фланги. Чёрные идут f5 и атакуют короля, белые ломают ферзевый фланг. Кто быстрее, тот и прав.",
    "French Defense": "Пешечная цепь указывает, где играть: белые — на королевском фланге, чёрные подрывают центр ходами c5 и f6.",
    "Caro-Kann Defense": "Чёрные прочны, но пассивны. Захватывай пространство и не давай без боя разменять белопольного слона.",
    "Grünfeld Defense": "Чёрные отдали центр, чтобы его бить: слон g7 и ход c5 давят на d4. Центр белых — и сила, и мишень.",
    "Neo-Grünfeld Defense": "Чёрные отдали центр, чтобы его бить: слон g7 и ход c5 давят на d4. Центр белых — и сила, и мишень.",
    "English Opening": "Борьба идёт за поле d5 и длинную диагональ. Не позволяй сопернику спокойно доразвиться — бей в центре при первой возможности.",
    "Queen's Gambit Declined": "Классическая структура: белые играют на ферзевом фланге и по линии «c», чёрные добиваются освобождающего c5 или e5.",
    "Nimzo-Indian Defense": "Чёрные контролируют e4 фигурами. Если у белых сдвоенные пешки «c» — блокируй их и дави на c4.",
    "King's Indian Attack": "Схема простая: e5, затем h4, Nf1–h2–g4 и атака на короля. Чёрные должны успеть на ферзевом фланге.",
    "Pirc Defense": "Чёрные позволяют занять центр. Занимай его пешками и атакуй — пассивность здесь наказывается.",
    "Alekhine Defense": "Чёрные провоцируют пешки вперёд. Держи центр, но не растягивайся: каждая продвинутая пешка требует защиты.",
    "Benoni Defense": "У чёрных пешечное большинство на ферзевом фланге и слон g7, у белых — центр и прорыв e5. Позиция для тех, кто считает варианты.",
}
VARIATION_PLANS: list[tuple[str, str]] = [
    ("Najdorf", "Это Найдорф: ход a6 готовит b5 и отнимает поле b5 у фигур. Ключевой план — давление по полуоткрытой линии «c» и контратака на ферзевом фланге."),
    ("Sozin", "Слон на c4 нацелен на e6 и f7. План белых — f4–f5, вскрыть диагональ и ударить по королю, пока чёрные возятся на ферзевом фланге."),
    ("Dragon", "Против «дракона» рецепт известен: вскрыть линию «h» и разменять слона g7. Дальше — жертвы и мат."),
    ("Exchange", "В разменном варианте испанской у белых здоровое пешечное большинство на королевском фланге. Меняй фигуры — пешечный эндшпиль выигран."),
    ("Winawer", "Чёрные отдали чернопольного слона. Используй чёрные поля и два слона, пока структура чёрных не закрепилась."),
]


def _plan_for(opening_name: str | None) -> str:
    if not opening_name:
        return ""
    for key, text in VARIATION_PLANS:
        if key in opening_name:
            # «Exchange» относится только к испанской партии
            if key == "Exchange" and not opening_name.startswith("Ruy Lopez"):
                continue
            return text
    family = opening_name.partition(":")[0].split(",")[0].strip()
    return PLANS.get(family, "")


def _game_dict(row: sqlite3.Row) -> dict:
    color = row["fischer_color"]
    opp_pgn = row["black"] if color == "w" else row["white"]
    nom, gen = ru.opponent_names(opp_pgn)
    return {
        "id": row["id"],
        "white": row["white"],
        "black": row["black"],
        "fischer_color": color,
        "opponent": opp_pgn,
        "opponent_ru": nom,
        "opponent_gen": gen,
        "known_opponent": ru.is_known_opponent(opp_pgn),
        "event": row["event"],
        "site": row["site"],
        "year": row["year"],
        "round": row["round"],
        "result": row["result"],
        "outcome": ru.RESULT_FOR_FISCHER.get((row["result"], color), "unknown"),
        "eco": row["eco"],
        "opening_name": row["opening_name"],
        "opening_ru": ru.opening_ru(row["opening_name"]),
        "ref": ru.game_ref(row["event"], row["site"], row["year"], row["round"]),
    }


_OUTCOME_TAIL = {
    "win": "Партию я выиграл.",
    "draw": "Партия закончилась вничью.",
    "loss": "Ту партию я проиграл — такое тоже надо помнить.",
    "unknown": "",
}


def _pick_example(games: list[dict]) -> dict:
    """Самая «звучная» партия: известный соперник, затем более поздний год."""
    return sorted(games, key=lambda g: (not g["known_opponent"], -(g["year"] or 0)))[0]


def _score(games: list[dict]) -> dict:
    c = Counter(g["outcome"] for g in games)
    total = c["win"] + c["draw"] + c["loss"]
    pct = round(100 * (c["win"] + 0.5 * c["draw"]) / total) if total else None
    return {"wins": c["win"], "draws": c["draw"], "losses": c["loss"], "score_pct": pct}


def check_position(conn: sqlite3.Connection, fen: str) -> dict:
    """Главная функция: ищет позицию в партиях Фишера.

    Возвращает dict с полем match: 'exact' | 'structure' | 'none'.
    """
    board = chess.Board(fen)  # ValueError при кривом FEN ловит вызывающий код
    key = normalize_fen(board)

    rows = conn.execute(
        "SELECT g.*, p.move_played, p.ply FROM fischer_positions p"
        " JOIN fischer_games g ON g.id = p.game_id WHERE p.fen_normalized = ?"
        " ORDER BY g.year, g.id",
        (key,),
    ).fetchall()

    if rows:
        return _exact(board, rows)
    if structure_is_distinctive(board):
        return _structure(conn, board)
    return {"match": "none", "total_games": 0}


# --- Случай А: точное совпадение позиции -----------------------------------
def _exact(board: chess.Board, rows: list[sqlite3.Row]) -> dict:
    # Одна партия может проходить позицию дважды (повторение) — берём первое вхождение
    seen: dict[int, dict] = {}
    for r in rows:
        if r["id"] not in seen:
            g = _game_dict(r)
            g["move_played"] = r["move_played"]
            g["ply"] = r["ply"]
            seen[r["id"]] = g
    games = list(seen.values())
    n = len(games)
    side = "w" if board.turn == chess.WHITE else "b"

    # Фишер бывал по обе стороны позиции — считаем отдельно те партии,
    # где в этой позиции ход был именно его.
    fischer_turn_games = [g for g in games if g["fischer_color"] == side and g["move_played"]]
    move_counts = Counter(g["move_played"] for g in fischer_turn_games)
    moves = []
    for san, cnt in move_counts.most_common():
        sub = [g for g in fischer_turn_games if g["move_played"] == san]
        moves.append({"san": san, "count": cnt, **_score(sub)})

    result: dict = {
        "match": "exact",
        "total_games": n,
        "fischer_to_move": bool(fischer_turn_games),
        "fischer_moves": moves,
        "score": _score(games),
        "games": sorted(games, key=lambda g: (not g["known_opponent"], -(g["year"] or 0)))[:8],
    }

    if n <= 3:
        ex = _pick_example(fischer_turn_games or games)
        head = (f"Смотри-ка, ровно такая позиция возникла у меня {ru.color_instr(ex['fischer_color'])}"
                f" против {ex['opponent_gen']} ({ex['ref']})!")
        if ex["fischer_color"] == side and ex["move_played"]:
            result["teaser"] = f"{head} Давай проверим, найдёшь ли ты мой ход."
            result["fischer_move"] = ex["move_played"]
            result["reveal"] = f"Я сыграл здесь {ex['move_played']}. {_OUTCOME_TAIL[ex['outcome']]}".strip()
            result["message"] = f"{head} Я сыграл {ex['move_played']}. {_OUTCOME_TAIL[ex['outcome']]}".strip()
        elif ex["move_played"]:
            result["message"] = (f"{head} Соперник пошёл {ex['move_played']}."
                                 f" {_OUTCOME_TAIL[ex['outcome']]}").strip()
        else:
            result["message"] = f"{head} На этом партия закончилась. {_OUTCOME_TAIL[ex['outcome']]}".strip()
        if n > 1:
            result["message"] += f" Всего эта позиция была в {n} моих {ru.games_word(n)}."
    else:
        sc = result["score"]
        head = (f"Знакомая позиция: она встречалась в {n} моих {ru.games_word(n)}"
                f" (+{sc['wins']} ={sc['draws']} −{sc['losses']}).")
        if moves:
            top = moves[0]
            ex = _pick_example([g for g in fischer_turn_games if g["move_played"] == top["san"]])
            times = ru.plural(top["count"], "раз", "раза", "раз")
            body = (f" Чаще всего я играл здесь {top['san']} ({top['count']} {times}) —"
                    f" например, против {ex['opponent_gen']} ({ex['ref']}).")
            result["teaser"] = f"{head} Найдёшь ход, который я играл здесь чаще всего?"
            result["fischer_move"] = top["san"]
            result["reveal"] = f"Чаще всего я играл здесь {top['san']} ({top['count']} {times})."
        else:
            ex = _pick_example(games)
            body = f" Например, против {ex['opponent_gen']} ({ex['ref']})."
        result["message"] = head + body
    return result


# --- Случай Б: совпадение пешечной структуры -------------------------------
def _structure(conn: sqlite3.Connection, board: chess.Board) -> dict:
    rows = conn.execute(
        "SELECT g.*, MIN(p.ply) AS ply, NULL AS move_played FROM fischer_positions p"
        " JOIN fischer_games g ON g.id = p.game_id WHERE p.pawn_hash = ?"
        " GROUP BY g.id ORDER BY g.year",
        (pawn_hash(board),),
    ).fetchall()
    if not rows:
        return {"match": "none", "total_games": 0}

    games = [_game_dict(r) for r in rows]
    n = len(games)
    # Самый частый дебют среди партий с такой структурой
    named = [g for g in games if g["opening_name"]]
    top_opening = None
    if named:
        fam = Counter(g["opening_ru"] for g in named).most_common(1)[0][0]
        top_opening = next(g for g in named if g["opening_ru"] == fam)

    examples = sorted(games, key=lambda g: (not g["known_opponent"], -(g["year"] or 0)))
    # Не повторяем одного и того же соперника в примерах
    picked, seen_opp = [], set()
    for g in examples:
        if g["opponent"] not in seen_opp:
            picked.append(g)
            seen_opp.add(g["opponent"])
        if len(picked) == 2:
            break
    ex_text = " и ".join(f"{g['opponent_gen']} ({g['year']})" for g in picked)

    msg = "Точно такой позиции в моих партиях нет, но пешечная структура знакома: "
    msg += f"она возникала в {n} моих {ru.games_word(n)}"
    if top_opening:
        msg += f", чаще всего — {top_opening['opening_ru']}"
    msg += f". Например, против {ex_text}."
    plan = _plan_for(top_opening["opening_name"]) if top_opening else ""
    if plan:
        msg += " " + plan

    return {
        "match": "structure",
        "total_games": n,
        "score": _score(games),
        "opening_ru": top_opening["opening_ru"] if top_opening else "",
        "games": examples[:8],
        "message": msg,
    }
