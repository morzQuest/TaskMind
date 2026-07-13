import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import TaskSequenceView from "./components/TaskSequenceView";
import GraphicalTaskSequence from "./components/GraphicalTaskSequence";
import HumanInstruction from "./components/HumanInstruction";
import axios from "axios";
import "./App.css";
import TopBar from "./components/TopBar";
import RobotCommunicator from "./components/RobotCommunicator";



function App() {
  const [tasks, setTasks] = useState([]);
  const [currentHumanStep, setCurrentHumanStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [currentRobotTask, setCurrentRobotTask] = useState(null);
  const [executedRobotTasks, setExecutedRobotTasks] = useState([]);
  const [isRobotRunning, setIsRobotRunning] = useState(false);
  const [robotStarted, setRobotStarted] = useState(false);
  const [allocationTime, setAllocationTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [taskMode, setTaskMode] = useState("");
  const [taskOrder, setTaskOrder] = useState("");
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [applied, setApplied] = useState(false);
  const [startPressed, setStartPressed] = useState(false);
  const [robotPaused, setRobotPaused] = useState(false);
  const [robotFinished, setRobotFinished] = useState(false);
  const [robotMessage, setRobotMessage] = useState("");
  const [robotExecutionMessage, setRobotExecutionMessage] = useState("");
  const [currentTaskBlocked, setCurrentTaskBlocked] = useState(false);
  const [blockedTaskMessage, setBlockedTaskMessage] = useState("");

  const [isInitializingRobot, setIsInitializingRobot] = useState(false);
  const [finishedTasks, setFinishedTasks] = useState({
    human_finished: [],
    robot_finished: [],
    all_finished: []
  });
  
  // Check if both human and robot tasks are completely finished
  const areAllTasksFinished = useMemo(() => {
    const humanTasks = tasks.filter(task => task.assignedTo === "Human");
    const robotTasks = tasks.filter(task => task.assignedTo === "Robot");
    
    const humanFinished = finishedTasks.human_finished.length === humanTasks.length;
    const robotFinished = finishedTasks.robot_finished.length === robotTasks.length;
    
    return humanFinished && robotFinished && humanTasks.length > 0 && robotTasks.length > 0;
  }, [tasks, finishedTasks]);

  const [saveEnabled, setSaveEnabled] = useState(() => {
    const stored = localStorage.getItem("saveEnabled");
    return stored === "true"; // default to false if not found
  });

  const secondaryTasks = useMemo(() => [
    { question: "12 + 7 - 5= ?", answer: "14" },
    { question: "15 × 3 = ?", answer: "45" },
    { question: "72 ÷ 8 = ?", answer: "9" },
    { question: "√81 = ?", answer: "9" },
    { question: "14 + 28 + 2 = ?", answer: "44" },
    { question: "5 × 25 = ?", answer: "125" },
    { question: "12 × 4 = ?", answer: "48" },
    { question: "72 ÷ 9 = ?", answer: "8" },
    { question: "125 ÷ 5 = ?", answer: "25" },
    { question: "35 + 12 - 7= ?", answer: "40" },
    { question: "46 + 7 - 5= ?", answer: "48" },
    { question: "√49 = ?", answer: "7" },
    { question: "17 × 3 = ?", answer: "51" },
    { question: "15 + 74 - 3 = ?", answer: "86" },
  ], []);

  const logEvent = useCallback(async (event, details = {}) => {
    if (!participantId) return;
    const payload = {
      participantId,
      event,
      details
    };
    try {
      await axios.post("http://127.0.0.1:8000/log-event", payload);
    } catch (error) {
      console.error("Failed to log event:", error);
    }
  }, [participantId]);




  const handlePause = async () => {
    setRobotPaused(true);
    logEvent("Pause Button Pressed");
    try {
      // Pause both robot movement and task processing
      const [pauseResponse, pauseProcessingResponse] = await Promise.all([
        axios.get("http://127.0.0.1:8000/robot/pause"),
        axios.get("http://127.0.0.1:8000/robot/pause_processing")
      ]);
      console.log("✅ Pause response:", pauseResponse.data);
      console.log("✅ Pause processing response:", pauseProcessingResponse.data);
    } catch (error) {
      console.error("❌ Pause failed:", error);
      // Revert the state if pause failed
      setRobotPaused(false);
    }
  };


  const handleResume = async () => {
    setRobotPaused(false);
    logEvent("Resume Button Pressed");
    try {
      // Resume both robot movement and task processing
      const [resumeResponse, resumeProcessingResponse] = await Promise.all([
        axios.get("http://127.0.0.1:8000/robot/resume"),
        axios.get("http://127.0.0.1:8000/robot/resume_processing")
      ]);
      console.log("✅ Resume response:", resumeResponse.data);
      console.log("✅ Resume processing response:", resumeProcessingResponse.data);
    } catch (error) {
      console.error("❌ Resume failed:", error);
      // Revert the state if resume failed
      setRobotPaused(true);
    }
  };  

  const handleInitializeRobot = async () => {
    logEvent("Initialize Robot Button Pressed");
    setIsInitializingRobot(true);
    
    // Show immediate feedback
    setRobotMessage("Initializing robot...");
    
    try {
      const response = await axios.post("http://127.0.0.1:8000/robot/initialize", {
        taskMode: taskMode
      });
      console.log("✅ Initialize robot response:", response.data);
      
      if (response.data.status === "success") {
        setRobotMessage(`✅ Robot initialized with ${response.data.task_type} position`);
      } else {
        setRobotMessage(`❌ Failed to initialize robot: ${response.data.message}`);
      }
    } catch (error) {
      console.error("❌ Initialize robot failed:", error);
      setRobotMessage("❌ Failed to initialize robot - connection error");
    } finally {
      // Reset the button state after 10 seconds
      setTimeout(() => {
        setIsInitializingRobot(false);
      }, 10000);
    }
  };


  const allTasksAssigned = tasks.every(
    (task) => task.assignedTo === "Human" || task.assignedTo === "Robot"
  );

  const handleSaveToggle = async () => {
    const newState = !saveEnabled;
    setSaveEnabled(newState);
    localStorage.setItem("saveEnabled", newState);

    if (newState) {
      const newId = await fetchNextParticipantId();
      setParticipantId(newId);
      setAllocationTime(Date.now());
    } else {
      setParticipantId(null);
      setAllocationTime(null);
    }
  };


  const fetchNextParticipantId = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/participant-count");
      return `P${res.data.count + 1}`;
    } catch (err) {
      console.error("Failed to get participant count. Defaulting to P1");
      return "P1";
    }
  };


  const humanTasks = tasks.filter((t) => t.assignedTo === "Human");
  const isLast = currentHumanStep === humanTasks.length - 1;
  const currentInstruction = useMemo(() => {
    return humanTasks.length > 0 && currentHumanStep < humanTasks.length
      ? { ...humanTasks[currentHumanStep], isLast }
      : null;
  }, [humanTasks, currentHumanStep, isLast]);

  // Debug: Log humanTasks order when it changes
  useEffect(() => {
    console.log("Human tasks order:", humanTasks.map(t => ({ id: t.id, name: t.name })));
  }, [humanTasks]);

  // Debug: Log current instruction when it changes
  useEffect(() => {
    if (currentInstruction) {
      console.log("Current instruction:", {
        taskId: currentInstruction.id,
        taskName: currentInstruction.name,
        step: currentHumanStep,
        totalTasks: humanTasks.length,
        isLast: currentInstruction.isLast
      });
    }
  }, [currentInstruction, currentHumanStep, humanTasks.length]);


  useEffect(() => {
    fetch("http://localhost:8000/tasks")
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched tasks:", data);
        const updatedTasks = data.map(t => ({
          ...t,
          assignedTo: t.fixedToHuman ? "Human" : "Unassigned",
          sliderValue: t.fixedToHuman ? 0 : 5
        }));
        setTasks(updatedTasks);
        console.log("Updated tasks with fixedToHuman:", updatedTasks);
      })

      .catch((err) => {
        console.error("❌ Error fetching tasks:", err);
      });
  }, []);


  useEffect(() => {
    const interval = setInterval(() => {
      // Only fetch robot message if robot has started
      if (robotStarted) {
        fetch("http://127.0.0.1:8000/robot/message")
          .then((res) => res.json())
                  .then((data) => {
          console.log("🔍 Robot message data:", data);
          // Only set robot execution message, don't set robotMessage here
          if (data.executionMessage !== undefined) setRobotExecutionMessage(data.executionMessage);
        })
        .then(() => {
          // Also fetch human dependency messages
          return fetch("http://127.0.0.1:8000/check-human-dependency");
        })
        .then((res) => res.json())
        .then((humanDependencyData) => {
          console.log("🔍 Human dependency data:", humanDependencyData);
          // Check robot dependencies as well
          return fetch("http://127.0.0.1:8000/check-robot-dependency")
            .then((res) => res.json())
            .then((robotDependencyData) => {
              console.log("🔍 Robot dependency data:", robotDependencyData);
              
              // Prioritize robot dependency messages over human dependency messages
              if (!robotDependencyData.allowed && robotDependencyData.message) {
                const newMessage = `🤖 ${robotDependencyData.message}`;
                if (newMessage !== robotMessage) {
                  setRobotMessage(newMessage);
                }
              } else if (!humanDependencyData.allowed && humanDependencyData.message) {
                const newMessage = `⚠️ ${humanDependencyData.message}`;
                if (newMessage !== robotMessage) {
                  setRobotMessage(newMessage);
                }
              } else {
                // All dependencies are met - show success message
                const successMessage = "✅ All dependencies are met";
                if (robotMessage !== successMessage) {
                  setRobotMessage(successMessage);
                }
              }
              
              // Update blocked states
              setCurrentTaskBlocked(!humanDependencyData.allowed);
              setBlockedTaskMessage(humanDependencyData.message || "");
            });
        })
          .catch((err) => console.error("Error fetching robot message:", err));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [robotStarted, robotMessage]);



  // Fetch execution state periodically
  const fetchExecutionState = useCallback(async () => {
    try {
      const response = await axios.get("http://127.0.0.1:8000/get-execution-state");
      
      // Debug: Print robot assigned tasks
      console.log("🔍 Debug: Robot Assigned Tasks:", response.data.robot_assigned_tasks);
      console.log("🔍 Debug: All Finished Tasks:", response.data.all_finished_tasks);
      
      // Get all tasks to determine which ones are finished
      const allTasks = tasks;
      
      // Find human tasks that are finished (in all_finished_tasks but not in human_assigned_tasks)
      const humanFinishedTasks = allTasks
        .filter(task => task.assignedTo === "Human")
        .filter(task => {
          const taskName = task.name?.trim().toLowerCase();
          const allFinished = response.data.all_finished_tasks.map(t => t.trim().toLowerCase());
          const humanAssigned = response.data.human_assigned_tasks.map(t => t.trim().toLowerCase());
          return allFinished.includes(taskName) && !humanAssigned.includes(taskName);
        })
        .map(task => task.name);
      
      // Find robot tasks that are finished (in all_finished_tasks but not in robot_assigned_tasks)
      const robotFinishedTasks = allTasks
        .filter(task => task.assignedTo === "Robot")
        .filter(task => {
          const taskName = task.name?.trim().toLowerCase();
          const allFinished = response.data.all_finished_tasks.map(t => t.trim().toLowerCase());
          const robotAssigned = response.data.robot_assigned_tasks.map(t => t.trim().toLowerCase());
          return allFinished.includes(taskName) && !robotAssigned.includes(taskName);
        })
        .map(task => task.name);
      
      console.log("🔍 Debug: Human Finished Tasks:", humanFinishedTasks);
      console.log("🔍 Debug: Robot Finished Tasks:", robotFinishedTasks);
      
      setFinishedTasks({
        human_finished: humanFinishedTasks,
        robot_finished: robotFinishedTasks,
        all_finished: response.data.all_finished_tasks
      });
    } catch (error) {
      console.error("Failed to fetch execution state:", error);
    }
  }, [tasks]);

  // Fetch execution state on component mount and periodically
  useEffect(() => {
    // Don't start polling if all tasks are completely finished
    if (areAllTasksFinished) {
      console.log("Skipping execution state polling - all tasks finished");
      return;
    }
    
    fetchExecutionState();
    const interval = setInterval(fetchExecutionState, 2000);
    return () => clearInterval(interval);
  }, [areAllTasksFinished, fetchExecutionState]);

  // Reset robot + polling execution state
  useEffect(() => {

    
    // Reset all frontend state variables
    // Don't reset if all tasks (human + robot) are completely finished
    if (!areAllTasksFinished) {
      setCurrentHumanStep(0);
      setFinished(false);
      setFinishedTasks({
        human_finished: [],
        robot_finished: [],
        all_finished: []
      });
    }
    setCurrentRobotTask(null);
    setExecutedRobotTasks([]);
    setIsRobotRunning(false);
    setRobotStarted(false);
    setRobotPaused(false);
    setRobotFinished(false);
    setRobotMessage("");
    setCurrentTaskBlocked(false);
    setBlockedTaskMessage("");
    setStartPressed(false);
    setShowTaskPopup(false);
    setCurrentTask(null);
    setUserAnswer("");
    setApplied(false);
    setAllocationTime(null);
    setStartTime(null);
    setParticipantId(null);
    setTaskMode("");
    setTaskOrder("");
    
    // Clear any pending robot messages and blocked states immediately
    setTimeout(() => {
      setRobotMessage("");
      setCurrentTaskBlocked(false);
      setBlockedTaskMessage("");

    }, 500);
    
    // Reset robot state and dependencies
    axios.post("http://127.0.0.1:8000/robot/reset")
      .then(res => console.log("✅ Robot state reset after frontend load"))
      .catch(err => console.error("❌ Failed to reset robot state:", err));
    
    // Also reset dependencies explicitly to ensure all lists are cleared
    axios.post("http://127.0.0.1:8000/reset-dependencies")
      .then(res => console.log("✅ Dependencies reset after frontend load"))
      .catch(err => console.error("❌ Failed to reset dependencies:", err));
    
    // Reload tasks to reset their assignments
    fetch("http://localhost:8000/tasks")
      .then((res) => res.json())
      .then((data) => {
        console.log("Reloaded tasks after reset:", data);
        const updatedTasks = data.map(t => ({
          ...t,
          assignedTo: t.fixedToHuman ? "Human" : "Unassigned",
          sliderValue: t.fixedToHuman ? 0 : 5
        }));
        setTasks(updatedTasks);
        console.log("Reset tasks with initial assignments:", updatedTasks);
      })
      .catch((err) => {
        console.error("❌ Error reloading tasks after reset:", err);
      });

    // Robot state polling is now handled in the main robot message polling
    // This prevents conflicts and reduces the number of concurrent polling intervals
  }, []); // Empty dependency array - only run once on mount

  const questionTimeoutRef = useRef(null);

  const showQuestion = useCallback(() => {
    console.log("showQuestion called - showing popup");
    const randomTask = secondaryTasks[Math.floor(Math.random() * secondaryTasks.length)];
    setCurrentTask(randomTask);
    setUserAnswer("");
    setShowTaskPopup(true);
    logEvent("Question Popup Shown", { question: randomTask.question });
  }, [logEvent, secondaryTasks]);



  const isEditable = !robotStarted;

  const updateTaskRole = (taskId, assignedTo, sliderValue = 5) => {
    logEvent("Task Allocation Changed", { taskId, assignedTo, sliderValue });

    // If the interface is not editable, return
    if (!isEditable) return;

    // Prevent changing tasks that are fixed to Human
    const targetTask = tasks.find((task) => task.id === taskId);
    if (targetTask && targetTask.fixedToHuman) {
      console.log(`Task ${taskId} is fixed to Human and cannot be modified.`);
      return;
    }

    // Update the tasks if editable and not fixed
    const updatedTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, assignedTo, sliderValue } : task
    );
    setTasks(updatedTasks);
  };


  useEffect(() => {
    const initializeSaveState = async () => {
      if (saveEnabled && !participantId) {
        const newId = await fetchNextParticipantId();
        setParticipantId(newId);
        setAllocationTime(Date.now());
      }
    };
    initializeSaveState();
  }, [saveEnabled, participantId, fetchNextParticipantId]);


  useEffect(() => {
    const interval = setInterval(() => {
      // Don't poll if all tasks are completely finished
      if (areAllTasksFinished) {
        return;
      }
      
      // Only poll if robot has started and not finished
      if (robotStarted && !robotFinished) {
        axios.get("http://127.0.0.1:8000/robot/execution_state")
          .then(res => {
            setCurrentRobotTask(res.data.current_task);
            setExecutedRobotTasks(res.data.executed_tasks);
          })
          .catch(err => console.error("Failed to fetch robot execution state", err));

        axios.get("http://127.0.0.1:8000/robot/all_completed")
          .then(res => {
            if (res.data.all_completed) {
              setRobotFinished(true) // Disable Resume button
            }
          })
          .catch(err => console.error("Failed to check robot completion", err));
      }
    }, 2000); // Increased from 500ms to 2000ms

    return () => clearInterval(interval);
  }, [robotStarted, robotFinished, areAllTasksFinished]);

  // Function to start the question timer
  const startQuestionTimer = useCallback(() => {
    console.log("startQuestionTimer called");
    if (questionTimeoutRef.current) {
      clearTimeout(questionTimeoutRef.current);
    }
    questionTimeoutRef.current = setTimeout(() => {
      console.log("Question timer expired - calling showQuestion");
      showQuestion();
    }, 15000); // first question after 15 seconds
  }, [showQuestion]);

  // Function to stop the question timer
  const stopQuestionTimer = useCallback(() => {
    if (questionTimeoutRef.current) {
      clearTimeout(questionTimeoutRef.current);
      questionTimeoutRef.current = null;
    }
  }, []);

  // Monitor currentHumanStep changes and check dependencies for current task
  // Dependency checking is now handled in the robot message polling
  // This prevents the blinking issue by using consistent 2-second intervals

  // Handle task reordering - ensure current step is valid
  useEffect(() => {
    // Don't run if all tasks are completely finished
    if (areAllTasksFinished) {
      return;
    }
    
    if (humanTasks.length > 0 && currentHumanStep >= humanTasks.length) {
      // If current step is beyond the available tasks, reset to the last available task
      setCurrentHumanStep(Math.max(0, humanTasks.length - 1));
    }
  }, [humanTasks, currentHumanStep, areAllTasksFinished]);

  // Monitor taskOrder changes and manage question timer
  useEffect(() => {
    console.log("Question timer useEffect - taskOrder:", taskOrder, "robotStarted:", robotStarted, "finished:", finished);
    if (taskOrder === "Question" && robotStarted && !finished) {
      // Start question timer when Question mode is enabled and robot is running
      console.log("Starting question timer");
      startQuestionTimer();
    } else {
      // Stop question timer when Question mode is disabled or robot is not running
      console.log("Stopping question timer");
      stopQuestionTimer();
    }
  }, [taskOrder, robotStarted, finished, startQuestionTimer, stopQuestionTimer]);





  const startRobot = () => {
    logEvent("Start Button Pressed");
    setRobotFinished(false); // reset flag for resume button
    setStartPressed(true);
    if (!isRobotRunning) {
      const now = Date.now();
      setStartTime(now);
      setIsRobotRunning(true);
      setRobotStarted(true);

      // Start execution with current task assignments
      axios.post("http://127.0.0.1:8000/start-execution", tasks)
        .then((res) => {
          console.log("✅ Execution started:", res.data);
        })
        .catch((err) => {
          console.error("❌ Failed to start execution:", err);
        });
      
      // Send tasks to backend to start execution
      axios.post("http://127.0.0.1:8000/robot/start", { tasks })
        .then(() => console.log("Robot tasks queued on backend"))
        .catch((err) => console.error("Failed to start robot tasks:", err));

      // Start question timer if Question mode is active
      if (taskOrder === "Question") {
        startQuestionTimer();
      }
    }
  };

  const handleAnswerSubmit = () => {
    if (userAnswer.trim() === currentTask.answer) {
      logEvent("Question Answered", { question: currentTask.question, answer: userAnswer });
      setShowTaskPopup(false);

      // Continue showing questions if Question mode is still active
      if (taskOrder === "Question" && robotStarted) {
        startQuestionTimer();
      }
    } else {
      logEvent("Question Wrong Answer", { question: currentTask.question, answer: userAnswer });
      alert("❌ Incorrect! Try again.");
    }
  };







  const nextHumanTask = async() => {
    const currentTask = humanTasks[currentHumanStep];
    
    // Check dependencies before allowing task completion
    if (currentTaskBlocked) {
      console.log("Task is blocked by dependencies, cannot proceed");
      return;
    }
    
    // Complete current human task
    try {
      await axios.post(`http://127.0.0.1:8000/complete-human-task?task_name=${currentTask.name}`);
    } catch (error) {
      console.error("Failed to complete human task:", error);
    }

    // Clear blocked state when successfully proceeding
    setCurrentTaskBlocked(false);
    setBlockedTaskMessage("");

    // 📝 Log if proceeding
    if (currentHumanStep < humanTasks.length - 1) {
      logEvent("Next Button Pressed", { taskId: `Task_${currentTask.id}` });
    }
    
    if (currentHumanStep < humanTasks.length - 1) {
      setCurrentHumanStep((prev) => prev + 1);
    } else { 
      // Complete the last human task when Finish button is pressed
      try {
        await axios.post(`http://127.0.0.1:8000/complete-human-task?task_name=${currentTask.name}`);
        console.log("✅ Completed last human task:", currentTask.name);
        
        // Refresh execution state to update the finished tasks lists
        await fetchExecutionState();
      } catch (error) {
        console.error("Failed to complete last human task:", error);
      }
      
      const finish = Date.now();
      setFinished(true);
      logEvent("Finish Button Pressed", { taskId: `Task_${currentTask.id}` });

      // Stop question popup timer
      stopQuestionTimer();

      // Set currentHumanStep to the last task to keep it green
      setCurrentHumanStep(humanTasks.length - 1);
      
      // Only send save if toggle is active
      if (saveEnabled && participantId && startTime && allocationTime) {
        const payload = {
          participantId: participantId,
          allocationTime: allocationTime,
          startTime: startTime,
          finishTime: finish, // Use the current finish time, not the state variable
          tasks: tasks.map(task => ({
            taskName: task.name,
            allocationValue: task.sliderValue ?? 5
          }))
        };

        console.log("🔍 Debug: Sending save payload:", payload);
        axios.post("http://127.0.0.1:8000/save", payload)
          .then((res) => {
            console.log("✅ Data saved:", res.data);
            alert(`Saved data for ${res.data.participantId}`);
          })
          .catch((err) => {
            console.error("❌ Failed to save data:", err);
            console.error("🔍 Debug: Error response:", err.response?.data);
            alert("Error saving data.");
          });
      } 
    }
  };

  const prevHumanTask = () => {
    const currentTask = humanTasks[currentHumanStep];
    logEvent("Previous Button Pressed", { taskId: `Task_${currentTask.id}` });
    
    // Clear blocked state when going to previous step
    setCurrentTaskBlocked(false);
    setBlockedTaskMessage("");
    
    if (currentHumanStep > 0) setCurrentHumanStep((prev) => prev - 1);
    else if (currentHumanStep === 0) { setFinished(false); setCurrentHumanStep(0); }
  };





  // Set initial value of taskOrder from localStorage
  useEffect(() => {
    const last = localStorage.getItem("lastTaskOrder");
    if (last === "Question" || last === "Free") {
      setTaskOrder(last);
    } else {
      setTaskOrder("");
    }
  }, []);

  // On restart, set taskOrder to last value
  const restartTasks = () => {
    setCurrentHumanStep(0);
    setFinished(false);
    setIsRobotRunning(false);
    setRobotStarted(false);
    setCurrentTaskBlocked(false);
    setBlockedTaskMessage("");
    const last = localStorage.getItem("lastTaskOrder");
    if (last === "Question" || last === "Free") {
      setTaskOrder(last);
    } else {
      setTaskOrder("");
    }
  };

  const setRobotMode = (mode) => {
    axios.post("http://127.0.0.1:8000/robot/set_mode", { mode })
      .then(res => console.log(`✅ Robot mode set to: ${mode}`))
      .catch(err => console.error("❌ Failed to set robot mode", err));
  };


  const handleApplyToggles = async () => {
    logEvent("Apply Button Pressed", { taskMode, taskOrder });

        // Set robot mode based on color selection
    if (taskMode === "Second: Orange") {
        setRobotMode("orange");
        try {
          await axios.get("http://localhost:8000/previous-allocation");
            // const response = await axios.get("http://localhost:8000/previous-allocation");
            // Load previous allocations...
        } catch (error) {
            console.error("Failed to load previous allocation:", error);
        }
    } else {
        setRobotMode("yellow");
    }


    // Note: Popup functionality removed - was for Yellow + Question mode

    // If Orange is selected, load previous allocations
    if (taskMode === "Second: Orange") {
      try {
        const response = await axios.get("http://localhost:8000/previous-allocation");
        const previousAllocations = response.data;

        if (previousAllocations.length === 0) {
          console.warn("⚠️ No previous allocation found.");
          alert("No previous allocation found!");
        } else {
          console.log("Loaded previous allocation:", previousAllocations);
          const updatedTasks = tasks.map(task => {
            const match = previousAllocations.find(
              t => t.name.trim().toLowerCase() === task.name.trim().toLowerCase()
            );
            if (match) {
              return {
                ...task,
                assignedTo: match.assignedTo,
                sliderValue: match.sliderValue
              };
            }
            return task;
          });
          setTasks(updatedTasks);
          logEvent("Previous Allocation Loaded", { previousAllocations });
        }
      } catch (error) {
        console.error("❌ Failed to load previous allocation:", error);
        alert("Error loading previous allocation.");
      }
    }

    setApplied(true);  // Activate Apply button (green)
    
    // Automatically initialize robot based on Task Step setting
    if (taskMode === "First: Yellow" || taskMode === "Second: Orange") {
      console.log(`🔄 Auto-initializing robot for Task Step: ${taskMode}`);
      
      // Add a small delay to ensure the Apply button state is updated first
      setTimeout(() => {
        handleInitializeRobot();
      }, 500);
    }
  };


  return (
    <div className="container">      


      <div className="main-panel">
        <div className="left-panel">
          <div className="top-left-panel" style={{ height: "300px", overflow: "auto" }}>
            <TopBar
              participantId={participantId}
              saveEnabled={saveEnabled}
              handleSaveToggle={handleSaveToggle}
              taskMode={taskMode}
              setTaskMode={setTaskMode}
              taskOrder={taskOrder}
              setTaskOrder={setTaskOrder}
              applied={applied}
              handleApplyToggles={handleApplyToggles}
              allTasksAssigned={allTasksAssigned}
              startRobot={startRobot}
              startPressed={startPressed}
            />
            <GraphicalTaskSequence
              tasks={tasks}
              currentHumanStep={currentHumanStep}
              currentRobotTask={currentRobotTask}
              executedRobotTasks={executedRobotTasks || []}
              finishedTasks={finishedTasks}
            />
          </div>

          <div className="bottom-panel">
            <div className="instruction-content">
              <HumanInstruction
                instruction={robotStarted ? currentInstruction?.description : "Here i show you the instruction for each step"}
                image={robotStarted ? currentInstruction?.image : "/final.png"}
                nextStep={nextHumanTask}
                prevStep={prevHumanTask}
                finished={finished}
                restart={restartTasks}
                isLast={isLast}
                currentTask={currentInstruction}
                currentStep={currentHumanStep}
                totalTasks={humanTasks.length}
                isBlocked={currentTaskBlocked}
                blockedMessage={blockedTaskMessage}
              />
            </div>
            <div className="robot-communicator-column">
              <RobotCommunicator message={robotMessage} robotExecutionMessage={robotExecutionMessage} />
              <div className="robot-controls">
                <button
                  className={`toggle-option ${robotPaused ? "" : "active"} ${areAllTasksFinished ? "disabled" : ""}`}
                  onClick={() => {
                    if (!areAllTasksFinished && robotStarted) handleResume();
                  }}
                >
                  Resume robot
                </button>
                <button
                  className={`toggle-option ${robotPaused ? "active" : ""}`}
                  onClick={() => handlePause()}
                >
                  Pause robot
                </button>
                <button
                  className={`toggle-option ${isInitializingRobot ? "initializing" : ""}`}
                  onClick={() => handleInitializeRobot()}
                  style={{
                    backgroundColor: isInitializingRobot ? "#007bff" : "",
                    color: isInitializingRobot ? "white" : "",
                    transition: "all 0.3s ease"
                  }}
                >
                  Initialize robot
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <TaskSequenceView
            tasks={tasks}
            setTasks={setTasks}
            updateTaskRole={updateTaskRole}
            editable={applied && !robotStarted}
            robotStarted={robotStarted}
          />
            

        </div>
        {showTaskPopup && currentTask && (
          <>
            <div className="question-popup-overlay"></div>
            <div className="question-popup">
              <h3>{currentTask.question}</h3>
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Your answer"
              />
              <button onClick={handleAnswerSubmit}>Submit</button>
            </div>
          </>
        )}



      </div>
    </div>
  );

}

export default App;
