import socket
import time
import math

ROBOT_IP = "192.168.1.10"  # Robot IP address
DASHBOARD_PORT = 29999
CONTROL_PORT = 30002  # Port for sending joint positions

# Set the base folder for URP programs to the robot's internal folder (relative to /programs/)
URP_BASE_FOLDER = "/programs/Mursal"

def send_dashboard_command(command):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((ROBOT_IP, DASHBOARD_PORT))
            time.sleep(0.1)
            s.recv(1024)
            s.sendall((command + "\n").encode())
            time.sleep(0.1)
            response = s.recv(1024).decode().strip()
            print(f"Dashboard response: {response}")
            return response
    except Exception as e:
        print(f"Dashboard command failed: {e}")
        return None

def check_robot_state():
    """
    Check if robot is ready to accept commands
    """
    try:
        print(f"🔍 Checking robot state at {ROBOT_IP}:{DASHBOARD_PORT}")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((ROBOT_IP, DASHBOARD_PORT))
            time.sleep(0.1)
            
            # Send robotmode command
            s.sendall("robotmode\n".encode())
            time.sleep(0.1)
            response = s.recv(1024).decode().strip()
            print(f"🔍 Robot mode: {response}")
            
            # Send programState command
            s.sendall("programState\n".encode())
            time.sleep(0.1)
            response = s.recv(1024).decode().strip()
            print(f"🔍 Program state: {response}")
            
            return True
    except Exception as e:
        print(f"❌ Failed to check robot state: {e}")
        return False

def send_joint_positions_improved(joint_positions):
    """
    Send joint positions to robot with improved approach
    """
    try:
        print(f"🔧 Attempting to connect to robot at {ROBOT_IP}:{CONTROL_PORT}")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5.0)  # 5 second timeout
            s.connect((ROBOT_IP, CONTROL_PORT))
            time.sleep(0.1)
            
            # First, check if robot is ready
            print("🔧 Checking if robot is ready...")
            
            # Format joint positions as a string
            joint_str = " ".join([f"{pos:.2f}" for pos in joint_positions])
            
            # Try different command formats
            commands_to_try = [
                f"movej([{joint_str}], a=1.0, v=0.5)\n",
                f"movej([{joint_str}], a=0.5, v=0.3)\n",
                f"movej([{joint_str}])\n"
            ]

            for i, command in enumerate(commands_to_try):
                print(f"🔧 Trying command {i+1}: {command.strip()}")
                s.sendall(command.encode())
                time.sleep(1.0)  # Wait longer for movement
                
                # Check response
                try:
                    response = s.recv(1024)
                    if response:
                        print(f"🔧 Response to command {i+1}: {len(response)} bytes")
                        # If we get a response, assume it worked
                        return True
                except Exception as e:
                    print(f"🔧 No response to command {i+1}: {e}")
                    continue
            
            print("❌ All movement commands failed")
            return False
            
    except socket.timeout:
        print(f"❌ Connection timeout to robot at {ROBOT_IP}:{CONTROL_PORT}")
        return False
    except ConnectionRefusedError:
        print(f"❌ Connection refused to robot at {ROBOT_IP}:{CONTROL_PORT}. Is the robot powered on and connected?")
        return False
    except Exception as e:
        print(f"❌ Failed to send joint positions: {e}")
        return False

def send_joint_positions_urbasic(joint_positions):
    """
    Send joint positions to robot using URBasic library (based on working code)
    """
    try:
        import threading
        import time
        
        print(f"🔧 Using URBasic to move robot to position: {joint_positions}")
        
        # Use threading with timeout to prevent freezing
        result = {"success": False, "error": None}
        
        def urbasic_operation():
            try:
                import URBasic
                import math
                
                # Convert joint positions to radians (URBasic expects radians)
                joint_positions_rad = [math.radians(pos) for pos in joint_positions]
                
                print(f"🔧 Joint positions in radians: {joint_positions_rad}")
                
                # Create robot model and connection (following working pattern)
                robotModel = URBasic.robotModel.RobotModel()
                robot = URBasic.urScriptExt.UrScriptExt(host=ROBOT_IP, robotModel=robotModel)
                robot.reset_error()
                
                print('🔧 movej with joint specification')
                robot.movej(q=joint_positions_rad, a=0.4, v=0.5)
                
                print("✅ Robot movement command sent via URBasic")
                result["success"] = True
                
                # Close the robot connection
                robot.close()
                
            except Exception as e:
                print(f"❌ URBasic operation failed: {e}")
                result["error"] = str(e)
        
        # Run URBasic operation in a thread with timeout
        thread = threading.Thread(target=urbasic_operation)
        thread.daemon = True
        thread.start()
        
        # Wait for up to 15 seconds
        thread.join(timeout=15)
        
        if thread.is_alive():
            print("❌ URBasic operation timed out - robot may not be ready")
            return False
        
        return result["success"]
        
    except Exception as e:
        print(f"❌ URBasic movement failed: {e}")
        return False

