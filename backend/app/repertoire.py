"""Репертуар Фишера: линии для тренажёра дебютов.

Сами линии и комментарии к ним — учебный материал (составлен вручную по
реальному репертуару Фишера). А вот статистика «сколько раз позиция была
у Фишера и с каким результатом» считается из базы партий на лету —
никаких цифр «из головы».
"""
from __future__ import annotations

import sqlite3
from functools import lru_cache

import chess

from . import ru
from .positions import normalize_fen

# Каждая линия: id, side ('w'/'b' — за кого играет ученик), group, title,
# moves: [(SAN, комментарий Фишера или None)]
LINES: list[dict] = [
    # ------------------------------ ЗА БЕЛЫХ ------------------------------
    {
        "id": "w_sozin_najdorf", "side": "w", "group": "Сицилианская: атака Фишера — Созина",
        "title": "Созин против Найдорфа (6.Bc4)",
        "moves": [
            ("e4", "1. e4 — лучшее по результатам. Всегда борись за центр сразу."),
            ("c5", None), ("Nf3", "Развитие с темпом к открытию центра."), ("d6", None),
            ("d4", "Вскрываем центр, пока чёрные отстают в развитии."), ("cxd4", None),
            ("Nxd4", None), ("Nf6", None), ("Nc3", None), ("a6", "Найдорф. Я сам играл так чёрными всю жизнь — значит, знаю, как это бить."),
            ("Bc4", "Мой ход. Слон сразу целится на e6 и f7."), ("e6", None),
            ("Bb3", "Слон уходит заранее: на b3 он не попадает под b5 и d5 с темпом."), ("b5", None),
            ("O-O", "Король в безопасности — можно начинать f4–f5."), ("Be7", None),
            ("f4", "План ясен: f5, давление на e6 и диагональ a2–g8."),
        ],
    },
    {
        "id": "w_sozin_classical", "side": "w", "group": "Сицилианская: атака Фишера — Созина",
        "title": "Созин против классической системы (5...Nc6)",
        "moves": [
            ("e4", "1. e4 — лучшее по результатам."), ("c5", None), ("Nf3", None), ("d6", None),
            ("d4", None), ("cxd4", None), ("Nxd4", None), ("Nf6", None), ("Nc3", None), ("Nc6", None),
            ("Bc4", "Та же расстановка: слон на c4 — самая активная диагональ."), ("e6", None),
            ("Bb3", "Профилактика против Na5 и d5 с темпом."), ("Be7", None),
            ("Be3", "Фигуры должны стоять активно, а не просто занимать место на доске."), ("O-O", None),
            ("O-O", "Дальше f4 и f5. Чёрным придётся решать проблему пешки e6."),
        ],
    },
    {
        "id": "w_ruy_exchange", "side": "w", "group": "Испанская партия",
        "title": "Разменный вариант: эндшпиль с большинством",
        "moves": [
            ("e4", "1. e4 — лучшее по результатам."), ("e5", None), ("Nf3", None), ("Nc6", None),
            ("Bb5", "Испанская. Давление на коня — это давление на пешку e5."), ("a6", None),
            ("Bxc6", "Разменный вариант. Я вернул его в большую практику на Олимпиаде в Гаване."), ("dxc6", None),
            ("O-O", "Ключевой ход: теперь пешка e5 действительно под ударом."), ("f6", None),
            ("d4", "Вскрываем игру. После размена на d4 у белых четыре пешки против трёх на королевском фланге."), ("exd4", None),
            ("Nxd4", None), ("c5", None), ("Nb3", None), ("Qxd1", None),
            ("Rxd1", "Эндшпиль приятнее для белых: здоровое большинство против сдвоенных пешек. Два слона чёрных ещё надо суметь использовать."),
        ],
    },
    {
        "id": "w_ruy_exchange_bg4", "side": "w", "group": "Испанская партия",
        "title": "Разменный вариант: 6...Bg4",
        "moves": [
            ("e4", None), ("e5", None), ("Nf3", None), ("Nc6", None), ("Bb5", None), ("a6", None),
            ("Bxc6", None), ("dxc6", None), ("O-O", None), ("f6", None),
            ("d4", "Бей в центре, не откладывая."), ("Bg4", "Чёрные связывают коня и держат напряжение."),
            ("c3", "Укрепляем d4. Центр белых устоит, а связка не вечна."),
        ],
    },
    {
        "id": "w_ruy_closed", "side": "w", "group": "Испанская партия",
        "title": "Закрытый вариант: система Чигорина",
        "moves": [
            ("e4", None), ("e5", None), ("Nf3", None), ("Nc6", None), ("Bb5", None), ("a6", None),
            ("Ba4", "Сохраняем слона. «Испанская пытка» требует терпения."), ("Nf6", None),
            ("O-O", None), ("Be7", None), ("Re1", "Защищаем e4 — теперь угроза Bxc6 и Nxe5 реальна."), ("b5", None),
            ("Bb3", None), ("d6", None), ("c3", "Готовим d4 и даём слону отступление на c2."), ("O-O", None),
            ("h3", "Не пускаем слона на g4. Маленький ход, без которого d4 не работает."), ("Na5", None),
            ("Bc2", "Слон сохранён — он ещё скажет своё слово по диагонали b1–h7."), ("c5", None),
            ("d4", "Центр занят. Белые давят, чёрные вынуждены защищаться."), ("Qc7", None),
            ("Nbd2", "Конь идёт по маршруту f1–g3 или f1–e3. В испанской каждая фигура знает своё место."),
        ],
    },
    {
        "id": "w_ruy_breyer", "side": "w", "group": "Испанская партия",
        "title": "Закрытый вариант: система Брейера",
        "moves": [
            ("e4", None), ("e5", None), ("Nf3", None), ("Nc6", None), ("Bb5", None), ("a6", None),
            ("Ba4", None), ("Nf6", None), ("O-O", None), ("Be7", None), ("Re1", None), ("b5", None),
            ("Bb3", None), ("d6", None), ("c3", None), ("O-O", None), ("h3", None),
            ("Nb8", "Брейер: конь перестраивается на d7. Так играл против меня Спасский."),
            ("d4", "Пока чёрные маневрируют, занимаем центр."), ("Nbd7", None),
        ],
    },
    {
        "id": "w_french_winawer", "side": "w", "group": "Французская защита",
        "title": "3.Nc3 Bb4: вариант Винавера с 7.a4",
        "moves": [
            ("e4", None), ("e6", None), ("d4", "Центр из двух пешек — берём, раз дают."), ("d5", None),
            ("Nc3", "Самый принципиальный ход: развитие и защита e4."), ("Bb4", None),
            ("e5", "Захватываем пространство и отнимаем поле f6 у коня."), ("c5", None),
            ("a3", "Заставляем слона определиться."), ("Bxc3+", None), ("bxc3", None), ("Ne7", None),
            ("a4", "Слон выйдет на a3 — чёрные поля теперь мои. Заодно пешка не даёт блокировать ферзевый фланг."),
            ("Nbc6", None), ("Nf3", "Спокойное развитие. Два слона заговорят, когда игра вскроется."),
        ],
    },
    {
        "id": "w_french_classical", "side": "w", "group": "Французская защита",
        "title": "3.Nc3 Nf6 4.Bg5: вариант Бёрна",
        "moves": [
            ("e4", None), ("e6", None), ("d4", None), ("d5", None), ("Nc3", None), ("Nf6", None),
            ("Bg5", "Связка. Давление на d5 усиливается."), ("dxe4", None),
            ("Nxe4", "Конь в центре — прекрасная фигура."), ("Be7", None),
            ("Bxf6", "Меняем защитника и сохраняем сильного коня на e4."), ("Bxf6", None),
            ("Nf3", "У белых больше пространства и свободная игра. Этого достаточно, чтобы давить."),
        ],
    },
    {
        "id": "w_kia_french", "side": "w", "group": "Французская защита",
        "title": "Староиндийское начало против французской (2.d3)",
        "moves": [
            ("e4", None), ("e6", None), ("d3", "Иногда я уклонялся от теории и ставил староиндийскую схему с лишним темпом."), ("d5", None),
            ("Nd2", "Защищаем e4 без размена ферзей."), ("Nf6", None), ("g3", None), ("c5", None),
            ("Bg2", None), ("Nc6", None), ("Ngf3", None), ("Be7", None), ("O-O", None), ("O-O", None),
            ("e5", "Клин! Конь f6 изгнан, королевский фланг чёрных остаётся без защитников."), ("Nd7", None),
            ("Re1", "Пешка e5 — основа атаки, её надо укрепить."), ("b5", None),
            ("Nf1", "Маршрут Nf1–h2–g4, затем h4–h5. Чёрные играют на ферзевом фланге, но мат важнее пешек."),
        ],
    },
    {
        "id": "w_caro_two_knights", "side": "w", "group": "Защита Каро-Канн",
        "title": "Вариант двух коней",
        "moves": [
            ("e4", None), ("c6", None), ("Nc3", "Два коня: быстрое развитие вместо автоматического d4."), ("d5", None),
            ("Nf3", None), ("Bg4", None), ("h3", "Сразу спрашиваем слона."), ("Bxf3", None),
            ("Qxf3", "Преимущество двух слонов получено без всяких уступок."), ("Nf6", None),
            ("d3", "Скромно, но надёжно. Слоны раскроются позже."), ("e6", None),
            ("g3", "Слон выйдет на g2 и будет давить по длинной диагонали."),
        ],
    },
    # ------------------------------ ЗА ЧЁРНЫХ -----------------------------
    {
        "id": "b_najdorf_poisoned", "side": "b", "group": "Сицилианская: вариант Найдорфа",
        "title": "6.Bg5: отравленная пешка",
        "moves": [
            ("e4", None), ("c5", "Сицилианская. Чёрные с первого хода играют на победу."), ("Nf3", None),
            ("d6", None), ("d4", None), ("cxd4", "Меняем фланговую пешку на центральную — полуоткрытая линия «c» теперь наша."),
            ("Nxd4", None), ("Nf6", "Развитие с нападением на e4."), ("Nc3", None),
            ("a6", "Найдорф. Отнимаем поле b5 и готовим b5 или e5 — гибкость важнее всего."),
            ("Bg5", None), ("e6", None), ("f4", None),
            ("Qb6", "Самое принципиальное: бьём по b2. Если уверен в расчёте — бери."), ("Qd2", None),
            ("Qxb2", "Отравленная пешка. Белые получают атаку, чёрные — материал. Я считал, что материал здесь весит больше."),
            ("Rb1", None), ("Qa3", "Ферзь остаётся в игре и мешает белым. Дальше — точная защита и контратака."),
        ],
    },
    {
        "id": "b_najdorf_main", "side": "b", "group": "Сицилианская: вариант Найдорфа",
        "title": "6.Bg5: главная линия с 7...Be7",
        "moves": [
            ("e4", None), ("c5", None), ("Nf3", None), ("d6", None), ("d4", None), ("cxd4", None),
            ("Nxd4", None), ("Nf6", None), ("Nc3", None), ("a6", None), ("Bg5", None),
            ("e6", "Закрываем диагональ и готовим Be7."), ("f4", None),
            ("Be7", "Развязываемся. Спокойно и надёжно."), ("Qf3", None),
            ("Qc7", "Ферзь на линии «c» — стандартное место в сицилианской."), ("O-O-O", None),
            ("Nbd7", "Конь на d7 контролирует e5 и не перекрывает линию «c»."), ("g4", None),
            ("b5", "Контратака! В позициях с разносторонними рокировками время дороже пешки."),
        ],
    },
    {
        "id": "b_najdorf_be2", "side": "b", "group": "Сицилианская: вариант Найдорфа",
        "title": "6.Be2 e5: вариант Опоченского",
        "moves": [
            ("e4", None), ("c5", None), ("Nf3", None), ("d6", None), ("d4", None), ("cxd4", None),
            ("Nxd4", None), ("Nf6", None), ("Nc3", None), ("a6", None), ("Be2", None),
            ("e5", "Вот зачем нужен был a6: конь не может прыгнуть на b5. Берём центр."), ("Nb3", None),
            ("Be7", None), ("O-O", None), ("O-O", None), ("Be3", None),
            ("Qc7", "Дальше Be6 и Nbd7. Поле d5 слабо, но у чёрных отличная фигурная игра."),
        ],
    },
    {
        "id": "b_najdorf_sozin", "side": "b", "group": "Сицилианская: вариант Найдорфа",
        "title": "6.Bc4: против собственного оружия",
        "moves": [
            ("e4", None), ("c5", None), ("Nf3", None), ("d6", None), ("d4", None), ("cxd4", None),
            ("Nxd4", None), ("Nf6", None), ("Nc3", None), ("a6", None), ("Bc4", None),
            ("e6", "Закрываем диагональ слону. Он упирается в гранит."), ("Bb3", None),
            ("b5", "Темп за темпом: грозит b4 с выигрышем пешки e4."),
        ],
    },
    {
        "id": "b_kid_classical", "side": "b", "group": "Староиндийская защита",
        "title": "Классическая система: вариант Мар-дель-Плата",
        "moves": [
            ("d4", None), ("Nf6", None), ("c4", None), ("g6", "Староиндийская. Отдаём центр, чтобы потом его взорвать."),
            ("Nc3", None), ("Bg7", None), ("e4", None), ("d6", None), ("Nf3", None), ("O-O", None),
            ("Be2", None), ("e5", "Удар по центру. Пешку e5 брать бесполезно."), ("O-O", None),
            ("Nc6", "Заставляем белых определиться с центром."), ("d5", None),
            ("Ne7", "Конь идёт на королевский фланг — там будет атака."), ("Ne1", None),
            ("Nd7", "Освобождаем дорогу пешке f."), ("Nd3", None),
            ("f5", "Началось. Чёрные атакуют короля, белые — ферзевый фланг. Кто быстрее?"),
        ],
    },
    {
        "id": "b_kid_samisch", "side": "b", "group": "Староиндийская защита",
        "title": "Система Земиша (5.f3)",
        "moves": [
            ("d4", None), ("Nf6", None), ("c4", None), ("g6", None), ("Nc3", None), ("Bg7", None),
            ("e4", None), ("d6", None), ("f3", "Земиш: белые строят крепкий центр и готовят g4."),
            ("O-O", None), ("Nge2", None), ("e5", "Бьём в центр, как положено."), ("Bg5", None),
            ("c6", "Подрываем d5 и открываем ферзю дорогу на ферзевый фланг."), ("Qd2", None),
        ],
    },
    {
        "id": "b_kid_fianchetto", "side": "b", "group": "Староиндийская защита",
        "title": "Вариант с фианкетто (g3)",
        "moves": [
            ("d4", None), ("Nf6", None), ("c4", None), ("g6", None), ("g3", None), ("Bg7", None),
            ("Bg2", None), ("O-O", None), ("Nc3", None), ("d6", None), ("Nf3", None),
            ("Nc6", "Активное развитие с давлением на d4."), ("O-O", None),
            ("e5", "Центр надо атаковать, иначе задушат."), ("d5", None),
            ("Ne7", "Знакомая структура: дальше Nd7 и f5."),
        ],
    },
    {
        "id": "b_grunfeld_exchange", "side": "b", "group": "Защита Грюнфельда",
        "title": "Разменный вариант с 7.Bc4",
        "moves": [
            ("d4", None), ("Nf6", None), ("c4", None), ("g6", None), ("Nc3", None),
            ("d5", "Грюнфельд. Позволяем белым построить центр — и сразу начинаем его бить."),
            ("cxd5", None), ("Nxd5", None), ("e4", None), ("Nxc3", None), ("bxc3", None),
            ("Bg7", "Слон смотрит на d4 через всю доску."), ("Bc4", None),
            ("c5", "Главный подрыв. Центр белых — и сила, и мишень."), ("Ne2", None),
            ("Nc6", "Ещё одна фигура давит на d4."), ("Be3", None), ("O-O", None), ("O-O", None),
            ("Qc7", "Так я играл против Спасского. Ферзь уходит со связки и готовит Rd8."),
        ],
    },
    {
        "id": "b_grunfeld_russian", "side": "b", "group": "Защита Грюнфельда",
        "title": "Русская система (5.Qb3)",
        "moves": [
            ("d4", None), ("Nf6", None), ("c4", None), ("g6", None), ("Nc3", None), ("d5", None),
            ("Nf3", None), ("Bg7", None), ("Qb3", None),
            ("dxc4", "Отдаём центр, но выигрываем темпы на ферзе."), ("Qxc4", None),
            ("O-O", None), ("e4", None),
            ("Bg4", "Система Смыслова: давим на d4, убирая его защитника."),
        ],
    },
    {
        "id": "b_english", "side": "b", "group": "Против 1.c4",
        "title": "Староиндийская расстановка против английского начала",
        "moves": [
            ("c4", None), ("Nf6", "Гибко: можно перейти и в староиндийскую, и в Грюнфельда."),
            ("Nc3", None), ("g6", None), ("g3", None), ("Bg7", None), ("Bg2", None),
            ("O-O", "Сначала король в безопасность, потом решаем, как бить по центру — e5 или c5."),
        ],
    },
]

