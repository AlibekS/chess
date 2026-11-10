"""Смоук-тесты API. Запуск: pytest (из каталога backend)."""
import os
import tempfile

# Тесты работают на отдельной временной базе, а не на базе пользователя
os.environ["COACH_DB_DIR"] = tempfile.mkdtemp(prefix="coach-test-")

import chess  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def fen_after(*sans: str) -> str:
    board = chess.Board()
    for s in sans:
        board.push_san(s)
    return board.fen()


def test_health(client):
    data = client.get("/api/health").json()
    assert data["fischer_games"] > 800
    assert data["puzzles"] > 1000


def test_exact_match_many_games(client):
    r = client.post("/api/position-check", json={"fen": fen_after("e4", "c5")}).json()
    assert r["match"] == "exact" and r["total_games"] > 50
    assert r["fischer_moves"][0]["san"] == "Nf3"


def test_exact_match_reykjavik_game_6(client):
    """Позиция после 20-го хода чёрных из 6-й партии матча 1972 года — уникальна."""
    moves = ("c4 e6 Nf3 d5 d4 Nf6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 "
             "Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5 O-O Ra7 Be2 Nd7 Nd4 Qf8 "
             "Nxe6 fxe6 e4 d4").split()
    r = client.post("/api/position-check", json={"fen": fen_after(*moves)}).json()
    assert r["match"] == "exact" and r["total_games"] == 1
    assert r["fischer_move"] == "f4"
    assert "Спасского" in r["message"] and "1972" in r["message"] and "6-я партия" in r["message"]


def test_en_passant_field_is_normalized(client):
    """chess.js и python-chess по-разному пишут поле e.p. — совпадение не должно теряться."""
    fen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2"
    assert client.post("/api/position-check", json={"fen": fen}).json()["match"] == "exact"


def test_unknown_position_is_silent(client):
    r = client.post("/api/position-check", json={"fen": fen_after("a4", "h5", "Ra3", "Rh6")}).json()
    assert r["match"] == "none" and "message" not in r


def test_bad_fen(client):
    assert client.post("/api/position-check", json={"fen": "nonsense"}).status_code == 400


def test_repertoire_lines_have_real_stats(client):
    lines = client.get("/api/repertoire").json()
    assert len(lines) >= 15
    first_move = lines[0]["moves"][0]
    assert first_move["san"] == "e4" and first_move["stats"]["games"] > 300


def test_guess_games(client):
    games = client.get("/api/guess/games").json()
    assert len(games) == 50
    century = client.get(f"/api/guess/games/{games[0]['id']}").json()
    assert century["fischer_color"] == "b" and century["moves"][century["start_ply"]] == "Na4"


def test_calibration_and_profile_flow(client):
    client.post("/api/profile/reset")
    p = client.get("/api/puzzles/next", params={"rating": 1200}).json()
    board = chess.Board(p["fen"])
    for uci in p["moves"]:
        board.push_uci(uci)  # решение легально
    body = {"experience": "club", "concepts": "all", "self_rating": 1500,
            "puzzles": [{"rating": 1400, "solved": True, "themes": "fork"},
                        {"rating": 1500, "solved": False, "themes": "pin endgame"}]}
    res = client.post("/api/calibration", json=body).json()
    assert 400 <= res["rating"] <= 2400 and res["profile"]["calibrated"]
    assert len(res["plan"]) >= 3 and "связки" in res["weak_themes"]


def test_save_game_updates_rating(client):
    before = client.get("/api/profile").json()
    res = client.post("/api/games", json={"pgn": "1. e4 e5 2. Qh5 Ke7 3. Qxe5# 1-0", "user_color": "w",
                                          "result": "1-0", "opponent_rating": before["estimated_rating"]}).json()
    assert res["profile"]["estimated_rating"] > before["estimated_rating"]
    assert res["profile"]["games_played"] == before["games_played"] + 1
    assert client.patch(f"/api/games/{res['id']}", json={"accuracy": 91.5}).status_code == 200
    assert client.get(f"/api/games/{res['id']}").json()["accuracy"] == 91.5
