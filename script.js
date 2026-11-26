
/* =========================
   基本設定
========================= */

const TAU = Math.PI * 2;
const SPIN_DURATION = 1500;
const STORAGE_KEY = "casinoRouletteData";

let currentMode = "number";
let minNumber = 1;
let maxNumber = 10;
let excludeWinner = false;
let soundEnabled = true;

const colors = [
  "#e74c3c",
  "#3498db",
  "#f1c40f",
  "#2ecc71",
  "#9b59b6",
  "#e67e22",
  "#1abc9c",
  "#34495e"
];

/* =========================
   レーンごとの状態
========================= */

function createLaneState() {
  return {
    rotation: 0,
    isSpinning: false,
    startRotation: 0,
    targetRotation: 0,
    spinStartedAt: 0,
    spinMode: null,
    entriesAtSpin: [],
    winningEntry: null,

    result: null,
    targetPins: null,
    judged: false,
    resultLocked: false,

    excludedNumbers: [],

    numberHistory: [],
    bowlingHistory: []
  };
}

const lanes = [
  createLaneState(),
  createLaneState()
];

const canvases = [
  document.getElementById("rouletteCanvas1"),
  document.getElementById("rouletteCanvas2")
];

const contexts = canvases.map(canvas =>
  canvas.getContext("2d")
);

let animationFrameId = null;


/* =========================
   効果音
========================= */

let audioContext = null;