_BY_ID = {line["id"]: line for line in LINES}


def _validate() -> None:
    """Проверка при импорте: все линии должны быть легальны."""
    for line in LINES:
        board = chess.Board()
        for san, _ in line["moves"]:
            board.push_san(san)  # ValueError = опечатка в линии


_validate()


def _position_stats(conn: sqlite3.Connection, key: str, side: str) -> dict:
    """Результаты Фишера в партиях, где он играл цветом side и была позиция key."""
    rows = conn.execute(
        "SELECT g.result, COUNT(DISTINCT g.id) AS n FROM fischer_positions p"
        " JOIN fischer_games g ON g.id = p.game_id"
        " WHERE p.fen_normalized = ? AND g.fischer_color = ? GROUP BY g.result",
        (key, side),
    ).fetchall()
    wins = draws = losses = 0
    for r in rows:
        outcome = ru.RESULT_FOR_FISCHER.get((r["result"], side))
        if outcome == "win":
            wins += r["n"]
        elif outcome == "draw":
            draws += r["n"]
        elif outcome == "loss":
            losses += r["n"]
    total = wins + draws + losses
    return {
        "games": total, "wins": wins, "draws": draws, "losses": losses,
        "score_pct": round(100 * (wins + 0.5 * draws) / total) if total else None,
        "win_pct": round(100 * wins / total) if total else None,
    }


