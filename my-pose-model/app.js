"use strict";

const MODEL_URL = "./model.json";
const METADATA_URL = "./metadata.json";
const CAMERA_SIZE = 480;
const MIN_KEYPOINT_CONFIDENCE = 0.35;
const BONES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [5, 6],
  [5, 7], [7, 9], [6, 8], [8, 10], [5, 11],
  [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]
];

let model;
let webcam;
let maxPredictions = 0;
let skeletonVisible = true;
let soundEnabled = false;
let reneAt100 = false;
let animationFrame = 0;
let lastFpsTime = performance.now();
let framesSinceFpsUpdate = 0;

const statusBadge = document.getElementById("status");
const statusText = document.getElementById("status-text");
const loadingOverlay = document.getElementById("loading");
const loadingMessage = document.getElementById("loading-message");
const fpsLabel = document.getElementById("fps");
const skeletonCanvas = document.getElementById("skeleton-canvas");
const skeletonContext = skeletonCanvas.getContext("2d");
const labelContainer = document.getElementById("label-container");
const reneAudio = document.getElementById("rene-audio");

function setStatus(state, label) {
  statusBadge.className = "connection " + state;
  statusText.textContent = label;
}

function showError(error) {
  console.error("Pose app error:", error);
  cancelAnimationFrame(animationFrame);
  setStatus("error", "ERROR");
  loadingOverlay.classList.remove("hidden");
  loadingOverlay.classList.add("error");
  loadingMessage.textContent = error && error.message
    ? error.message
    : "Could not start pose detection. Check camera access and model files.";
}

function createPredictionRows() {
  for (let index = 0; index < maxPredictions; index += 1) {
    const item = document.createElement("div");
    item.className = "prediction-item";

    const header = document.createElement("div");
    header.className = "prediction-header";

    const label = document.createElement("span");
    label.className = "prediction-label";
    label.textContent = "Class " + (index + 1);

    const percent = document.createElement("span");
    percent.className = "prediction-percent";
    percent.textContent = "0.0%";

    const track = document.createElement("div");
    track.className = "progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    track.appendChild(bar);
    header.append(label, percent);
    item.append(header, track);
    labelContainer.appendChild(item);
  }
  document.getElementById("class-count").textContent = maxPredictions + " classes";
}

async function init() {
  try {
    if (!window.tmPose) {
      throw new Error("Teachable Machine Pose did not load. Check the CDN connection.");
    }

    model = await tmPose.load(MODEL_URL, METADATA_URL);
    maxPredictions = model.getTotalClasses();
    createPredictionRows();

    webcam = new tmPose.Webcam(CAMERA_SIZE, CAMERA_SIZE, true);
    await webcam.setup();
    await webcam.play();
    document.getElementById("webcam-container").appendChild(webcam.canvas);
    syncOverlaySize();

    setStatus("live", "LIVE");
    loadingOverlay.classList.add("hidden");
    animationFrame = requestAnimationFrame(loop);
  } catch (error) {
    showError(error);
  }
}

function syncOverlaySize() {
  // Pose keypoints are expressed in the input image's pixel space. Match the
  // overlay backing resolution to that image; CSS scales both canvases equally.
  if (skeletonCanvas.width !== webcam.canvas.width || skeletonCanvas.height !== webcam.canvas.height) {
    skeletonCanvas.width = webcam.canvas.width;
    skeletonCanvas.height = webcam.canvas.height;
  }
}

async function loop() {
  try {
    // Update the camera first. Draw the pose only after inference, on the
    // separate overlay so the next camera update cannot paint over it.
    webcam.update();
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const predictions = await model.predict(posenetOutput);

    syncOverlaySize();
    skeletonContext.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
    if (skeletonVisible && pose && pose.keypoints) {
      drawPose(pose.keypoints);
    }
    updatePredictions(predictions);
    updateFps();
    animationFrame = requestAnimationFrame(loop);
  } catch (error) {
    showError(error);
  }
}

