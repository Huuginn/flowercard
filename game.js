const GAME_ID = "B1ljgiyzTIfaBiGfhsBN";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const statusText = document.getElementById("statusText");
const roomCodeText = document.getElementById("roomCodeText");
const boardEl = document.getElementById("board");
const cells = Array.from(document.querySelectorAll(".cell"));
const restartBtn = document.getElementById("restartBtn");

function checkResult(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((v) => v !== null)) return "draw";
  return null;
}

function emptyBoard() {
  return Array(9).fill(null);
}

// 방장(host)만 게임 상태를 실제로 바꾼다. 나머지 플레이어는 상태를 읽어서 화면만 갱신한다.
function setupHostLogic() {
  Playroom.onPlayerJoin((player) => {
    let order = Playroom.getState("playerOrder") || [];
    if (!order.includes(player.id) && order.length < 2) {
      order = [...order, player.id];
      Playroom.setState("playerOrder", order, true);
      if (order.length === 2) {
        Playroom.setState("board", emptyBoard(), true);
        Playroom.setState("turn", 0, true);
        Playroom.setState("winner", null, true);
        Playroom.setState("status", "playing", true);
      } else {
        Playroom.setState("status", "waiting", true);
      }
    }

    player.onQuit(() => {
      Playroom.setState("status", "ended", true);
    });
  });

  Playroom.RPC.register("makeMove", (payload, senderPlayer) => {
    const order = Playroom.getState("playerOrder") || [];
    const turn = Playroom.getState("turn");
    const winner = Playroom.getState("winner");
    const board = Playroom.getState("board") || emptyBoard();

    if (winner) return;
    const senderIndex = order.indexOf(senderPlayer.id);
    if (senderIndex !== turn) return;

    const idx = payload.index;
    if (idx < 0 || idx > 8 || board[idx]) return;

    const symbol = turn === 0 ? "X" : "O";
    const newBoard = [...board];
    newBoard[idx] = symbol;
    const result = checkResult(newBoard);

    Playroom.setState("board", newBoard, true);
    Playroom.setState("turn", 1 - turn, true);
    Playroom.setState("winner", result, true);
  });

  Playroom.RPC.register("restartGame", () => {
    Playroom.setState("board", emptyBoard(), true);
    Playroom.setState("turn", 0, true);
    Playroom.setState("winner", null, true);
  });
}

function attemptMove(idx) {
  Playroom.RPC.call("makeMove", { index: idx }, Playroom.RPC.Mode.HOST);
}

function requestRestart() {
  Playroom.RPC.call("restartGame", {}, Playroom.RPC.Mode.HOST);
}

function render() {
  const order = Playroom.getState("playerOrder") || [];
  const status = Playroom.getState("status") || "waiting";
  const board = Playroom.getState("board") || emptyBoard();
  const turn = Playroom.getState("turn");
  const winner = Playroom.getState("winner");

  const roomCode = Playroom.getRoomCode();
  if (roomCode) {
    roomCodeText.hidden = false;
    roomCodeText.textContent = "방 코드: " + roomCode;
  }

  const myId = Playroom.myPlayer().id;
  const myIndex = order.indexOf(myId);
  const mySymbol = myIndex === 0 ? "X" : myIndex === 1 ? "O" : null;

  if (status === "waiting") {
    boardEl.hidden = true;
    restartBtn.hidden = true;
    statusText.textContent = "친구가 들어오기를 기다리는 중... (방 코드를 공유해주세요)";
    return;
  }

  if (status === "ended") {
    boardEl.hidden = true;
    restartBtn.hidden = true;
    statusText.textContent = "상대방이 나갔어요. 게임이 종료되었습니다.";
    return;
  }

  boardEl.hidden = false;

  cells.forEach((cell, i) => {
    const value = board[i];
    cell.textContent = value || "";
    cell.classList.toggle("x", value === "X");
    cell.classList.toggle("o", value === "O");
    cell.disabled = Boolean(value) || Boolean(winner) || myIndex !== turn;
  });

  if (winner === "draw") {
    statusText.textContent = "무승부입니다!";
    restartBtn.hidden = false;
  } else if (winner) {
    statusText.textContent =
      winner === mySymbol ? "당신이 이겼어요! 🎉" : "상대가 이겼어요.";
    restartBtn.hidden = false;
  } else {
    restartBtn.hidden = true;
    statusText.textContent =
      myIndex === turn
        ? `당신 차례입니다 (${mySymbol})`
        : `상대 차례를 기다리는 중... (당신은 ${mySymbol})`;
  }
}

cells.forEach((cell) => {
  cell.addEventListener("click", () => {
    const idx = Number(cell.dataset.index);
    if (!cell.disabled) attemptMove(idx);
  });
});

restartBtn.addEventListener("click", requestRestart);

Playroom.insertCoin(
  {
    gameId: GAME_ID,
    maxPlayersPerRoom: 2,
  },
  () => {
    if (Playroom.isHost()) {
      setupHostLogic();
    }
    setInterval(render, 200);
    render();
  },
  (error) => {
    statusText.textContent = "연결에 실패했어요: " + error.message;
  }
);
