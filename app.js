// ===== STATE =====
const state = {
  players: [],
  winningScore: null,
  round: 1,
  scores: [],       // scores[playerIndex] = total score
  history: [],      // history[roundIndex] = { scores: [perPlayerScore] }
};

// ===== DOM REFS =====
const playerNameInput   = document.getElementById('player-name-input');
const addPlayerBtn      = document.getElementById('add-player-btn');
const playerList        = document.getElementById('player-list');
const playerHint        = document.getElementById('player-hint');
const winningScoreInput = document.getElementById('winning-score-input');
const startGameBtn      = document.getElementById('start-game-btn');
const setupScreen       = document.getElementById('setup-screen');
const gameScreen        = document.getElementById('game-screen');
const gameTargetHint    = document.getElementById('game-target-hint');
const roundTitle        = document.getElementById('round-title');
const roundScoreList    = document.getElementById('round-score-list');
const submitRoundBtn    = document.getElementById('submit-round-btn');
const undoRoundBtn      = document.getElementById('undo-round-btn');
const scoreboardSection = document.getElementById('scoreboard-section');
const scoreboardThead   = document.getElementById('scoreboard-thead');
const scoreboardTbody   = document.getElementById('scoreboard-tbody');
const standingsSection  = document.getElementById('standings-section');
const standingsList     = document.getElementById('standings-list');
const finalScoresList   = document.getElementById('final-scores-list');
const winnerOverlay     = document.getElementById('winner-overlay');
const winnerNameEl      = document.getElementById('winner-name');
const confettiContainer = document.getElementById('confetti-container');
const newGameBtn        = document.getElementById('new-game-btn');
const restartGameBtn    = document.getElementById('restart-game-btn');

// ===== PLAYER MANAGEMENT =====

function addPlayer() {
  const name = playerNameInput.value.trim();
  if (!name) return;

  // Prevent duplicate names (case-insensitive)
  if (state.players.some(p => p.toLowerCase() === name.toLowerCase())) {
    shakeInput(playerNameInput);
    return;
  }

  state.players.push(name);
  playerNameInput.value = '';
  playerNameInput.focus();
  renderPlayers();
  updateStartButton();
}

function removePlayer(index) {
  const item = playerList.children[index];
  if (!item) return;

  item.classList.add('removing');
  item.addEventListener('animationend', () => {
    state.players.splice(index, 1);
    renderPlayers();
    updateStartButton();
  });
}

function renderPlayers() {
  playerList.innerHTML = '';

  state.players.forEach((name, i) => {
    const li = document.createElement('li');
    li.className = 'player-item';
    li.innerHTML = `
      <span class="player-name">
        <span class="player-number">${i + 1}</span>
        ${escapeHtml(name)}
      </span>
      <button class="btn-remove" aria-label="Remove ${escapeHtml(name)}" data-index="${i}">&times;</button>
    `;
    playerList.appendChild(li);
  });

  // Update hint visibility
  playerHint.style.display = state.players.length >= 2 ? 'none' : 'block';
}

// ===== WINNING SCORE =====

function handleScoreChange() {
  const val = parseInt(winningScoreInput.value, 10);
  state.winningScore = val > 0 ? val : null;
  updateStartButton();
}

// ===== START BUTTON =====

function updateStartButton() {
  const ready = state.players.length >= 2 && state.winningScore > 0;
  startGameBtn.disabled = !ready;
}

// ===== GAME START =====

function startGame() {
  if (state.players.length < 2 || !state.winningScore) return;

  // Initialise scores
  state.scores = state.players.map(() => 0);
  state.round = 1;
  state.history = [];

  setupScreen.classList.remove('active');
  gameScreen.classList.add('active');

  gameTargetHint.textContent = `First to ${state.winningScore} wins!`;
  renderRoundInputs();
}

// ===== ROUND SCORE ENTRY =====

function renderRoundInputs() {
  const maxScore = state.scores && state.scores.length > 0 ? Math.max(...state.scores) : -1;
  const isTiebreaker = maxScore >= state.winningScore;

  roundTitle.textContent = isTiebreaker 
    ? `Round ${state.round} (Tiebreaker!)` 
    : `Round ${state.round}`;
  
  roundScoreList.innerHTML = '';

  state.players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'round-score-row';
    row.innerHTML = `
      <span class="round-player-name">${escapeHtml(name)}</span>
      <input
        type="number"
        class="text-input round-score-input"
        data-player="${i}"
        placeholder="0"
        step="1"
        inputmode="numeric"
      />
    `;
    roundScoreList.appendChild(row);
  });
}

function submitRound() {
  const inputs = roundScoreList.querySelectorAll('.round-score-input');
  const roundScores = [];

  inputs.forEach((input) => {
    const val = parseInt(input.value, 10);
    roundScores.push(isNaN(val) ? 0 : val);
  });

  // Update totals
  roundScores.forEach((pts, i) => {
    state.scores[i] += pts;
  });

  state.history.push({ scores: [...roundScores] });
  state.round++;

  undoRoundBtn.style.display = '';
  renderStandings();
  renderScoreboard();
  renderRoundInputs();

  // Check for a winner after updating everything
  checkForWinner();
}

function undoRound() {
  if (state.history.length === 0) return;

  const last = state.history.pop();

  // Subtract last round's scores from totals
  last.scores.forEach((pts, i) => {
    state.scores[i] -= pts;
  });

  state.round--;

  // Hide undo button if no more history
  if (state.history.length === 0) {
    undoRoundBtn.style.display = 'none';
    scoreboardSection.style.display = 'none';
    standingsSection.style.display = 'none';
  } else {
    renderStandings();
    renderScoreboard();
  }

  renderRoundInputs();

  // Pre-fill the inputs with the undone scores so user can correct them
  const inputs = roundScoreList.querySelectorAll('.round-score-input');
  inputs.forEach((input, i) => {
    input.value = last.scores[i];
  });
}