function playSound(frequency = 600, duration = 0.08) {
  if (!soundEnabled) return;

  try {
    if (!audioContext) {
      audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.log("効果音を再生できませんでした。", error);
  }
}


/* =========================
   ルーレット描画
========================= */

function drawRoulette(laneIndex) {
  const canvas = canvases[laneIndex];
  const ctx = contexts[laneIndex];
  const lane = lanes[laneIndex];

  const entries = lane.isSpinning
    ? lane.entriesAtSpin
    : getEntries(laneIndex);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 12;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (entries.length === 0) return;

  const anglePerEntry = TAU / entries.length;

  entries.forEach((entry, index) => {
    const startAngle =
      -Math.PI / 2 +
      lane.rotation +
      index * anglePerEntry;

    const endAngle = startAngle + anglePerEntry;

    // マス目
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(
      centerX,
      centerY,
      radius,
      startAngle,
      endAngle
    );
    ctx.closePath();

    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 数字・番号
    const middleAngle = startAngle + anglePerEntry / 2;
    const textRadius = radius * 0.63;

    const textX =
      centerX + Math.cos(middleAngle) * textRadius;

    const textY =
      centerY + Math.sin(middleAngle) * textRadius;

    ctx.fillStyle = "#ffffff";
    ctx.font = entries.length > 30
      ? "bold 19px Arial"
      : entries.length > 15
        ? "bold 24px Arial"
        : "bold 32px Arial";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 4;

    ctx.fillText(
      String(entry),
      textX,
      textY
    );

    ctx.shadowBlur = 0;
  });

  // 中央の円
  ctx.beginPath();
  ctx.arc(centerX, centerY, 38, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.lineWidth = 5;
  ctx.strokeStyle = "#333333";
  ctx.stroke();

  ctx.fillStyle = "#222222";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GO", centerX, centerY);
}


/* =========================
   抽選できる数字を取得
========================= */

function getEntries(laneIndex) {
  const lane = lanes[laneIndex];

  if (currentMode === "bowling") {
    return [1, 2, 3, 4, 5, 6];
  }

  const allNumbers = [];

  for (let i = minNumber; i <= maxNumber; i++) {
    allNumbers.push(i);
  }

  if (!excludeWinner) {
    return allNumbers;
  }

  const availableNumbers = allNumbers.filter(
    number => !lane.excludedNumbers.includes(number)
  );

  // 全ての数字が除外されていたらリセット
  if (availableNumbers.length === 0) {
    lane.excludedNumbers = [];
    return allNumbers;
  }

  return availableNumbers;
}


/* =========================
   画面表示の更新
========================= */

function updateModeDisplay() {
  const numberButton = document.getElementById("numberMode");
  const bowlingButton = document.getElementById("bowlingMode");
  const numberSettings = document.getElementById("numberSettings");

  numberButton.classList.toggle(
    "active",
    currentMode === "number"
  );

  bowlingButton.classList.toggle(
    "active",
    currentMode === "bowling"
  );

  numberSettings.classList.toggle(
    "hidden",
    currentMode !== "number"
  );

  lanes.forEach((lane, index) => {
    const bowlingSettings = document.getElementById(
      `bowlingSettings${index + 1}`
    );

    const nextButton = document.getElementById(
      `nextBowlingButton${index + 1}`
    );

    bowlingSettings.classList.toggle(
      "hidden",
      currentMode !== "bowling"
    );

    nextButton.classList.toggle(
      "hidden",
      currentMode !== "bowling"
    );

    updateLaneDisplay(index);
  });
}


function updateLaneDisplay(laneIndex) {
  const lane = lanes[laneIndex];
  const number = laneIndex + 1;

  const spinButton = document.getElementById(
    `spinButton${number}`
  );

  const resultText = document.getElementById(
    `resultText${number}`
  );

  spinButton.disabled =
    lane.isSpinning ||
    (currentMode === "bowling" && lane.resultLocked);

  if (currentMode === "number") {
    spinButton.textContent = lane.isSpinning
      ? "抽選中..."
      : "SPIN!";

    resultText.textContent =
      lane.result !== null ? lane.result : "READY?";

    renderHistory(laneIndex);
    return;
  }

  spinButton.textContent = lane.isSpinning
    ? "抽選中..."
    : lane.resultLocked
      ? "判定待ち・判定済み"
      : "SPIN!";

  resultText.textContent =
    lane.result !== null ? lane.result : "READY?";

  document.getElementById(
    `bowlingNumber${number}`
  ).textContent =
    lane.result !== null ? lane.result : "未抽選";

  document.getElementById(
    `targetPins${number}`
  ).textContent =
    lane.targetPins !== null
      ? `${lane.targetPins}本`
      : "未設定";

  const message = document.getElementById(
    `bowlingMessage${number}`
  );

  const prize = document.getElementById(
    `bowlingPrize${number}`
  );

  if (lane.judged) {
    message.textContent = "判定完了！";
  } else if (lane.resultLocked) {
    message.textContent = "倒したピンの本数を選んでください";
  } else {
    message.textContent = "抽選してください";
  }

  if (!lane.judged) {
    prize.textContent = "判定待ち";
  }

  // ピンボタンの操作制限
  document.querySelectorAll(
    `.pin-button[data-lane="${number}"]`
  ).forEach(button => {
    button.disabled =
      !lane.resultLocked ||
      lane.judged ||
      lane.isSpinning;
  });

  renderHistory(laneIndex);
}


/* =========================
   抽選開始
========================= */

function startSpin(laneIndex) {
  const lane = lanes[laneIndex];

  if (lane.isSpinning) return;

  if (currentMode === "bowling" && lane.resultLocked) {
    return;
  }

  const entries = getEntries(laneIndex);

  if (entries.length === 0) return;

  const winningIndex = Math.floor(
    Math.random() * entries.length
  );

  const winningEntry = entries[winningIndex];

  const anglePerEntry = TAU / entries.length;

  // 現在の角度から、当たりのマスを真上に合わせる
  const normalizedCurrent =
    ((lane.rotation % TAU) + TAU) % TAU;

  const desiredMod =
    (-((winningIndex + 0.5) * anglePerEntry) % TAU + TAU)
    % TAU;

  const delta =
    (desiredMod - normalizedCurrent + TAU) % TAU;

  lane.startRotation = lane.rotation;
  lane.targetRotation =
    lane.rotation + TAU * 5 + delta;

  lane.spinStartedAt = performance.now();

  lane.entriesAtSpin = [...entries];
  lane.winningEntry = winningEntry;

  lane.spinMode = currentMode;
  lane.isSpinning = true;

  if (currentMode === "bowling") {
    lane.resultLocked = true;
  }

  playSound(700, 0.1);

  updateLaneDisplay(laneIndex);

  // 既にアニメーションが動いていなければ開始
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(animationLoop);
  }
}


/* =========================
   ルーレットアニメーション
========================= */

function animationLoop(now) {
  animationFrameId = null;

  let stillSpinning = false;

  lanes.forEach((lane, index) => {
    if (!lane.isSpinning) return;

    stillSpinning = true;

    const elapsed = now - lane.spinStartedAt;
    const progress = Math.min(
      elapsed / SPIN_DURATION,
      1
    );

    // ゆっくり止まる動き
    const easedProgress =
      1 - Math.pow(1 - progress, 3);

    lane.rotation =
      lane.startRotation +
      (lane.targetRotation - lane.startRotation) *
      easedProgress;

    drawRoulette(index);

    if (progress >= 1) {
      finishSpin(index);
    }
  });

  if (lanes.some(lane => lane.isSpinning)) {
    animationFrameId = requestAnimationFrame(animationLoop);
  }
}


/* =========================
   抽選終了
========================= */

function finishSpin(laneIndex) {
  const lane = lanes[laneIndex];
  const number = laneIndex + 1;

  lane.rotation = lane.targetRotation;
  lane.isSpinning = false;

  lane.result = lane.winningEntry;

  drawRoulette(laneIndex);

  if (lane.spinMode === "number") {
    if (excludeWinner) {
      lane.excludedNumbers.push(lane.winningEntry);
    }

    lane.numberHistory.unshift({
      result: lane.winningEntry,
      time: new Date().toLocaleString("ja-JP")
    });

    lane.numberHistory =
      lane.numberHistory.slice(0, 100);

  } else {
    lane.targetPins = lane.winningEntry ;
    lane.judged = false;

    document.getElementById(
      `bowlingMessage${number}`
    ).textContent =
      "倒したピンの本数を選んでください";
  }

  playSound(950, 0.2);

  updateLaneDisplay(laneIndex);
  saveData();
}


/* =========================
   ボウリング判定
========================= */


function judgeBowling(laneIndex, actualPins) {
  const lane = lanes[laneIndex];

  if (!lane.resultLocked) return;
  if (lane.isSpinning) return;
  if (lane.judged) return;
  if (lane.targetPins === null) return;

  lane.judged = true;

  // 目標との差を計算
  const difference = Math.abs(
    actualPins - lane.targetPins
  );

  // 景品判定
  let prize;

  if (difference === 0) {
    prize = "A賞！好きなお菓子２つ！";
  } else if (difference === 1) {
    prize = "B賞！好きなお菓子１つ！";
  } else {
    prize = "参加賞！ランダムでお菓子１つ！";
  }

  const historyItem = {
    number: lane.result,
    target: lane.targetPins,
    actual: actualPins,
    prize: prize,
    time: new Date().toLocaleString("ja-JP")
  };

  lane.bowlingHistory.unshift(historyItem);

  lane.bowlingHistory =
    lane.bowlingHistory.slice(0, 100);

  const number = laneIndex + 1;

  document.getElementById(
    `bowlingPrize${number}`
  ).textContent = prize;

  document.getElementById(
    `bowlingMessage${number}`
  ).textContent =
    `目標 ${lane.targetPins}本 ／ 実際 ${actualPins}本`;

  // 景品ごとに効果音を変更
  if (prize.startsWith("A賞！"))
    playSound(1000, 0.3);
  } else if (prize.startsWith("B賞！")) {
    playSound(700, 0.2);
  } else {
    playSound(350, 0.25);
  }

  updateLaneDisplay(laneIndex);
  saveData();
}



