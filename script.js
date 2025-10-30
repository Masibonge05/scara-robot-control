// ===== CHANGE THIS TO YOUR ESP32'S IP ADDRESS =====
const ESP32_IP = '172.20.10.4';  // YOUR IP HERE
// ==================================================

const API_URL = `http://${ESP32_IP}/api`;
let currentStep = 5;  // Default 5° steps

// Faster API calls with reduced timeout
function apiCall(endpoint, method = 'GET', data = null) {
    const options = { 
        method: method,
        timeout: 1000  // 1 second timeout
    };
    if (data) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(data);
    }
    
    return fetch(API_URL + endpoint, options)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
            } else {
                showAlert(data.message, 'error');
            }
            // Update display with current values
            updateDisplay(data);
            return data;
        })
        .catch(e => {
            showAlert('Connection error', 'error');
            console.error('API Error:', e);
        });
}

function showAlert(msg, type) {
    const alert = document.getElementById('alertBox');
    alert.textContent = msg;
    alert.className = 'alert alert-' + type + ' show';
    setTimeout(() => alert.classList.remove('show'), 2000);
}

function updateDisplay(data) {
    // Base is in degrees
    if (data.base !== undefined) {
        document.getElementById('xPos').textContent = data.base + '°';
    }
    // Y and Z axes show raw values (representing height/position)
    if (data.yaxis !== undefined) {
        document.getElementById('yPos').textContent = data.yaxis;
    }
    if (data.zaxis !== undefined) {
        document.getElementById('zPos').textContent = data.zaxis;
    }
}

function updateStatus() {
    fetch(API_URL + '/status')
        .then(r => r.json())
        .then(data => {
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            if (data.powered) {
                dot.classList.remove('offline');
                text.textContent = 'System Online';
            } else {
                dot.classList.add('offline');
                text.textContent = 'System Offline';
            }
            updateDisplay(data);
        })
        .catch(() => {
            document.getElementById('statusText').textContent = 'Disconnected';
            document.getElementById('statusDot').classList.add('offline');
        });
}

function setStepSize(size) {
    currentStep = size;
    apiCall('/settings', 'POST', {step_size: size});
    document.querySelectorAll('.step-size button').forEach(b => b.classList.remove('active'));
    document.getElementById('step' + size).classList.add('active');
}

// CORRECTED JOG CONTROLS
// Left/Right = Base rotation in DEGREES (X-axis) - Pin 27
// Up/Down = Y-axis gripper arm HEIGHT (up/down) - Pin 14
// Z-Up/Z-Down = Body HEIGHT (up/down) - Pin 26
function jog(direction) {
    apiCall('/jog', 'POST', {direction: direction});
}

function moveToPosition() {
    const base = parseInt(document.getElementById('targetX').value) || 90;
    const yaxis = parseInt(document.getElementById('targetY').value) || 90;
    const zaxis = parseInt(document.getElementById('targetZ').value) || 90;
    apiCall('/move', 'POST', {base: base, yaxis: yaxis, zaxis: zaxis});
}

function goToPosition(base, yaxis, zaxis) {
    document.getElementById('targetX').value = base;
    document.getElementById('targetY').value = yaxis;
    document.getElementById('targetZ').value = zaxis;
    apiCall('/move', 'POST', {base: base, yaxis: yaxis, zaxis: zaxis});
}

// Gripper - Pin 13
function gripperOpen() {
    apiCall('/gripper', 'POST', {action: 'open'});
}

function gripperClose() {
    apiCall('/gripper', 'POST', {action: 'close'});
}

function updateGripperForce(value) {
    document.getElementById('forceValue').textContent = value + '%';
    apiCall('/settings', 'POST', {gripper_force: parseInt(value)});
}

function updateSpeed(value) {
    document.getElementById('speedValue').textContent = value + '%';
    apiCall('/settings', 'POST', {speed: parseInt(value)});
}

function powerOn() {
    apiCall('/power', 'POST', {state: 'on'});
}

function powerOff() {
    apiCall('/power', 'POST', {state: 'off'});
}

function homePosition() {
    apiCall('/home', 'POST');
}

function emergencyStop() {
    if (confirm('ACTIVATE EMERGENCY STOP?')) {
        apiCall('/emergency_stop', 'POST');
    }
}

function pickAndPlace() {
    apiCall('/pick_and_place', 'POST');
}

function calibrate() {
    apiCall('/calibrate', 'POST');
}

function testSequence() {
    apiCall('/test_sequence', 'POST');
}

function resetPosition() {
    homePosition();
}

function saveCurrentPosition() {
    const base = document.getElementById('xPos').textContent;
    const yaxis = document.getElementById('yPos').textContent;
    const zaxis = document.getElementById('zPos').textContent;
    showAlert(`Position saved: Base=${base}, Y=${yaxis}, Z=${zaxis}`, 'success');
}

// Faster status updates - every 1 second
setInterval(updateStatus, 1000);
updateStatus();
