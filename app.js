(function() {
  "use strict";

  var STORAGE_KEY = "tic_tac_toe_score_v1";
  var HUMAN = "X";
  var AI = "O";
  var WINS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  var state = {
    board: ["", "", "", "", "", "", "", "", ""],
    locked: false,
    winner: null,
    winLine: [],
    score: {
      x: 0,
      o: 0,
      draw: 0
    }
  };

  var toastTimer = null;

  function loadScore() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        Object.assign(state.score, JSON.parse(saved));
      }
    } catch (error) {
      console.warn("Could not load score", error);
    }
  }

  function saveScore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.score));
    } catch (error) {
      console.warn("Could not save score", error);
    }
  }

  function render() {
    document.querySelectorAll("[data-cell]").forEach(function(cell) {
      var index = Number(cell.dataset.cell);
      var mark = state.board[index];
      cell.textContent = mark;
      cell.classList.toggle("x", mark === HUMAN);
      cell.classList.toggle("o", mark === AI);
      cell.classList.toggle("win", state.winLine.indexOf(index) !== -1);
      cell.setAttribute("aria-label", cellName(index) + (mark ? ", " + mark : ", empty"));
    });

    setText("x-score", state.score.x);
    setText("o-score", state.score.o);
    setText("draw-score", state.score.draw);
    setText("game-status", statusText());
  }

  function setText(id, text) {
    var element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function statusText() {
    if (state.winner === HUMAN) return "You win";
    if (state.winner === AI) return "Display wins";
    if (state.winner === "draw") return "Draw game";
    if (state.locked) return "Display thinking";
    return "Your turn";
  }

  function cellName(index) {
    return [
      "Top left",
      "Top center",
      "Top right",
      "Middle left",
      "Middle center",
      "Middle right",
      "Bottom left",
      "Bottom center",
      "Bottom right"
    ][index];
  }

  function playCell(index) {
    if (state.locked || state.winner || state.board[index]) {
      showToast(state.winner ? "Start a new round" : "Choose an empty square");
      return;
    }

    state.board[index] = HUMAN;
    if (finishIfGameOver()) return;

    state.locked = true;
    render();

    window.setTimeout(function() {
      state.board[pickAiMove()] = AI;
      state.locked = false;
      finishIfGameOver();
      render();
      focusNextEmpty(index);
    }, 320);
  }

  function finishIfGameOver() {
    var result = getResult(state.board);
    if (!result) {
      render();
      return false;
    }

    state.winner = result.winner;
    state.winLine = result.line || [];

    if (result.winner === HUMAN) {
      state.score.x += 1;
      showToast("You win");
    } else if (result.winner === AI) {
      state.score.o += 1;
      showToast("Display wins");
    } else {
      state.score.draw += 1;
      showToast("Draw game");
    }

    saveScore();
    render();
    return true;
  }

  function getResult(board) {
    for (var i = 0; i < WINS.length; i += 1) {
      var line = WINS[i];
      var first = board[line[0]];
      if (first && first === board[line[1]] && first === board[line[2]]) {
        return { winner: first, line: line };
      }
    }

    if (board.every(Boolean)) return { winner: "draw", line: [] };
    return null;
  }

  function pickAiMove() {
    var winningMove = findWinningMove(AI);
    if (winningMove !== null) return winningMove;

    var blockingMove = findWinningMove(HUMAN);
    if (blockingMove !== null) return blockingMove;

    return firstOpen([4, 0, 2, 6, 8, 1, 3, 5, 7]);
  }

  function findWinningMove(mark) {
    for (var i = 0; i < WINS.length; i += 1) {
      var line = WINS[i];
      var values = line.map(function(index) { return state.board[index]; });
      var marks = values.filter(function(value) { return value === mark; }).length;
      var blanks = values.filter(function(value) { return value === ""; }).length;

      if (marks === 2 && blanks === 1) {
        for (var j = 0; j < line.length; j += 1) {
          if (!state.board[line[j]]) return line[j];
        }
      }
    }

    return null;
  }

  function firstOpen(indexes) {
    for (var i = 0; i < indexes.length; i += 1) {
      if (!state.board[indexes[i]]) return indexes[i];
    }
    return 0;
  }

  function newRound() {
    state.board = ["", "", "", "", "", "", "", "", ""];
    state.locked = false;
    state.winner = null;
    state.winLine = [];
    render();
    focusCell(0);
  }

  function resetScore() {
    state.score = { x: 0, o: 0, draw: 0 };
    saveScore();
    newRound();
    showToast("Score reset");
  }

  function focusCell(index) {
    var cell = document.querySelector('[data-cell="' + index + '"]');
    if (cell) cell.focus();
  }

  function focusNextEmpty(fromIndex) {
    if (state.winner) return;
    for (var offset = 1; offset <= 9; offset += 1) {
      var index = (fromIndex + offset) % 9;
      if (!state.board[index]) {
        focusCell(index);
        return;
      }
    }
  }

  function moveFocus(direction) {
    var active = document.activeElement;
    var cellIndex = active && active.dataset ? Number(active.dataset.cell) : NaN;

    if (!Number.isNaN(cellIndex)) {
      var row = Math.floor(cellIndex / 3);
      var col = cellIndex % 3;

      if (direction === "down" && row === 2) {
        focusAction(0);
        return;
      }

      if (direction === "up" && row === 0) {
        focusAction(1);
        return;
      }

      if (direction === "up") row = (row + 2) % 3;
      if (direction === "down") row = (row + 1) % 3;
      if (direction === "left") col = (col + 2) % 3;
      if (direction === "right") col = (col + 1) % 3;

      focusCell(row * 3 + col);
      return;
    }

    var focusables = Array.prototype.slice.call(document.querySelectorAll(".focusable"));
    var currentIndex = focusables.indexOf(active);
    var delta = direction === "up" || direction === "left" ? -1 : 1;
    var nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + focusables.length) % focusables.length;
    focusables[nextIndex].focus();
  }

  function focusAction(index) {
    var actions = document.querySelectorAll("[data-action]");
    if (actions[index]) actions[index].focus();
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(function() {
      toast.classList.remove("visible");
    }, 2200);
  }

  function handleAction(action) {
    if (action === "new-round") newRound();
    if (action === "reset-score") resetScore();
  }

  function setupEvents() {
    document.addEventListener("click", function(event) {
      var cell = event.target.closest("[data-cell]");
      if (cell) {
        playCell(Number(cell.dataset.cell));
        return;
      }

      var action = event.target.closest("[data-action]");
      if (action) handleAction(action.dataset.action);
    });

    document.addEventListener("keydown", function(event) {
      switch (event.key) {
        case "ArrowUp":
          moveFocus("up");
          event.preventDefault();
          break;
        case "ArrowDown":
          moveFocus("down");
          event.preventDefault();
          break;
        case "ArrowLeft":
          moveFocus("left");
          event.preventDefault();
          break;
        case "ArrowRight":
          moveFocus("right");
          event.preventDefault();
          break;
        case "Enter":
          if (document.activeElement && document.activeElement.classList.contains("focusable")) {
            document.activeElement.click();
            event.preventDefault();
          }
          break;
        case "Escape":
          newRound();
          event.preventDefault();
          break;
      }
    });
  }

  function clearOldCaches() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        registrations.forEach(function(registration) {
          registration.unregister();
        });
      }).catch(function(error) {
        console.warn("Could not unregister service worker", error);
      });
    }

    if ("caches" in window) {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) {
          caches.delete(key);
        });
      }).catch(function(error) {
        console.warn("Could not clear caches", error);
      });
    }
  }

  function init() {
    loadScore();
    setupEvents();
    render();
    focusCell(0);
    clearOldCaches();
    hideLoadingScreen();
  }

  function hideLoadingScreen() {
    var loadingScreen = document.getElementById("loading-screen");
    if (!loadingScreen) return;

    loadingScreen.classList.add("hidden");
    window.setTimeout(function() {
      loadingScreen.remove();
    }, 220);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