/* =========================
   次のお客さんへ
========================= */

function nextCustomer(laneIndex) {
  const lane = lanes[laneIndex];
   

  if (lane.isSpinning) return;

  const confirmed = confirm(
    `レーン${laneIndex + 1}を次のお客さん用にリセットしますか？`
  );

  if (!confirmed) return;

  lane.result = null;
  lane.targetPins = null;
  lane.judged = false;
  lane.resultLocked = false;
  lane.winningEntry = null;
  lane.entriesAtSpin = [];

  document.getElementById(
    `bowlingPrize${laneIndex + 1}`
  ).textContent = "判定待ち";

  updateLaneDisplay(laneIndex);
  saveData();
}


/* =========================
   履歴表示
========================= */

function renderHistory(laneIndex) {
  const lane = lanes[laneIndex];

  const list = document.getElementById(
    `historyList${laneIndex + 1}`
  );

  list.innerHTML = "";

  const history = currentMode === "number"
    ? lane.numberHistory
    : lane.bowlingHistory;

  if (history.length === 0) {
    const li = document.createElement("li");
    li.textContent = "履歴はありません";
    list.appendChild(li);
    return;
  }

  history.forEach(item => {
    const li = document.createElement("li");

    if (currentMode === "number") {
      li.textContent =
        `${item.time}　結果：${item.result}`;
    } else {
      li.textContent =
        `${item.time}　抽選：${item.number} ／ 目標：${item.target}本 ／ 実際：${item.actual}本 ／ ${item.prize}`;
    }

    list.appendChild(li);
  });
}