def send_joint_positions_urbasic_simple(joint_positions):
    """
    Send joint positions using simple URBasic approach
    """
    try:
        import threading
        import time
        
        print(f"🔧 Using simple URBasic to move robot to position: {joint_positions}")
        
        # Use threading with timeout to prevent freezing
        result = {"success": False, "error": None}
        
        def urbasic_simple_operation():
            try:
                import URBasic
                import math
                
                # Create robot model and connection
                robotModel = URBasic.robotModel.RobotModel()
                robot = URBasic.urScriptExt.UrScriptExt(host=ROBOT_IP, robotModel=robotModel)
                
                # Reset any errors
                robot.reset_error()
                
                # Convert to radians
                joint_positions_rad = [math.radians(pos) for pos in joint_positions]
                
                # Send movement command
                robot.movej(joint_positions_rad, acc=1.0, vel=0.5)
                
                print("✅ Robot movement command sent via simple URBasic")
                result["success"] = True
                
            except Exception as e:
                print(f"❌ Simple URBasic operation failed: {e}")
                result["error"] = str(e)
        
        # Run URBasic operation in a thread with timeout
        thread = threading.Thread(target=urbasic_simple_operation)
        thread.daemon = True
        thread.start()
        
        # Wait for up to 15 seconds
        thread.join(timeout=15)
        
        if thread.is_alive():
            print("❌ Simple URBasic operation timed out - robot may not be ready")
            return False
        
        return result["success"]
        
    except Exception as e:
        print(f"❌ Simple URBasic movement failed: {e}")
        return False

def activate_gripper():
    """
    Activate the gripper using robotiq_gripper library (based on working code)
    """
    try:
        import threading
        import time
        
        print("🤏 Attempting to activate gripper using robotiq_gripper...")
        
        # Use threading with timeout to prevent freezing
        result = {"success": False, "error": None}

        def gripper_operation():
            try:
                import robotiq_gripper

                print("🤏 Creating gripper...")
                gripper = robotiq_gripper.RobotiqGripper()
                print("🤏 Connecting to gripper...")
                gripper.connect(ROBOT_IP, 63352)
                print("🤏 Activating gripper...")
                gripper.activate()
                
                print("✅ Gripper activated successfully")
                result["success"] = True
                
            except Exception as e:
                print(f"❌ Gripper operation failed: {e}")
                result["error"] = str(e)
        
        # Run gripper operation in a thread with timeout
        thread = threading.Thread(target=gripper_operation)
        thread.daemon = True
        thread.start()
        
        # Wait for up to 10 seconds
        thread.join(timeout=10)
        
        if thread.is_alive():
            print("❌ Gripper operation timed out")
            return False
        
        return result["success"]
        
    except Exception as e:
        print(f"❌ Failed to activate gripper: {e}")
        return False

def get_robot_mode():
    """Query the robot's mode using the dashboard server."""
    try:
        response = send_dashboard_command("robotmode")
        print(f"🔍 Debug: Robot mode response: {response}")
        return response.strip().lower()
    except Exception as e:
        print(f"❌ Error querying robot mode: {e}")
        return None

