"""Нормализация позиций — общий код для индексации и для поиска.

Важно, чтобы и при сборке базы, и при запросе с фронтенда ключ считался
одной и той же функцией, иначе точные совпадения не найдутся.
"""
from __future__ import annotations

import chess


def normalize_fen(board: chess.Board) -> str:
    """FEN без счётчика полуходов и номера хода.

    Поле взятия на проходе пишется только если взятие реально возможно:
    разные библиотеки (chess.js / python-chess) по-разному заполняют это
    поле после хода пешки на два поля, а нам нужен единый ключ.
    """
    return board.epd(en_passant="legal")


def pawn_hash(board: chess.Board) -> str:
    """Маска пешечной структуры: битборды белых и чёрных пешек."""
    white = board.pawns & board.occupied_co[chess.WHITE]
    black = board.pawns & board.occupied_co[chess.BLACK]
    return f"{white:x}/{black:x}"


def structure_is_distinctive(board: chess.Board) -> bool:
    """Достаточно ли структура «оформилась», чтобы сравнение имело смысл.

    В самом начале партии пешки почти не двигались, и совпадение структуры
    ни о чём не говорит. Требуем минимум три изменения относительно
    исходного построения (ходы пешек или размены).
    """
    start_white = chess.BB_RANK_2
    start_black = chess.BB_RANK_7
    white = board.pawns & board.occupied_co[chess.WHITE]
    black = board.pawns & board.occupied_co[chess.BLACK]
    changed = chess.popcount(start_white & ~white) + chess.popcount(start_black & ~black)
    return changed >= 3