@lru_cache(maxsize=1)
def _static_payload_cached(db_path: str) -> list[dict]:
    from . import db

    conn = db.connect()
    try:
        out = []
        for line in LINES:
            board = chess.Board()
            moves = []
            for san, comment in line["moves"]:
                board.push_san(san)
                moves.append({
                    "san": san,
                    "comment": comment,
                    # Статистика Фишера в позиции ПОСЛЕ этого хода
                    "stats": _position_stats(conn, normalize_fen(board), line["side"]),
                })
            # «Ключевая» позиция для карточки линии: самая глубокая, где у Фишера
            # набралось хотя бы 5 партий, — по одной-двум партиям проценты ни о чём.
            key_idx = len(moves) - 1
            for idx in range(len(moves) - 1, 3, -1):
                if moves[idx]["stats"]["games"] >= 5:
                    key_idx = idx
                    break
            no = key_idx // 2 + 1
            key_label = f"{no}.{moves[key_idx]['san']}" if key_idx % 2 == 0 else f"{no}...{moves[key_idx]['san']}"
            out.append({
                "id": line["id"], "side": line["side"], "group": line["group"],
                "title": line["title"], "moves": moves,
                "final_stats": moves[-1]["stats"],
                "key_stats": {**moves[key_idx]["stats"], "after": key_label},
            })
        return out
    finally:
        conn.close()