// ===== STANDINGS =====

function renderStandings() {
  if (state.history.length === 0) return;

  standingsSection.style.display = '';

  // Build ranked list sorted by score descending
  const ranked = state.players.map((name, i) => ({
    name,
    score: state.scores[i],
  }));
  ranked.sort((a, b) => b.score - a.score);

  const ordinals = ['1st', '2nd', '3rd'];

  standingsList.innerHTML = ranked.map((p, i) => {
    const rank = ordinals[i] || `${i + 1}th`;
    const pct = Math.max(0, Math.min(100, (p.score / state.winningScore) * 100));
    const remaining = state.winningScore - p.score;
    const remainLabel = remaining > 0
      ? `${remaining} to go`
      : '🏆 Winner!';

    return `
      <div class="standing-row${remaining <= 0 ? ' standing-winner' : ''}">
        <div class="standing-rank">${rank}</div>
        <div class="standing-info">
          <div class="standing-name-row">
            <span class="standing-name">${escapeHtml(p.name)}</span>
            <span class="standing-score">${p.score} pts</span>
          </div>
          <div class="standing-bar-track">
            <div class="standing-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="standing-remaining">${remainLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ===== SCOREBOARD =====

function renderScoreboard() {
  if (state.history.length === 0) return;

  scoreboardSection.style.display = '';

  // Build header row: Player | R1 | R2 | ... | Total
  let headHtml = '<tr><th class="sb-player-col">Player</th>';
  state.history.forEach((_, i) => {
    headHtml += `<th class="sb-round-col">R${i + 1}</th>`;
  });
  headHtml += '<th class="sb-total-col">Total</th></tr>';
  scoreboardThead.innerHTML = headHtml;

  // Build body rows
  let bodyHtml = '';
  state.players.forEach((name, pi) => {
    bodyHtml += `<tr><td class="sb-player-col">${escapeHtml(name)}</td>`;
    state.history.forEach((round) => {
      const pts = round.scores[pi];
      const cls = pts < 0 ? 'sb-neg' : '';
      bodyHtml += `<td class="sb-round-col ${cls}">${pts}</td>`;
    });
    const total = state.scores[pi];
    bodyHtml += `<td class="sb-total-col">${total}</td></tr>`;
  });
  scoreboardTbody.innerHTML = bodyHtml;
}

// ===== UTILITIES =====

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function shakeInput(el) {
  el.style.animation = 'none';
  // Trigger reflow
  void el.offsetWidth;
  el.style.animation = 'shake 0.35s ease';
  el.addEventListener('animationend', () => {
    el.style.animation = '';
  }, { once: true });
}

// Inject shake keyframes dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

// ===== EVENT LISTENERS =====

addPlayerBtn.addEventListener('click', addPlayer);

playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addPlayer();
});

playerList.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-remove');
  if (btn) {
    removePlayer(parseInt(btn.dataset.index, 10));
  }
});

winningScoreInput.addEventListener('input', handleScoreChange);

startGameBtn.addEventListener('click', startGame);

submitRoundBtn.addEventListener('click', submitRound);

undoRoundBtn.addEventListener('click', undoRound);

newGameBtn.addEventListener('click', () => location.reload());

restartGameBtn.addEventListener('click', restartGame);

function restartGame() {
  // Keep players and winningScore, reset everything else
  state.scores = state.players.map(() => 0);
  state.round = 1;
  state.history = [];

  // Hide winner overlay and scoreboard/standings
  winnerOverlay.style.display = 'none';
  confettiContainer.innerHTML = '';
  scoreboardSection.style.display = 'none';
  standingsSection.style.display = 'none';
  undoRoundBtn.style.display = 'none';

  renderRoundInputs();
}

// ===== WINNER CELEBRATION =====

function checkForWinner() {
  if (state.scores.length === 0) return;
  
  const maxScore = Math.max(...state.scores);
  if (maxScore < state.winningScore) return;

  const leaders = [];
  state.scores.forEach((s, idx) => {
    if (s === maxScore) leaders.push(state.players[idx]);
  });

  if (leaders.length === 1) {
    showWinner(leaders[0]);
  }
}

function showWinner(name) {
  winnerNameEl.textContent = name;
  
  // Populate final scores list
  const ranked = state.players.map((p, i) => ({
    name: p,
    score: state.scores[i]
  })).sort((a, b) => b.score - a.score);

  finalScoresList.innerHTML = ranked.map(p => `
    <div class="final-score-row ${p.name === name ? 'winner-row' : ''}">
      <span class="final-score-name">${escapeHtml(p.name)}</span>
      <span class="final-score-pts">${p.score} pts</span>
    </div>
  `).join('');

  winnerOverlay.style.display = '';
  spawnConfetti();
}

function spawnConfetti() {
  confettiContainer.innerHTML = '';
  const colors = ['#E3643B', '#e87a55', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444'];
  const count = 80;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 2 + 's';
    piece.style.animationDuration = (2 + Math.random() * 3) + 's';
    piece.style.setProperty('--rand', Math.random());

    // Randomize shape
    const size = 6 + Math.random() * 8;
    if (Math.random() > 0.5) {
      piece.style.width = size + 'px';
      piece.style.height = size * 0.6 + 'px';
    } else {
      piece.style.width = size + 'px';
      piece.style.height = size + 'px';
      piece.style.borderRadius = '50%';
    }

    confettiContainer.appendChild(piece);
  }
}
