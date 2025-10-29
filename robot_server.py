from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import serial
import time
import json
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'scara_robot_secret_key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ESP32 Serial Configuration
# Update COM port based on your system (e.g., 'COM3' on Windows, '/dev/ttyUSB0' on Linux)
ESP32_PORT = 'COM3'  # Change this to your ESP32 port
ESP32_BAUDRATE = 115200

class RobotController:
    def __init__(self):
        self.serial_connection = None
        self.is_connected = False
        self.current_position = {'x': 0, 'y': 0, 'z': 0}
        self.step_size = 1
        self.speed = 50
        self.gripper_force = 50
        self.is_powered = False
        
    def connect(self, port=ESP32_PORT, baudrate=ESP32_BAUDRATE):
        """Connect to ESP32 via serial"""
        try:
            self.serial_connection = serial.Serial(port, baudrate, timeout=1)
            time.sleep(2)  # Wait for connection to establish
            self.is_connected = True
            print(f"Connected to ESP32 on {port}")
            return True
        except Exception as e:
            print(f"Failed to connect to ESP32: {e}")
            self.is_connected = False
            return False
    
    def disconnect(self):
        """Disconnect from ESP32"""
        if self.serial_connection and self.serial_connection.is_open:
            self.serial_connection.close()
            self.is_connected = False
            print("Disconnected from ESP32")
    
    def send_command(self, command):
        """Send command to ESP32"""
        if not self.is_connected or not self.serial_connection:
            return {'success': False, 'message': 'Not connected to ESP32'}
        
        try:
            # Send command as JSON
            command_json = json.dumps(command) + '\n'
            self.serial_connection.write(command_json.encode())
            
            # Wait for response
            time.sleep(0.1)
            if self.serial_connection.in_waiting:
                response = self.serial_connection.readline().decode().strip()
                return {'success': True, 'response': response}
            
            return {'success': True, 'message': 'Command sent'}
        except Exception as e:
            return {'success': False, 'message': f'Error: {str(e)}'}
    
    def move_to_position(self, x, y, z):
        """Move robot to specific position"""
        command = {
            'action': 'move_to',
            'x': x,
            'y': y,
            'z': z,
            'speed': self.speed
        }
        result = self.send_command(command)
        if result['success']:
            self.current_position = {'x': x, 'y': y, 'z': z}
        return result
    
    def jog(self, direction):
        """Jog robot in specific direction"""
        movements = {
            'up': (0, self.step_size, 0),
            'down': (0, -self.step_size, 0),
            'left': (-self.step_size, 0, 0),
            'right': (self.step_size, 0, 0),
            'z_up': (0, 0, self.step_size),
            'z_down': (0, 0, -self.step_size)
        }
        
        if direction in movements:
            dx, dy, dz = movements[direction]
            new_x = self.current_position['x'] + dx
            new_y = self.current_position['y'] + dy
            new_z = self.current_position['z'] + dz
            
            return self.move_to_position(new_x, new_y, new_z)
        
        return {'success': False, 'message': 'Invalid direction'}
    
    def control_gripper(self, action):
        """Control gripper (open/close)"""
        command = {
            'action': 'gripper',
            'state': action,  # 'open' or 'close'
            'force': self.gripper_force
        }
        return self.send_command(command)
    
    def home_position(self):
        """Move robot to home position"""
        command = {'action': 'home'}
        result = self.send_command(command)
        if result['success']:
            self.current_position = {'x': 0, 'y': 0, 'z': 0}
        return result
    
    def emergency_stop(self):
        """Emergency stop all movements"""
        command = {'action': 'emergency_stop'}
        return self.send_command(command)
    
    def power_control(self, state):
        """Power on/off the robot"""
        command = {'action': 'power', 'state': state}
        result = self.send_command(command)
        if result['success']:
            self.is_powered = (state == 'on')
        return result
    
    def calibrate(self):
        """Calibrate the robot"""
        command = {'action': 'calibrate'}
        return self.send_command(command)
    
    def pick_and_place(self):
        """Execute pick and place cycle"""
        command = {'action': 'pick_and_place'}
        return self.send_command(command)
    
    def test_sequence(self):
        """Run test sequence"""
        command = {'action': 'test_sequence'}
        return self.send_command(command)