/* =========================
   履歴削除
========================= */

function clearHistory(laneIndex) {
  const confirmed = confirm(
    `レーン${laneIndex + 1}の${
      currentMode === "number" ? "数字" : "ボウリング"
    }履歴を削除しますか？\nこの操作は取り消せません。`
  );

  if (!confirmed) return;

  const lane = lanes[laneIndex];

  if (currentMode === "number") {
    lane.numberHistory = [];
  } else {
    lane.bowlingHistory = [];
  }

  renderHistory(laneIndex);
  saveData();
}


/* =========================
   数字設定
========================= */

function applyNumberSettings() {
  const minInput = Number(
    document.getElementById("minNumber").value
  );

  const maxInput = Number(
    document.getElementById("maxNumber").value
  );

  if (
    !Number.isInteger(minInput) ||
    !Number.isInteger(maxInput) ||
    minInput < 0 ||
    maxInput > 100 ||
    minInput >= maxInput
  ) {
    alert(
      "数字の範囲を正しく入力してください。\n最小値は0以上、最大値は100以下です。"
    );
    return;
  }

  if (lanes.some(lane => lane.isSpinning)) {
    alert("抽選中は数字設定を変更できません。");
    return;
  }

  minNumber = minInput;
  maxNumber = maxInput;

  lanes.forEach(lane => {
    lane.excludedNumbers = [];
    lane.result = null;
  });

  lanes.forEach((lane, index) => {
    drawRoulette(index);
    updateLaneDisplay(index);
  });

  saveData();

  alert("数字の設定を変更しました！");
}


/* =========================
   モード切り替え
========================= */

function switchMode(mode) {
  if (mode !== "number" && mode !== "bowling") return;

  currentMode = mode;

  updateModeDisplay();

  lanes.forEach((lane, index) => {
    if (!lane.isSpinning) {
      drawRoulette(index);
    }
  });
}


/* =========================
   データ保存
========================= */

function saveData() {
  const data = {
    minNumber,
    maxNumber,
    excludeWinner,
    soundEnabled,
    currentMode,

    lanes: lanes.map(lane => ({
      rotation: lane.rotation,
      result: lane.result,
      targetPins: lane.targetPins,
      judged: lane.judged,
      resultLocked: lane.resultLocked,
      excludedNumbers: lane.excludedNumbers,
      numberHistory: lane.numberHistory,
      bowlingHistory: lane.bowlingHistory
    }))
  };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  } catch (error) {
    console.error("保存に失敗しました。", error);
  }
}


/* =========================
   データ読み込み
========================= */

