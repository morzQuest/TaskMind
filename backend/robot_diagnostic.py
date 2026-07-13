#!/usr/bin/env python3
"""
Robot Diagnostic Script
Helps identify why robot code isn't running
"""

import socket
import time
import pandas as pd
from urp_trigger import send_dashboard_command, ROBOT_IP, DASHBOARD_PORT

def test_robot_connection():
    """Test basic connection to robot"""
    print("🔍 Testing robot connection...")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5)
            s.connect((ROBOT_IP, DASHBOARD_PORT))
            print(f"✅ Connected to robot at {ROBOT_IP}:{DASHBOARD_PORT}")
            return True
    except Exception as e:
        print(f"❌ Failed to connect to robot: {e}")
        print(f"   Check if robot IP is correct: {ROBOT_IP}")
        return False

def test_dashboard_commands():
    """Test basic dashboard commands"""
    print("\n🔍 Testing dashboard commands...")
    
    commands = [
        "programState",
        "stop",
        "play"
    ]
    
    for cmd in commands:
        try:
            response = send_dashboard_command(cmd)
            print(f"✅ '{cmd}' -> {response}")
        except Exception as e:
            print(f"❌ '{cmd}' failed: {e}")

def check_urp_files():
    """Check if URP files exist on robot"""
    print("\n🔍 Checking URP files on robot...")
    
    # Load tasks to get URP names
    try:
        df = pd.read_excel("tasks.xlsx")
        urp_names = df[df['RobotCode'] != 'cannot']['RobotCode'].tolist()
        
        for urp_name in urp_names:
            # Test both yellow and orange modes
            for mode, folder in [("Yellow", "Mursal"), ("Orange", "Mursal/Orange")]:
                program_name = f"orange_{urp_name}" if mode == "Orange" else urp_name
                file_path = f"{folder}/{program_name}.urp"
                
                try:
                    response = send_dashboard_command(f"load {file_path}")
                    if response and "File not found" not in response and "error" not in response.lower():
                        print(f"✅ {mode}: {file_path} exists")
                    else:
                        print(f"❌ {mode}: {file_path} NOT FOUND")
                except Exception as e:
                    print(f"❌ {mode}: {file_path} - Error: {e}")
                    
    except Exception as e:
        print(f"❌ Error loading tasks.xlsx: {e}")

def test_task_execution():
    """Test a simple task execution"""
    print("\n🔍 Testing task execution...")
    
    try:
        df = pd.read_excel("tasks.xlsx")
        # Find first robot task
        robot_tasks = df[df['RobotCode'] != 'cannot']
        if not robot_tasks.empty:
            test_task = robot_tasks.iloc[0]['RobotCode']
            print(f"Testing task: {test_task}")
            
            # Test the full execution flow
            from urp_trigger import trigger_urp_program
            
            success = trigger_urp_program(test_task, orange_mode=False)
            if success:
                print(f"✅ Task '{test_task}' started successfully")
                
                # Wait a bit and check state
                time.sleep(2)
                state = send_dashboard_command("programState")
                print(f"   Current state: {state}")
                
                # Stop the program
                send_dashboard_command("stop")
                print("   Program stopped")
            else:
                print(f"❌ Task '{test_task}' failed to start")
        else:
            print("❌ No robot tasks found in tasks.xlsx")
            
    except Exception as e:
        print(f"❌ Error testing task execution: {e}")

def main():
    print("🤖 Robot Diagnostic Tool")
    print("=" * 50)
    
    # Test 1: Connection
    if not test_robot_connection():
        print("\n❌ Cannot proceed - robot connection failed")
        return
    
    # Test 2: Dashboard commands
    test_dashboard_commands()
    
    # Test 3: URP files
    check_urp_files()
    
    # Test 4: Task execution
    test_task_execution()
    
    print("\n" + "=" * 50)
    print("🔍 Diagnostic complete!")

if __name__ == "__main__":
    main() 