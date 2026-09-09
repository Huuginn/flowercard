const GAME_ID = "B1ljgiyzTIfaBiGfhsBN";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const statusText = document.getElementById("statusText");
const roomCodeText = document.getElementById("roomCodeText");
const roomLinkText = document.getElementById("roomLinkText");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const boardEl = document.getElementById("board");
const cells = Array.from(document.querySelectorAll(".cell"));
const restartBtn = document.getElementById("restartBtn");
const debugText = document.getElementById("debugText");

function inviteLinkFor(roomCode) {
  // Playroom은 해시의 방 코드 앞 글자 하나를 내부적으로 잘라내므로
  // "R"을 붙여서 방 코드가 그대로 전달되게 한다.
  return location.href.split("#")[0] + "#r=R" + roomCode;
}

copyLinkBtn.addEventListener("click", async () => {
  const link = copyLinkBtn.dataset.link;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    const original = copyLinkBtn.textContent;
    copyLinkBtn.textContent = "복사됐어요!";
    setTimeout(() => {
      copyLinkBtn.textContent = original;
    }, 1500);
  } catch (e) {
    statusText.textContent = "복사에 실패했어요. 링크를 길게 눌러 직접 복사해주세요.";
  }
});

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

// 누가 몇 번째로 들어왔는지는 우리가 따로 기록하지 않고,
// Playroom이 이미 관리하고 있는 현재 참가자 목록을 그대로 순서로 사용한다.
// getParticipants()는 실제로는 배열을 반환하므로(타입 정의와 다름) 방어적으로 처리한다.
function getOrder() {
  const participants = Playroom.getParticipants();
  const list = Array.isArray(participants)
    ? participants
    : Object.values(participants || {});
  return list.map((p) => p.id);
}

// 방장(host)만 게임 상태를 실제로 바꾼다. 나머지 플레이어는 상태를 읽어서 화면만 갱신한다.
function hostMaintainGame() {
  if (!Playroom.isHost()) return;
  const order = getOrder();
  if (order.length >= 2 && !Playroom.getState("board")) {
    Playroom.setState("board", emptyBoard(), true);
    Playroom.setState("turn", 0, true);
    Playroom.setState("winner", null, true);
  }
}

function setupHostRPC() {
  Playroom.RPC.register("makeMove", (payload, senderPlayer) => {
    const order = getOrder();
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
  hostMaintainGame();

  const order = getOrder();
  const board = Playroom.getState("board");
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

  debugText.textContent =
    `[디버그] 참가자 ${order.length}명 / host=${Playroom.isHost()} / ` +
    `myId=${myId.slice(0, 5)} / order=${order.map((id) => id.slice(0, 5)).join(",")}`;

  if (order.length < 2 || !board) {
    boardEl.hidden = true;
    restartBtn.hidden = true;
    statusText.textContent = "친구가 들어오기를 기다리는 중... (아래 링크나 방 코드를 공유해주세요)";
    if (roomCode) {
      const link = inviteLinkFor(roomCode);
      roomLinkText.hidden = false;
      roomLinkText.textContent = link;
      copyLinkBtn.hidden = false;
      copyLinkBtn.dataset.link = link;
    }
    return;
  }

  roomLinkText.hidden = true;
  copyLinkBtn.hidden = true;
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
      setupHostRPC();
    }
    setInterval(render, 200);
    render();
  },
  (error) => {
    statusText.textContent = "연결에 실패했어요: " + error.message;
  }
);