function loadData() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    alert("保存されたデータがありません。");
    return;
  }

  const confirmed = confirm(
    "保存されている設定と履歴を読み込みますか？\n現在のデータは上書きされます。"
  );

  if (!confirmed) return;

  try {
    const data = JSON.parse(savedData);

    if (
      !Number.isInteger(data.minNumber) ||
      !Number.isInteger(data.maxNumber) ||
      data.minNumber < 0 ||
      data.maxNumber > 100 ||
      data.minNumber >= data.maxNumber ||
      !Array.isArray(data.lanes) ||
      data.lanes.length !== 2
    ) {
      throw new Error("保存データの形式が正しくありません。");
    }

    if (lanes.some(lane => lane.isSpinning)) {
      alert("抽選中は読み込みできません。");
      return;
    }

    minNumber = data.minNumber;
    maxNumber = data.maxNumber;
    excludeWinner = Boolean(data.excludeWinner);
    soundEnabled = data.soundEnabled !== false;

    currentMode =
      data.currentMode === "bowling"
        ? "bowling"
        : "number";

    data.lanes.forEach((savedLane, index) => {
      const lane = lanes[index];

      lane.rotation =
        Number.isFinite(savedLane.rotation)
          ? savedLane.rotation
          : 0;

      lane.result = savedLane.result ?? null;
      lane.targetPins = savedLane.targetPins ?? null;
      lane.judged = Boolean(savedLane.judged);
      lane.resultLocked = Boolean(savedLane.resultLocked);

      lane.excludedNumbers =
        Array.isArray(savedLane.excludedNumbers)
          ? savedLane.excludedNumbers
          : [];

      lane.numberHistory =
        Array.isArray(savedLane.numberHistory)
          ? savedLane.numberHistory
          : [];

      lane.bowlingHistory =
        Array.isArray(savedLane.bowlingHistory)
          ? savedLane.bowlingHistory
          : [];

      lane.isSpinning = false;
      lane.winningEntry = null;
      lane.entriesAtSpin = [];
    });

    document.getElementById("minNumber").value = minNumber;
    document.getElementById("maxNumber").value = maxNumber;

    document.getElementById("excludeWinner").checked =
      excludeWinner;

    document.getElementById("soundEnabled").checked =
      soundEnabled;

    updateModeDisplay();

    lanes.forEach((lane, index) => {
      drawRoulette(index);
      updateLaneDisplay(index);
    });

    alert("データを読み込みました！");
  } catch (error) {
    console.error(error);
    alert("保存データを読み込めませんでした。");
  }
}


/* =========================
   ボタンのイベント設定
========================= */

// モード切り替え
document.getElementById("numberMode").addEventListener(
  "click",
  () => switchMode("number")
);

document.getElementById("bowlingMode").addEventListener(
  "click",
  () => switchMode("bowling")
);

// レーンごとの抽選
document.getElementById("spinButton1").addEventListener(
  "click",
  () => startSpin(0)
);

document.getElementById("spinButton2").addEventListener(
  "click",
  () => startSpin(1)
);

// ピン数判定
document.querySelectorAll(".pin-button").forEach(button => {
  button.addEventListener("click", () => {
    const laneIndex =
      Number(button.dataset.lane) - 1;

    const pins = Number(button.dataset.pins);

    judgeBowling(laneIndex, pins);
  });
});

// 次のお客さん
document.getElementById("nextBowlingButton1").addEventListener(
  "click",
  () => nextCustomer(0)
);

document.getElementById("nextBowlingButton2").addEventListener(
  "click",
  () => nextCustomer(1)
);

// 履歴削除
document.getElementById("clearHistoryButton1").addEventListener(
  "click",
  () => clearHistory(0)
);

document.getElementById("clearHistoryButton2").addEventListener(
  "click",
  () => clearHistory(1)
);

// 数字設定
document.getElementById("applyNumberButton").addEventListener(
  "click",
  applyNumberSettings
);

// 抽選オプション
document.getElementById("excludeWinner").addEventListener(
  "change",
  event => {
    excludeWinner = event.target.checked;

    lanes.forEach((lane, index) => {
      lane.excludedNumbers = [];
      drawRoulette(index);
    });

    saveData();
  }
);

document.getElementById("soundEnabled").addEventListener(
  "change",
  event => {
    soundEnabled = event.target.checked;
    saveData();
  }
);

// 保存・読み込み
document.getElementById("saveButton").addEventListener(
  "click",
  () => {
    saveData();
    alert("設定と履歴を保存しました！");
  }
);

document.getElementById("loadButton").addEventListener(
  "click",
  loadData
);


/* =========================
   初期起動
========================= */

function initialize() {
  document.getElementById("minNumber").value = minNumber;
  document.getElementById("maxNumber").value = maxNumber;

  document.getElementById("excludeWinner").checked =
    excludeWinner;

  document.getElementById("soundEnabled").checked =
    soundEnabled;

  updateModeDisplay();

  lanes.forEach((lane, index) => {
    drawRoulette(index);
    updateLaneDisplay(index);
  });
}

initialize();