function drawPose(keypoints) {
  const sourceWidth = webcam.canvas.width;
  const sourceHeight = webcam.canvas.height;
  const scaleX = skeletonCanvas.width / sourceWidth;
  const scaleY = skeletonCanvas.height / sourceHeight;
  const points = keypoints.map((keypoint) => {
    const position = keypoint.position || keypoint;
    return {
      x: position.x * scaleX,
      y: position.y * scaleY,
      score: keypoint.score || 0
    };
  });

  skeletonContext.save();
  skeletonContext.lineCap = "round";
  skeletonContext.lineJoin = "round";
  skeletonContext.lineWidth = Math.max(2, skeletonCanvas.width / 180);
  skeletonContext.strokeStyle = "rgba(255, 255, 255, 0.88)";
  skeletonContext.shadowColor = "rgba(255, 255, 255, 0.25)";
  skeletonContext.shadowBlur = 3;

  BONES.forEach(([startIndex, endIndex]) => {
    const start = points[startIndex];
    const end = points[endIndex];
    if (!start || !end || start.score < MIN_KEYPOINT_CONFIDENCE || end.score < MIN_KEYPOINT_CONFIDENCE) {
      return;
    }
    skeletonContext.beginPath();
    skeletonContext.moveTo(start.x, start.y);
    skeletonContext.lineTo(end.x, end.y);
    skeletonContext.stroke();
  });

  skeletonContext.shadowBlur = 5;
  points.forEach((point) => {
    if (point.score < MIN_KEYPOINT_CONFIDENCE) return;
    const radius = Math.max(3.5, skeletonCanvas.width / 95);
    skeletonContext.beginPath();
    skeletonContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
    skeletonContext.fillStyle = point.score >= 0.65 ? "#ffffff" : "#a6a6a6";
    skeletonContext.fill();
    skeletonContext.lineWidth = 2;
    skeletonContext.strokeStyle = "rgba(0, 0, 0, 0.9)";
    skeletonContext.stroke();
  });
  skeletonContext.restore();
}

function updatePredictions(predictions) {
  const highest = predictions.reduce((best, prediction) =>
    prediction.probability > best.probability ? prediction : best,
  predictions[0]);

  predictions.forEach((prediction, index) => {
    const item = labelContainer.children[index];
    const percent = item.querySelector(".prediction-percent");
    const track = item.querySelector(".progress-track");
    const bar = item.querySelector(".progress-bar");
    const value = Math.max(0, Math.min(100, prediction.probability * 100));

    item.querySelector(".prediction-label").textContent = prediction.className;
    percent.textContent = value.toFixed(1) + "%";
    bar.style.width = value + "%";
    track.setAttribute("aria-valuenow", value.toFixed(1));
    item.classList.toggle("active", prediction.className === highest.className);
  });

  updateReneAlert(predictions);
}

function updateReneAlert(predictions) {
  const renePrediction = predictions.find((prediction) =>
    prediction.className.trim().toLowerCase() === "rene");
  const reached100Percent = Boolean(renePrediction && renePrediction.probability >= 0.9995);

  if (reached100Percent && !reneAt100 && soundEnabled) {
    playReneSound();
  }
  reneAt100 = reached100Percent;
}

async function playReneSound() {
  if (!soundEnabled) return;
  try {
    reneAudio.currentTime = 0;
    await reneAudio.play();
  } catch (error) {
    console.warn("Could not play mama-by-rene.mp3:", error);
  }
}

function updateFps() {
  framesSinceFpsUpdate += 1;
  const now = performance.now();
  const elapsed = now - lastFpsTime;
  if (elapsed >= 1000) {
    fpsLabel.textContent = Math.round(framesSinceFpsUpdate * 1000 / elapsed) + " FPS";
    framesSinceFpsUpdate = 0;
    lastFpsTime = now;
  }
}

document.getElementById("skeleton-toggle").addEventListener("click", (event) => {
  skeletonVisible = !skeletonVisible;
  event.currentTarget.setAttribute("aria-pressed", String(skeletonVisible));
  event.currentTarget.textContent = "Skeleton: " + (skeletonVisible ? "On" : "Off");
  if (!skeletonVisible) {
    skeletonContext.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
  }
});

document.getElementById("sound-toggle").addEventListener("click", async (event) => {
  soundEnabled = !soundEnabled;
  event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
  event.currentTarget.textContent = "Sound: " + (soundEnabled ? "On" : "Off");

  if (!soundEnabled) {
    reneAudio.pause();
    reneAudio.currentTime = 0;
  } else {
    try {
      reneAudio.muted = true;
      await reneAudio.play();
      reneAudio.pause();
      reneAudio.currentTime = 0;
      reneAudio.muted = false;
      if (reneAt100) playReneSound();
    } catch (error) {
      reneAudio.pause();
      reneAudio.currentTime = 0;
      reneAudio.muted = false;
      soundEnabled = false;
      event.currentTarget.setAttribute("aria-pressed", "false");
      event.currentTarget.textContent = "Sound: Off";
      console.warn("Could not enable mama-by-rene.mp3:", error);
    }
  }
});

init();