# Initialize robot controller
robot = RobotController()

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/api/connect', methods=['POST'])
def connect():
    """Connect to ESP32"""
    data = request.json
    port = data.get('port', ESP32_PORT)
    success = robot.connect(port)
    return jsonify({
        'success': success,
        'message': 'Connected' if success else 'Connection failed'
    })

@app.route('/api/disconnect', methods=['POST'])
def disconnect():
    """Disconnect from ESP32"""
    robot.disconnect()
    return jsonify({'success': True, 'message': 'Disconnected'})

@app.route('/api/status', methods=['GET'])
def status():
    """Get robot status"""
    return jsonify({
        'connected': robot.is_connected,
        'powered': robot.is_powered,
        'position': robot.current_position,
        'speed': robot.speed,
        'gripper_force': robot.gripper_force
    })

@app.route('/api/move', methods=['POST'])
def move():
    """Move robot to position"""
    data = request.json
    x = float(data.get('x', 0))
    y = float(data.get('y', 0))
    z = float(data.get('z', 0))
    
    result = robot.move_to_position(x, y, z)
    socketio.emit('position_update', robot.current_position)
    return jsonify(result)

@app.route('/api/jog', methods=['POST'])
def jog():
    """Jog robot in direction"""
    data = request.json
    direction = data.get('direction')
    
    result = robot.jog(direction)
    socketio.emit('position_update', robot.current_position)
    return jsonify(result)

@app.route('/api/gripper', methods=['POST'])
def gripper():
    """Control gripper"""
    data = request.json
    action = data.get('action')  # 'open' or 'close'
    
    result = robot.control_gripper(action)
    return jsonify(result)

@app.route('/api/home', methods=['POST'])
def home():
    """Move to home position"""
    result = robot.home_position()
    socketio.emit('position_update', robot.current_position)
    return jsonify(result)

@app.route('/api/emergency_stop', methods=['POST'])
def emergency_stop():
    """Emergency stop"""
    result = robot.emergency_stop()
    return jsonify(result)

@app.route('/api/power', methods=['POST'])
def power():
    """Power control"""
    data = request.json
    state = data.get('state')  # 'on' or 'off'
    
    result = robot.power_control(state)
    socketio.emit('power_status', {'powered': robot.is_powered})
    return jsonify(result)

@app.route('/api/calibrate', methods=['POST'])
def calibrate():
    """Calibrate robot"""
    result = robot.calibrate()
    return jsonify(result)

@app.route('/api/pick_and_place', methods=['POST'])
def pick_and_place():
    """Execute pick and place"""
    result = robot.pick_and_place()
    return jsonify(result)

@app.route('/api/test_sequence', methods=['POST'])
def test_sequence():
    """Run test sequence"""
    result = robot.test_sequence()
    return jsonify(result)

@app.route('/api/settings', methods=['POST'])
def settings():
    """Update robot settings"""
    data = request.json
    
    if 'step_size' in data:
        robot.step_size = float(data['step_size'])
    if 'speed' in data:
        robot.speed = int(data['speed'])
    if 'gripper_force' in data:
        robot.gripper_force = int(data['gripper_force'])
    
    return jsonify({'success': True, 'message': 'Settings updated'})

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    print('Client connected')
    emit('status', {
        'connected': robot.is_connected,
        'position': robot.current_position
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    print('Client disconnected')

if __name__ == '__main__':
    # Try to connect to ESP32 on startup
    print("Starting SCARA Robot Control Server...")
    print(f"Attempting to connect to ESP32 on {ESP32_PORT}...")
    robot.connect()
    
    # Start Flask server
    print("Server starting on http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)