def all_lines(conn: sqlite3.Connection) -> list[dict]:
    """Линии со статистикой из базы + прогресс пользователя."""
    from . import db

    progress = {r["line_id"]: dict(r) for r in conn.execute("SELECT * FROM repertoire_progress")}
    out = []
    for line in _static_payload_cached(str(db.DB_PATH)):
        p = progress.get(line["id"], {})
        out.append({**line, "progress": {
            "completed": p.get("completed", 0),
            "attempts": p.get("attempts", 0),
            "best_errors": p.get("best_errors"),
        }})
    return out


def record_attempt(conn: sqlite3.Connection, line_id: str, errors: int, with_hints: bool) -> float:
    """Сохраняет попытку; возвращает общий прогресс репертуара (0..1)."""
    if line_id not in _BY_ID:
        raise KeyError(line_id)
    clean = errors == 0 and not with_hints
    conn.execute(
        "INSERT INTO repertoire_progress (line_id, completed, attempts, best_errors) VALUES (?,?,1,?)"
        " ON CONFLICT(line_id) DO UPDATE SET attempts = attempts + 1,"
        " completed = completed + excluded.completed,"
        " best_errors = MIN(COALESCE(best_errors, 999), excluded.best_errors)",
        (line_id, 1 if clean else 0, errors if not with_hints else None),
    )
    done = conn.execute("SELECT COUNT(*) FROM repertoire_progress WHERE completed > 0").fetchone()[0]
    progress = round(done / len(LINES), 3)
    conn.execute("UPDATE user_profile SET fischer_repertoire_progress = ? WHERE id = 1", (progress,))
    conn.commit()
    return progress
