import threading
import time
import pandas as pd
from urp_trigger import send_dashboard_command, trigger_urp_program


class RobotExecutor:
    def __init__(self):
        self.queue = []
        self.lock = threading.Lock()
        self.is_running = False
        self.current_task = None
        self.worker_thread = threading.Thread(target=self.worker_loop)
        self.worker_thread.daemon = True
        self.worker_thread.start()
        self.executed_tasks = []
        self.orange_mode = False
        self.all_tasks_completed = False
        self.robot_message = ""
        self.task_mapping = {}  # Map URP names to task names
        self.current_task_name = None  # Store the actual task name for UI
        self.last_activity_time = time.time()  # Track last activity
        self.stuck_timeout = 60  # 60 seconds to detect stuck robot
        self.started = False  # Flag to control when robot starts processing tasks
        self.task_times = {}  # Cache for Time_Robot values
        self.execution_message = "Robot idle."  # Track execution-specific messages
        self.pause_reset_flag = False  # Flag to reset pause waiting time
        self.dependency_check_interval = 0.5
        self.state_check_interval = 0.2
        self.pause_transition_delay = 0.2


    def reset(self):
        with self.lock:
            self.queue = []
            self.executed_tasks = []
            self.current_task = None
            self.current_task_name = None
            self.is_running = False
            self.task_mapping = {}
            self.task_times = {}
            self.robot_message = ""
            self.execution_message = "Robot idle."
            self.started = False
            self.pause_reset_flag = True  # Set flag to reset pause waiting time
            self.all_tasks_completed = False  # Reset completion flag
            self.orange_mode = False  # Reset orange mode flag
        print("🔄 Robot executor fully reset.")


    def add_task(self, urp_name):
        with self.lock:
            self.queue.append(urp_name)
            self.all_tasks_completed = False
            print(f"🧾 Added task to queue: {urp_name}")
            print(f"🧾 Current Queue: {self.queue}")
            print(f"🧾 Queue length: {len(self.queue)}")
            print(f"🧾 Orange mode: {self.orange_mode}")
            print(f"🧾 Started flag: {self.started}")

    def start_processing(self):
        """Start processing tasks (called when Start button is pressed)"""
        with self.lock:
            self.started = True
            self.robot_message = "Robot processing started - checking dependencies..."
            self.execution_message = "🚀 Robot processing started..."
            print("🚀 Robot processing started!")

    def pause_processing(self):
        """Pause processing tasks"""
        with self.lock:
            self.started = False
            print("⏸️ Robot processing paused!")

    def resume_processing(self):
        """Resume processing tasks"""
        with self.lock:
            self.started = True
            print("▶️ Robot processing resumed!")

    def load_task_mapping(self):
        """Load mapping between URP names and task names from Excel"""
        try:
            df = pd.read_excel("tasks.xlsx")
            for _, row in df.iterrows():
                robot_code = str(row["RobotCode"]).strip()
                task_name = str(row["TaskName"]).strip()
                time_robot = int(row["Time_Robot"]) if pd.notna(row["Time_Robot"]) else 30
                
                if robot_code.lower() != "cannot":
                    self.task_mapping[robot_code.lower()] = task_name
                    self.task_times[robot_code.lower()] = time_robot
                    self.task_times[task_name.lower()] = time_robot  # Also map by task name
                    
            print(f"📋 Loaded task mapping: {self.task_mapping}")
            print(f"⏱️ Loaded task times: {self.task_times}")
        except Exception as e:
            print(f"❌ Error loading task mapping: {e}")

    def get_current_task_name(self):
        """Get the human-readable task name for the current URP task"""
        if self.current_task and self.task_mapping:
            return self.task_mapping.get(self.current_task.lower(), self.current_task)
        return self.current_task

    def get_task_time(self, urp_name):
        """Get the Time_Robot value for a specific task from Excel, with 10 second buffer"""
        try:
            # First try to get by URP name
            time_robot = self.task_times.get(urp_name.lower(), 30)
            
            # If not found by URP name, try by task name
            if time_robot == 30:
                task_name = self.get_current_task_name()
                if task_name and task_name != urp_name:
                    time_robot = self.task_times.get(task_name.lower(), 30)
            
            # Add 10 second buffer
            max_wait_time = time_robot + 10
            print(f"⏱️ Task '{urp_name}' Time_Robot: {time_robot}s, Max wait time: {max_wait_time}s")
            return max_wait_time
            
        except Exception as e:
            print(f"❌ Error getting task time for '{urp_name}': {e}")
            return 40  # Default 30 + 10 buffer

    def worker_loop(self):
        print("✅ Robot executor worker loop running")
        while True:
            if self.started and not self.is_running and self.queue:
                print(f"🔍 Debug: Worker loop - started: {self.started}, is_running: {self.is_running}, queue length: {len(self.queue)}")
                with self.lock:
                    urp_name = self.queue.pop(0)
                    self.current_task = urp_name
                    self.current_task_name = self.get_current_task_name()
                    self.last_activity_time = time.time()
                    self.pause_reset_flag = False  # Clear reset flag for new task

                print(f"[EXECUTOR] Starting task: {urp_name} (Task: {self.current_task_name})")
                print(f"[QUEUE] Tasks remaining: {self.queue}")

                # Step 1: Set running state
                self.is_running = True
                
                # Step 2: Check dependencies before starting
                self.check_and_wait_for_dependencies(urp_name)

                # Step 3: Set message for task execution
                task_name = self.get_current_task_name()
                self.robot_message = f"I am executing task: {task_name}"
                self.execution_message = f"🤖 Executing: {task_name}"
                print(f"🔍 Debug: Robot message set to: '{self.robot_message}'")

                # Step 4: Execute the task
                print(f"🔍 Debug: About to execute task '{urp_name}'")
                execution_success = self.execute_task(urp_name)
                print(f"🔍 Debug: execute_task returned {execution_success} for '{urp_name}'")
                print(f"🔍 Debug: execution_success type: {type(execution_success)}")

                # Step 5: Mark task as completed only if execution was successful
                if execution_success:
                    print(f"🔍 Debug: Task '{urp_name}' succeeded, marking as completed")
                    task_name = self.get_current_task_name()
                    self.robot_message = f"Task {task_name} completed successfully"
                    self.execution_message = f"✅ Completed: {task_name}"
                    print(f"🔍 Debug: Robot message set to: '{self.robot_message}'")
                    print(f"🔍 Debug: About to call mark_task_completed for '{urp_name}'")
                    self.mark_task_completed(urp_name)
                    print(f"🔍 Debug: mark_task_completed completed for '{urp_name}'")
                else:
                    print(f"❌ Task '{urp_name}' failed - not marking as completed")
                    task_name = self.get_current_task_name()
                    self.robot_message = f"Error: Task {task_name} failed to execute"
                    self.execution_message = f"❌ Failed: {task_name}"
                    print(f"🔍 Debug: Robot message set to: '{self.robot_message}'")
                    # Put the task back in the queue to retry later
                    with self.lock:
                        self.queue.append(urp_name)

                # Step 4: Clear current task
                self.current_task = None
                self.current_task_name = None
                self.is_running = False
                self.last_activity_time = time.time()

                # Check if all tasks are done
                if not self.queue:
                    self.all_tasks_completed = True
                    self.robot_message = "All robot tasks completed!"
                    self.execution_message = "🎉 All robot tasks finished!"
                    print("🎉 All robot tasks completed!")

            # Check for stuck robot
            elif self.current_task and time.time() - self.last_activity_time > self.stuck_timeout:
                print(f"⚠️ Robot appears stuck on task: {self.current_task}")
                self.robot_message = f"Robot appears stuck on {self.current_task_name or self.current_task}"
                
                # Try to recover by stopping the robot
                try:
                    send_dashboard_command("stop")
                    print("🛑 Attempting to stop stuck robot...")
                except Exception as e:
                    print(f"❌ Could not stop stuck robot: {e}")
                
                # Reset current task and continue
                self.current_task = None
                self.current_task_name = None
                self.is_running = False
                self.last_activity_time = time.time()

            time.sleep(0.05)

    def check_and_wait_for_dependencies(self, urp_name):
        """Check dependencies and wait if not met"""
        print(f"🔍 Checking dependencies for: {urp_name}")
        
        # Load task mapping if not already loaded
        if not self.task_mapping:
            self.load_task_mapping()

        # Get the task name for dependency checking
        task_name = self.task_mapping.get(urp_name.lower(), urp_name)
        
        while True:
            try:
                import requests
                response = requests.get("http://127.0.0.1:8000/check-robot-dependency")
                if response.status_code == 200:
                    data = response.json()
                    if data["allowed"]:
                        print(f"✅ Dependencies met for {task_name}")
                        self.robot_message = ""
                        print(f"🔍 Debug: Robot message cleared")
                        break
                    else:
                        # Dependencies not met - show message and wait
                        self.robot_message = data.get('message', 'Waiting for dependencies')
                        print(f"⏳ Waiting for dependencies: {self.robot_message}")
                        print(f"🔍 Debug: Robot message set to: '{self.robot_message}'")
                        time.sleep(self.dependency_check_interval)
                else:
                    print(f"❌ Error checking dependencies: {response.status_code}")
                    time.sleep(self.dependency_check_interval)
            except Exception as e:
                print(f"❌ Error checking dependencies: {e}")
                time.sleep(self.dependency_check_interval)

    def execute_task(self, urp_name):
        """Execute a URP program and monitor its completion"""
        print(f"🚀 Executing URP program: {urp_name}")
        
        # Load task mapping if not already loaded
        if not self.task_mapping:
            self.load_task_mapping()
        
        # Get the task name for better logging
        task_name = self.get_current_task_name()
        print(f"📋 Task name: {task_name}")
        
        # Trigger the URP program
        success = trigger_urp_program(urp_name, self.orange_mode)
        if not success:
            print(f"❌ Failed to trigger URP program: {urp_name}")
            return False
        
        # Check initial state after starting
        try:
            initial_state = send_dashboard_command("programState")
            if initial_state and ("PLAYING" in initial_state.upper() or "RUNNING" in initial_state.upper()):
                print(f"✅ Task '{urp_name}' started successfully")
            else:
                print(f"⚠️ Task '{urp_name}' may not have started properly: '{initial_state}'")
        except Exception as e:
            print(f"⚠️ Error checking initial state: {e}")
        
        # Monitor the task execution until completion
        print(f"⏳ Monitoring task '{urp_name}' execution...")
        execution_start_time = time.time()
        pause_start_time = None  # Track when pause started
        max_wait_time = self.get_task_time(urp_name)  # Get dynamic wait time from Excel
        check_interval = self.state_check_interval
        was_paused = False  # Track if task was paused during execution
        
        while time.time() - execution_start_time < max_wait_time:
            try:
                # Check if pause reset flag is set (page refresh)
                if self.pause_reset_flag:
                    print(f"🔄 Pause waiting time reset due to page refresh for task '{urp_name}'")
                    self.pause_reset_flag = False  # Reset the flag
                    return False  # Exit the task execution
                
                # Check if robot processing has been paused
                if not self.started:
                    if not was_paused:
                        # First time pausing - record pause start time
                        pause_start_time = time.time()
                        print(f"⏸️ Task '{urp_name}' execution paused")
                        was_paused = True  # Mark that this task was paused
                    
                    # Wait until processing is resumed, but extend max_wait_time every 5 seconds
                    pause_check_interval = 5  # Check every 5 seconds
                    last_pause_check = time.time()
                    
                    while not self.started:
                        time.sleep(self.state_check_interval)

                        # Check if pause reset flag is set (page refresh)
                        if self.pause_reset_flag:
                            print(f"🔄 Pause waiting time reset due to page refresh for task '{urp_name}'")
                            self.pause_reset_flag = False  # Reset the flag
                            return False  # Exit the task execution
                        
                        # Every 5 seconds, extend the max_wait_time
                        if time.time() - last_pause_check >= pause_check_interval:
                            max_wait_time += pause_check_interval
                            print(f"⏸️ Task '{urp_name}' still paused, extended max_wait_time by {pause_check_interval}s (now {max_wait_time:.1f}s total)")
                            last_pause_check = time.time()
                    
                    # Adjust execution start time to account for pause duration
                    if pause_start_time:
                        pause_duration = time.time() - pause_start_time
                        execution_start_time += pause_duration
                        print(f"▶️ Task '{urp_name}' execution resumed (paused for {pause_duration:.1f}s)")
                        pause_start_time = None
                        
                        # Give the robot a moment to transition from paused to running state
                        print(f"⏳ Waiting for robot to transition to running state...")
                        time.sleep(self.pause_transition_delay)
                    else:
                        print(f"▶️ Task '{urp_name}' execution resumed")
                
                state = send_dashboard_command("programState")
                print(f"🔍 Debug: Robot state: '{state}' for task '{urp_name}'")
                
                # If robot is in STOPPED or IDLE state, task is finished
                if state and ("STOPPED" in state.upper() or "IDLE" in state.upper()):
                    print(f"✅ Task '{urp_name}' finished (STOPPED/IDLE state)")
                    return True
                
                # If robot is still playing/running, continue monitoring
                elif state and ("PLAYING" in state.upper() or "RUNNING" in state.upper()):
                    print(f"⏳ Task '{urp_name}' still executing...")
                    time.sleep(check_interval)
                    continue
                
                # If robot is in unknown state, consider it finished
                else:
                    print(f"✅ Task '{urp_name}' finished (unknown state: '{state}')")
                    return True
                    
            except Exception as e:
                print(f"⚠️ Error checking robot state: {e}")
                time.sleep(check_interval)
                continue
        
        # If we reach here, max wait time exceeded - consider task finished
        print(f"✅ Task '{urp_name}' finished (max wait time exceeded)")
        return True

    def mark_task_completed(self, urp_name):
        """Mark task as completed and update all tracking systems"""
        print(f"✅ Marking task '{urp_name}' as completed")
        print(f"🔍 Debug: Called mark_task_completed for '{urp_name}'")
        
        # Load task mapping if not already loaded
        if not self.task_mapping:
            self.load_task_mapping()

        # Get the task name for tracking
        task_name = self.task_mapping.get(urp_name.lower(), urp_name)
        print(f"🔍 Debug: Task mapping - URP: '{urp_name}' -> Task: '{task_name}'")
        print(f"🔍 Debug: Available task mappings: {self.task_mapping}")
        
        # Add both URP name and task name to executed tasks
        self.executed_tasks.append(urp_name.strip().lower())
        if task_name != urp_name:
            self.executed_tasks.append(task_name.strip().lower())
        
        print(f"📝 Updated executed_tasks list: {self.executed_tasks}")
        print(f"🔍 Debug: Added to executed_tasks - URP: '{urp_name.strip().lower()}', Task: '{task_name.strip().lower()}'")

        # Complete robot task in dependency manager
        try:
            import requests
            print(f"🔍 Debug: Making HTTP request to complete robot task: '{task_name}'")
            response = requests.post(f"http://127.0.0.1:8000/complete-robot-task?task_name={task_name}")
            print(f"🔍 Debug: HTTP response status: {response.status_code}")
            print(f"🔍 Debug: HTTP response content: {response.text}")
            if response.status_code == 200:
                print(f"✅ Completed robot task '{task_name}' in dependency manager")
            else:
                print(f"❌ Failed to complete robot task '{task_name}': {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error completing robot task: {e}")
            print(f"🔍 Debug: Exception details: {type(e).__name__}: {str(e)}")

        # Clear robot message when task is completed
        self.robot_message = ""

        # Log robot task completion
        try:
            from main import log_event, LogEvent
            log_event(LogEvent(
                participantId="Robot",
                event="Robot Task Completed",
                details={"task_name": task_name, "urp_name": urp_name}
            ))
        except Exception as e:
            print(f"❌ Error logging task completion: {e}")

    def get_current_task(self):
        return self.current_task

    def get_state(self):
        """Get current robot state for frontend"""
        return {
            "state": "RUNNING" if self.is_running else "IDLE",
            "current_task": self.current_task,
            "current_task_name": self.current_task_name,
            "queue_length": len(self.queue),
            "executed_count": len(self.executed_tasks),
            "started": self.started,
            "orange_mode": self.orange_mode,
            "all_tasks_completed": self.all_tasks_completed,
            "queue": self.queue
        }



robot_executor = RobotExecutor()