def trigger_urp_program(urp_name, robot_ip, orange_mode=False):
    """
    Loads and runs a URP program from Zahra/ or Zahra/Orange/ depending on orange_mode.
    If orange_mode is True, it will prefix 'orange_' to the URP name.
    """
    print(f"🔄 Loading URP program: {urp_name}")
    
    # First, ensure robot is stopped
    print("🛑 Stopping robot...")
    send_dashboard_command("stop")
    time.sleep(0.5)  # Wait for stop to take effect
    
    # Check current state
    current_state = send_dashboard_command("programState")
    print(f"📊 Current robot state: {current_state}")
    
    if current_state and "RUNNING" in current_state.upper():
        print("⚠️ Robot is still running, forcing stop...")
        send_dashboard_command("stop")
        time.sleep(1.0)  # Wait longer for forced stop

    # Determine folder and URP name
    folder = URP_BASE_FOLDER
    program_name = urp_name
    file_path = f"{folder}/{program_name}.urp"

    print(f"📁 Loading from: {file_path}")
    
    # Load the program - handle spaces in file names
    load_command = f"load {file_path}"
    print(f"🔍 Debug: Sending load command: '{load_command}'")
    response = send_dashboard_command(load_command)
    
    # Check for various error conditions
    if not response:
        print(f"❌ No response when loading URP program: {file_path}")
        return False
    elif "could not understand" in response.lower():
        print(f"❌ Robot could not understand load command for: {file_path}")
        print(f"   Response: {response}")
        print(f"🔍 Debug: This might be due to spaces in filename or file not existing")
        return False
    elif "file not found" in response.lower() or "error" in response.lower():
        print(f"❌ Failed to load URP program: {file_path}")
        print(f"   Response: {response}")
        return False

    print(f"✅ Program loaded successfully")
    time.sleep(0.4)  # Wait longer for program to load

    # Check what program is actually loaded
    current_program = send_dashboard_command("get loaded program")
    print(f"🔍 Debug: Currently loaded program: {current_program}")

    # Check robot mode and program state before play
    robot_mode = get_robot_mode()
    program_state = send_dashboard_command("programState")
    print(f"🔍 Robot mode before play: {robot_mode}")
    print(f"🔍 Program state before play: {program_state}")

    # Try to recover from common blocking states
    if robot_mode is not None:
        if "protective" in robot_mode or "emergency" in robot_mode:
            print("⚠️ Robot in protective/emergency stop, sending unlock command...")
            send_dashboard_command("unlock protective stop")
            time.sleep(1.0)
        elif "idle" in robot_mode or "power_off" in robot_mode:
            print("⚠️ Robot in idle/power_off, sending power on and brake release...")
            send_dashboard_command("power on")
            time.sleep(1.0)
            send_dashboard_command("brake release")
            time.sleep(1.0)

    # After recovery attempts, re-check mode
    robot_mode = get_robot_mode()
    print(f"🔍 Robot mode after recovery: {robot_mode}")

    if robot_mode is None or "idle" in robot_mode or "protective" in robot_mode or "emergency" in robot_mode:
        print(f"❌ Robot is not ready to execute programs. Current mode: {robot_mode}")
        print("➡️ Please switch the robot to RUNNING/REMOTE CONTROL mode and clear any stops.")
        return False

    # Start the program
    print("▶️ Starting program...")
    response = send_dashboard_command("play")
    if not response or "Failed" in response or "error" in response.lower():
        print("❌ Failed to start URP program")
        print(f"   Response: {response}")
        return False

    print(f"✅ URP program '{program_name}' started from {folder}")
    return True

def test_robot_connection():
    """
    Test if robot is reachable via socket
    """
    try:
        print(f"🔍 Testing connection to robot at {ROBOT_IP}:{CONTROL_PORT}")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)  # 3 second timeout
            s.connect((ROBOT_IP, CONTROL_PORT))
            print(f"✅ Robot connection successful!")
            return True
    except socket.timeout:
        print(f"❌ Connection timeout to robot at {ROBOT_IP}:{CONTROL_PORT}")
        return False
    except ConnectionRefusedError:
        print(f"❌ Connection refused to robot at {ROBOT_IP}:{CONTROL_PORT}. Is the robot powered on and connected?")
        return False
    except Exception as e:
        print(f"❌ Failed to connect to robot: {e}")
        return False

def test_robot_connection_detailed():
    """
    Test both dashboard and control ports with detailed diagnostics
    """
    print(f"🔍 Detailed robot connection test for {ROBOT_IP}")
    
    # Test dashboard port (29999)
    try:
        print(f"  Testing dashboard port {DASHBOARD_PORT}...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((ROBOT_IP, DASHBOARD_PORT))
            print(f"  ✅ Dashboard port {DASHBOARD_PORT} accessible")
            dashboard_ok = True
    except Exception as e:
        print(f"  ❌ Dashboard port {DASHBOARD_PORT} failed: {e}")
        dashboard_ok = False
    
    # Test control port (30002)
    try:
        print(f"  Testing control port {CONTROL_PORT}...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((ROBOT_IP, CONTROL_PORT))
            print(f"  ✅ Control port {CONTROL_PORT} accessible")
            control_ok = True
    except Exception as e:
        print(f"  ❌ Control port {CONTROL_PORT} failed: {e}")
        control_ok = False
    
    if dashboard_ok and control_ok:
        print("✅ Both ports accessible - robot should be ready for commands")
        return True
    elif dashboard_ok and not control_ok:
        print("⚠️ Dashboard accessible but control port blocked. Robot might need to be in the right mode.")
        return False
    elif not dashboard_ok and control_ok:
        print("⚠️ Control port accessible but dashboard blocked. Unusual configuration.")
        return False
    else:
        print("❌ Neither port accessible. Check robot power and network connection.")
        return False

