// ===== CHANGE THIS TO YOUR ESP32'S IP ADDRESS =====
const ESP32_IP = "192.168.43.100"; // YOUR IP HERE
// ==================================================

const API_URL = `http://${ESP32_IP}/api`;
let currentStep = 5; // Default 5° steps

// Proper timeout handling with AbortController
function apiCall(endpoint, method = "GET", data = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

  const options = {
    method: method,
    signal: controller.signal,
  };

  if (data) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(data);
  }

  return fetch(API_URL + endpoint, options)
    .then((r) => {
      clearTimeout(timeoutId);
      return r.json();
    })
    .then((data) => {
      if (data.success !== undefined) {
        if (data.success) {
          showAlert(data.message, "success");
        } else {
          showAlert(data.message, "error");
        }
      }
      updateDisplay(data);
      return data;
    })
    .catch((e) => {
      clearTimeout(timeoutId);
      if (e.name === "AbortError") {
        showAlert("Request timeout - check ESP32 connection", "error");
      } else {
        showAlert("Connection error", "error");
      }
      console.error("API Error:", e);
    });
}

function showAlert(msg, type) {
  const alert = document.getElementById("alertBox");
  alert.textContent = msg;
  alert.className = "alert alert-" + type + " show";
  setTimeout(() => alert.classList.remove("show"), 2000);
}

function updateDisplay(data) {
  if (data.base !== undefined) {
    document.getElementById("xPos").textContent = data.base + "°";
  }
  if (data.yaxis !== undefined) {
    document.getElementById("yPos").textContent = data.yaxis;
  }
  if (data.zaxis !== undefined) {
    document.getElementById("zPos").textContent = data.zaxis;
  }
}

function updateStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  fetch(API_URL + "/status", { signal: controller.signal })
    .then((r) => {
      clearTimeout(timeoutId);
      return r.json();
    })
    .then((data) => {
      const dot = document.getElementById("statusDot");
      const text = document.getElementById("statusText");

      if (data.connected && data.powered) {
        dot.className = "status-dot online";
        text.textContent = "System Online";
      } else if (data.connected) {
        dot.className = "status-dot standby";
        text.textContent = "System Standby (Power Off)";
      } else {
        dot.className = "status-dot offline";
        text.textContent = "System Offline";
      }

      updateDisplay(data);
    })
    .catch((e) => {
      clearTimeout(timeoutId);
      document.getElementById("statusText").textContent = "Disconnected";
      document.getElementById("statusDot").className = "status-dot offline";
      console.error("Status update failed:", e);
    });
}

function setStepSize(size) {
  currentStep = size;
  apiCall("/settings", "POST", { step_size: size });
  document
    .querySelectorAll(".step-size button")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("step" + size).classList.add("active");
}

function jog(direction) {
  apiCall("/jog", "POST", { direction: direction });
}

function moveToPosition() {
  const base = parseInt(document.getElementById("targetX").value) || 90;
  const yaxis = parseInt(document.getElementById("targetY").value) || 90;
  const zaxis = parseInt(document.getElementById("targetZ").value) || 90;
  apiCall("/move", "POST", { base: base, yaxis: yaxis, zaxis: zaxis });
}

function goToPosition(base, yaxis, zaxis) {
  document.getElementById("targetX").value = base;
  document.getElementById("targetY").value = yaxis;
  document.getElementById("targetZ").value = zaxis;
  apiCall("/move", "POST", { base: base, yaxis: yaxis, zaxis: zaxis });
}

function gripperOpen() {
  apiCall("/gripper", "POST", { action: "open" });
}

function gripperClose() {
  apiCall("/gripper", "POST", { action: "close" });
}

function updateGripperForce(value) {
  document.getElementById("forceValue").textContent = value + "%";
  apiCall("/settings", "POST", { gripper_force: parseInt(value) });
}

function updateSpeed(value) {
  document.getElementById("speedValue").textContent = value + "%";
  apiCall("/settings", "POST", { speed: parseInt(value) });
}

function powerOn() {
  apiCall("/power", "POST", { state: "on" });
}

function powerOff() {
  apiCall("/power", "POST", { state: "off" });
}

function homePosition() {
  apiCall("/home", "POST");
}

function emergencyStop() {
  if (confirm("ACTIVATE EMERGENCY STOP?")) {
    apiCall("/emergency_stop", "POST");
  }
}

function pickAndPlace() {
  showAlert("Starting Pick & Place sequence...", "info");
  apiCall("/pick_and_place", "POST");
}

function calibrate() {
  showAlert("Starting calibration...", "info");
  apiCall("/calibrate", "POST");
}

function testSequence() {
  showAlert("Starting test sequence...", "info");
  apiCall("/test_sequence", "POST");
}

function resetPosition() {
  homePosition();
}

function saveCurrentPosition() {
  const base = document.getElementById("xPos").textContent;
  const yaxis = document.getElementById("yPos").textContent;
  const zaxis = document.getElementById("zPos").textContent;
  showAlert(`Position saved: Base=${base}, Y=${yaxis}, Z=${zaxis}`, "success");
}

// Status updates every 2 seconds
setInterval(updateStatus, 2000);
updateStatus();
