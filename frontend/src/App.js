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
  const [participantId, setParticipantId] = useState("");
  const [participantIdError, setParticipantIdError] = useState("");
  const [taskMode, setTaskMode] = useState("");
  const [taskOrder, setTaskOrder] = useState("");
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [userAnswer, setUserAnswer] = useState(null); // "even" | "odd" | null
  const [popupSecondsLeft, setPopupSecondsLeft] = useState(10);
  const popupTimerRef = useRef(null);
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savePopupMessage, setSavePopupMessage] = useState("");
  const [savePopupSensorTapped, setSavePopupSensorTapped] = useState(false);
  const [sensorTapped, setSensorTapped] = useState(false);
  const [scenario, setScenario] = useState("");
  const [resolvedParticipantId, setResolvedParticipantId] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const stored = localStorage.getItem("elapsedSeconds");
    return stored ? Number(stored) : 0;
  });
  const [score, setScore] = useState(() => {
    const stored = localStorage.getItem("score");
    return stored ? Number(stored) : 200;
  });
  const [trainingRoundsCompleted, setTrainingRoundsCompleted] = useState(() => {
    const stored = localStorage.getItem("trainingRoundsCompleted");
    return stored ? Number(stored) : 0;
  });
  const [lastAppliedParticipantId, setLastAppliedParticipantId] = useState(() => {
    return localStorage.getItem("lastAppliedParticipantId") || "";
  });
  const [showScenarioPopup, setShowScenarioPopup] = useState(false);
  const [scenarioPopupMessage, setScenarioPopupMessage] = useState("");
  const timerRef = useRef(null);

  const [applied, setApplied] = useState(false);
  const [startPressed, setStartPressed] = useState(false);
  const [robotPaused, setRobotPaused] = useState(false);
  const [robotFinished, setRobotFinished] = useState(false);
  const [robotMessage, setRobotMessage] = useState("");
  const [robotExecutionMessage, setRobotExecutionMessage] = useState("");
  const [currentTaskBlocked, setCurrentTaskBlocked] = useState(false);
  const [blockedTaskMessage, setBlockedTaskMessage] = useState("");
  const [currentTaskOrder, setCurrentTaskOrder] = useState([]);
  const [currentBlockOrder, setCurrentBlockOrder] = useState([]);
  const [taskBlockMapping, setTaskBlockMapping] = useState({});
  const [savedBlockOrder, setSavedBlockOrder] = useState([]);

  const [isInitializingRobot, setIsInitializingRobot] = useState(false);
  const [robotInitialized, setRobotInitialized] = useState(false);
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

 const secondaryTasks = useMemo(() => {
    const numbers = [
      -33, 14, 48, -12, 7, -64, 45, -8, 125, 40,
      -45, 86, 9, -25, 108, -40, 35, -7, 63, -86,
      116, -63, 98, -98, 55, -55, 8, 25, 144, 44,
    ];

    const numberTasks = numbers.map((n) => ({
      type: "number",
      number: n,
      displayText: `Number ${n} is:`,
      correctAnswer: n % 2 === 0 ? "even" : "odd",
    }));

    const calcOperands = [
      2, 5, 7, 9, 11, 13, 15, 4, 6, 8,
      10, 12, 14, 16, 18, 3, 1, 17, 19, 20,
      5, 7, 9, 11, 13, 4, 6, 8, 10, 12,
    ];

    const calcTasks = calcOperands.map((left, idx) => {
      const right = calcOperands[(idx + 3) % calcOperands.length];
      const op = idx % 2 === 0 ? "+" : "-";
      const result = op === "+" ? left + right : left - right;
      return {
        type: "calc",
        left,
        right,
        op,
        expression: `${left} ${op} ${right}`,
        displayText: `Result of ${left} ${op} ${right} is:`,
        correctAnswer: result % 2 === 0 ? "even" : "odd",
      };
    });

    return { numberTasks, calcTasks };
  }, []);

  const logEvent = useCallback(async (event, details = {}) => {
    const effectiveId = resolvedParticipantId || participantId;
    if (!effectiveId) return;
    const payload = {
      participantId: effectiveId,
      event,
      details
    };
    try {
      await axios.post("http://127.0.0.1:8000/log-event", payload);
    } catch (error) {
      console.error("Failed to log event:", error);
    }
  }, [participantId, resolvedParticipantId]);




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
        setRobotInitialized(true);
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

  const handleTaskOrderChange = (newOrder, blockOrder) => {
    setCurrentTaskOrder(newOrder);
    setCurrentBlockOrder(blockOrder);
    
    // Create a mapping of task names to their block names
    const mapping = {};
    blockOrder.forEach(block => {
      block.tasks.forEach(taskName => {
        mapping[taskName] = block.name;
      });
    });
    setTaskBlockMapping(mapping);
    
    console.log("🔍 Task order changed in App.js:", newOrder.map(t => t.name));
    console.log("🔍 Block order changed in App.js:", blockOrder.map(b => b.name));
    console.log("🔍 Task to block mapping:", mapping);
  };

  // Helper function to find which block a task belongs to
  const findTaskBlock = (taskName) => {
    // Use the mapping created from the TaskSequenceView component
    return taskBlockMapping[taskName] || taskName;
  };

  // Helper function to find which block a task belongs to based on task name
  const findTaskBlockFromName = (taskName) => {
    const taskNameLower = taskName.toLowerCase();
    
    // Map task names to their block names based on the actual task names from Excel
    if (taskNameLower.includes('hospital')) return 'Hospital';
    if (taskNameLower.includes('bridge')) return 'Bridge';
    if (taskNameLower.includes('snap')) return 'Snap';
    if (taskNameLower.includes('dovetail')) return 'Dovetail';
    if (taskNameLower.includes('wheel')) return 'Wheel';
    if (taskNameLower.includes('triangle')) return 'Triangle';
    if (taskNameLower.includes('museum')) return 'Museum';
    if (taskNameLower.includes('inspection')) return 'Inspection';
    
    // Default to task name if no match found
    console.warn(`⚠️ No block mapping found for task: ${taskName}`);
    return taskName;
  };

  const allTasksAssigned = tasks.every(
    (task) => task.assignedTo === "Human" || task.assignedTo === "Robot"
  );

  const handleSaveToggle = async () => {
    const newState = !saveEnabled;
    setSaveEnabled(newState);
    localStorage.setItem("saveEnabled", newState);

    if (newState) {
      setParticipantId("");
      setAllocationTime(Date.now());
      setParticipantIdError("Participant ID is required.");
    } else {
      setParticipantId("");
      setAllocationTime(null);
      setParticipantIdError("");
    }
  };


  useEffect(() => {
    if (!saveEnabled) return;
    if (participantId.trim() === "") {
      setParticipantIdError("Participant ID is required.");
    } else if (!scenario) {
      setParticipantIdError("Scenario is required.");
    } else {
      setParticipantIdError("");
    }
  }, [participantId, saveEnabled, scenario]);

  useEffect(() => {
    if (!participantId || !scenario) {
      setResolvedParticipantId("");
      return;
    }

    if (scenario === "T") {
      axios.post("http://127.0.0.1:8000/resolve-participant-id", {
        participantId,
        scenario
      })
      .then((res) => {
        setResolvedParticipantId(res.data.participantId || "");
      })
      .catch(() => {
        setResolvedParticipantId("");
      });
      return;
    }

    if (scenario === "M" || scenario === "MM" || scenario === "F") {
      setResolvedParticipantId(`${participantId}${scenario}`);
      return;
    }

    setResolvedParticipantId(participantId);
  }, [participantId, scenario]);

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
              const hasRobotTasks = tasks.some(task => task.assignedTo === "Robot");

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
              } else if (!hasRobotTasks) {
                const noTaskMessage = "🎉 All robot tasks finished!";
                if (robotMessage !== noTaskMessage) {
                  setRobotMessage(noTaskMessage);
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
  }, [robotStarted, robotMessage, tasks]);



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
    setRobotInitialized(false);
    setCurrentTaskBlocked(false);
    setBlockedTaskMessage("");
    setStartPressed(false);
    setShowTaskPopup(false);
    setCurrentTask(null);
    setUserAnswer("");
    setApplied(false);
    setAllocationTime(null);
    setStartTime(null);
    setParticipantId("");
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
  const QUESTION_INTERVAL_MS = 30 * 1000; // 30 seconds

  // Play a short beep when the question popup appears
  const playBeep = useCallback(() => {
    try {
        const audio = new Audio('/beep.mp3');
        audio.play();
    } catch (e) {
      // Silently ignore if audio is blocked
      console.warn('Beep sound could not be played:', e);
    }
  }, []);

  useEffect(() => {
    if (showSavePopup) {
      setSavePopupSensorTapped(false);
      playBeep();
    }
  }, [showSavePopup, playBeep]);

  useEffect(() => {
    if (showScenarioPopup) {
      playBeep();
    }
  }, [showScenarioPopup, playBeep]);

  const showQuestion = useCallback(() => {
    console.log("showQuestion called - showing popup");
    const useCalc = Math.random() < 0.5;
    const source = useCalc ? secondaryTasks.calcTasks : secondaryTasks.numberTasks;
    const randomTask = source[Math.floor(Math.random() * source.length)];
    setCurrentTask(randomTask);
    setUserAnswer(null);
    setShowTaskPopup(true);

    playBeep();
    logEvent("Question Popup Shown", { question: randomTask.displayText, type: randomTask.type });
  }, [logEvent, secondaryTasks, playBeep]);



  const isEditable = !robotStarted;

  const updateTaskRole = (taskId, assignedTo, sliderValue = 5) => {

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
    }, QUESTION_INTERVAL_MS); // show question every 20 minutes
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
    const effectiveId = resolvedParticipantId || participantId;
    if (!effectiveId) {
      alert("Please enter a Participant ID and select a scenario before starting.");
      return;
    }
    if (!sensorTapped) {
      alert("Please confirm 'Sensor tapped' before starting.");
      return;
    }
    logEvent("Start Button Pressed");

    // Show scenario popup for M, MM, F - defer actual start until popup closes
    if (scenario === "M" || scenario === "MM" || scenario === "F") {
      const messageMap = {
          M: "Accepted ✅ Your allocation will be used.",
          MM: "Rejected ❌ Your allocation preferences were **not** taken into account. The system selected a (random) different allocation.",
          F: "The system chose a better optimized solution for you. Let's see how many points you can collect!"
      };
      setScenarioPopupMessage(messageMap[scenario] || "");
      setShowScenarioPopup(true);
      return;
    }

    // For T scenario, start immediately
    actuallyStartRobot();
  };

  const actuallyStartRobot = () => {
    setRobotFinished(false); // reset flag for resume button
    setStartPressed(true);
    if (!isRobotRunning) {
      const shouldScore = scenario !== "T";
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        if (shouldScore) {
          setScore((prev) => prev - 1);
        }
      }, 1000);

      const now = Date.now();
      setStartTime(now);
      if (saveEnabled && !allocationTime) {
        setAllocationTime(now);
      }
      const tasksToStart = applyScenarioToTasks(tasks);
      setTasks(tasksToStart);
      setIsRobotRunning(true);
      setRobotStarted(true);


      // Start execution with current task assignments
      axios.post("http://127.0.0.1:8000/start-execution", tasksToStart)
        .then((res) => {
          console.log("✅ Execution started:", res.data);
        })
        .catch((err) => {
          console.error("❌ Failed to start execution: ", err);
        });
      
      // Send tasks to backend to start execution
      axios.post("http://127.0.0.1:8000/robot/start", { tasks: tasksToStart })
        .then(() => console.log("Robot tasks queued on backend"))
        .catch((err) => console.error("Failed to start robot tasks:", err));

      // Start question timer if Question mode is active
      if (taskOrder === "Question") {
        startQuestionTimer();
      }
    }
  };

  const closeScenarioPopup = () => {
    setShowScenarioPopup(false);
    actuallyStartRobot();
  };

  const handleAnswerSubmit = () => {
    if (userAnswer.trim() === currentTask.answer) {
      setScore((prev) => prev + 10);
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

const handleParityAnswer = useCallback(
  (selected) => {
    if (!currentTask) return;
    setUserAnswer (selected);

    const isCorrect = selected === currentTask.correctAnswer;

    if (isCorrect) {
      // Only add points outside Training scenario
      if (scenario !== "T") {
        setScore((prev) => prev + 10);
      }
      logEvent("Question Answered", {
        number: currentTask.number,
        answer: selected,
        correctAnswer: currentTask.correctAnswer,
        isCorrect: true,
      });

      setShowTaskPopup(false);

      if (taskOrder === "Question" && robotStarted) {
        startQuestionTimer();
      }
    } else {
      logEvent("Question Wrong Answer", {
        number: currentTask.number,
        answer: selected,
        correctAnswer: currentTask.correctAnswer,
        isCorrect: false,
      });

      alert("❌ Incorrect! Try again.");

    }
  },
      [currentTask, logEvent, robotStarted, startQuestionTimer, taskOrder, scenario]
);







  const nextHumanTask = async() => {
    const currentTask = humanTasks[currentHumanStep];
    const currentTaskName = currentTask?.name || "";
    const isInspectionTask = currentTaskName.toLowerCase().includes("inspection");

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

    if (isInspectionTask && (scenario === "M" || scenario === "MM" || scenario === "F")) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      logEvent("Inspection Finished", { elapsedSeconds, score });
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

      if (scenario === "T") {
        setTrainingRoundsCompleted((prev) => prev + 1);
      }

      // Set currentHumanStep to the last task to keep it green
      setCurrentHumanStep(humanTasks.length - 1);
      
      // Only send save if toggle is active
      if (saveEnabled && participantId && startTime && allocationTime) {
        const payload = {
          participantId: resolvedParticipantId || participantId,
          allocationTime: allocationTime,
          startTime: startTime,
          finishTime: finish,
          tasks: tasks.map(task => ({
            taskName: task.name,
            allocationValue: task.sliderValue ?? 5
          }))
        };

        console.log("🔍 Debug: Sending save payload:", payload);
        axios.post("http://127.0.0.1:8000/save", payload)
          .then((res) => {
            console.log("✅ Data saved:", res.data);
            setSavePopupMessage(`Saved data for ${res.data.participantId}`);
            setShowSavePopup(true);
          })
          .catch((err) => {
            console.error("❌ Failed to save data:", err);
            console.error("🔍 Debug: Error response:", err.response?.data);
            alert("Error saving data.");
          });
      } else {
        const missing = [];
        if (!saveEnabled) missing.push("Save Mode disabled");
        if (!participantId) missing.push("Participant ID missing");
        if (!startTime) missing.push("Start time missing");
        if (!allocationTime) missing.push("Allocation time missing");
        alert(`Save skipped: ${missing.join(", ")}`);
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
    setRobotInitialized(false);
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

    if (participantId && participantId !== lastAppliedParticipantId) {
      // New participant: reset timer/score/training counts
      setElapsedSeconds(0);
      setScore(200);
      setTrainingRoundsCompleted(0);
      setLastAppliedParticipantId(participantId);
    }

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

    // If Orange is selected, load previous allocations and task order
    if (taskMode === "Second: Orange") {
      try {
        // Load previous allocations
        const allocationResponse = await axios.get("http://localhost:8000/previous-allocation");
        const previousAllocations = allocationResponse.data;
        
        console.log("🔍 Previous allocation API response:", allocationResponse.data);
        console.log("🔍 Previous allocations count:", previousAllocations.length);

        if (previousAllocations.length === 0) {
          console.warn("⚠️ No previous allocation found.");
          alert("No previous allocation found!");
        } else {
          console.log("✅ Loaded previous allocation:", previousAllocations);
          let updatedTasks = tasks.map(task => {
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
          // For Orange mode: keep the initial order, do not load/apply Yellow block order
          // Clear any previously saved block order so UI preserves current order
          setSavedBlockOrder([]);
          console.log("Keeping initial task order for Orange mode.");
          setTasks([...updatedTasks]);
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

  // Switch all allocations between Human and Robot for switchable tasks
  const handleSwitchAllAllocations = () => {
    const updatedTasks = tasks.map(task => {
      if (task.fixedToHuman) return task; // Do not switch fixed tasks
      if (task.assignedTo === "Human") return { ...task, assignedTo: "Robot" };
      if (task.assignedTo === "Robot") return { ...task, assignedTo: "Human" };
      // If unassigned, default to Human
      return { ...task, assignedTo: "Human" };
    });
    setTasks(updatedTasks);
    logEvent && logEvent("Switch All Allocations Button Pressed");
  };

  // Apply scenario-specific allocations right before Start
  const applyScenarioToTasks = (inputTasks) => {
    if (scenario === "MM") {
      return inputTasks.map(task => {
        if (task.fixedToHuman) return task;
        if (task.assignedTo === "Human") return { ...task, assignedTo: "Robot" };
        if (task.assignedTo === "Robot") return { ...task, assignedTo: "Human" };
        return { ...task, assignedTo: "Human" };
      });
    }

    if (scenario === "F") {
      const fixedAllocations = {
        "Museum": 10,
        "Triangle": 10,
        "Wheel_holder": 0,
        "Wheel_holder_screws": 0,
        "Wheel": 0,
        "Wheel_screws": 0,
        "Bridge_triangle_roof": 10,
        "Bridge_flat_roof": 10,
        "Bridge rod placement": 0,
        "Snap_buttom": 0,
        "Snap_middle": 0,
        "Snap_top": 0,
        "Hospital_base": 10,
        "Hospital_big_top": 10,
        "Hospital_small_top": 0,
        "Hospital_screws": 0,
        "Dovetail_buttom": 10,
        "Dovetail_top": 10
      };

      return inputTasks.map(task => {
        if (!(task.name in fixedAllocations)) return task;
        const sliderValue = fixedAllocations[task.name];
        const assignedTo = sliderValue > 5 ? "Robot" : "Human";
        return { ...task, sliderValue, assignedTo };
      });
    }

    return inputTasks;
  };
/*
  useEffect(() => {
    if (scenario !== "F") return;
    const updatedTasks = applyScenarioToTasks(tasks);
    const changed = updatedTasks.length !== tasks.length || updatedTasks.some((task, index) => {
      const current = tasks[index];
      return !current || task.assignedTo !== current.assignedTo || task.sliderValue !== current.sliderValue;
    });
    if (changed) {
      setTasks(updatedTasks);
    }
  }, [scenario, tasks]);
*/
  useEffect(() => {
    if (showSavePopup) {
      setSavePopupSensorTapped(false);
      playBeep();
    }
  }, [showSavePopup, playBeep]);

  useEffect(() => {
    if (showScenarioPopup) {
      playBeep();
    }
  }, [showScenarioPopup, playBeep]);

  return (
    <div className="container">      


      <div className="main-panel">
        <div className="left-panel">
          <div className="top-left-panel" style={{ height: "300px", overflow: "auto" }}>
            <TopBar
              participantId={participantId}
              setParticipantId={setParticipantId}
              participantIdError={participantIdError}
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
              robotInitialized={robotInitialized}
              sensorTapped={sensorTapped}
              setSensorTapped={setSensorTapped}
              scenario={scenario}
              setScenario={setScenario}
              resolvedParticipantId={resolvedParticipantId}
              score={score}
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
                instruction={robotStarted ? currentInstruction?.description : "Here I show you the instruction for each step"}
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
                robotInitialized={robotInitialized}
                startPressed={startPressed}
                elapsedSeconds={elapsedSeconds}
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
            onOrderChange={handleTaskOrderChange}
            savedBlockOrder={savedBlockOrder}
            slidersLocked={scenario === "F" && !applied}
          />
        </div>
        {showTaskPopup && currentTask && (
          <>
            <div className="question-popup-overlay"></div>
            <div className="question-popup" style={{
                fontSize: "1.8vw",
                width: "25%",
                height: "12%",
                outline: "3px solid #007bff",
            }}>
                {currentTask.displayText}
                          {/* Choose even or odd: */}
            <div className="parity-buttons">
              <button onClick={() => handleParityAnswer("even")} style={{marginInlineEnd: "10px", fontSize: "1vw", marginTop: "10px"}}>Even</button>
              <button onClick={() => handleParityAnswer("odd")} style={{fontSize: "1vw"}}>Odd</button>
            </div>
                <span style={{fontSize:"1vw"}}>+10 points for each correct answer!</span>
            </div>
          </>
        )}
        {showScenarioPopup && (
          <>
            <div className="question-popup-overlay"></div>
            <div className="question-popup">
              <button
                onClick={closeScenarioPopup}
                style={{
                  position: "absolute",
                  top: "0.4vw",
                  right: "0.4vw",
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5vw",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
                aria-label="Close"
              >
                ✕
              </button>
              <p style={{ fontWeight: "bold", fontSize: "1.2vw", marginTop: "0.5vw" }}>{scenarioPopupMessage}</p>
              <button
                onClick={closeScenarioPopup}
                style={{
                  marginTop: "1vw",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  padding: "0.5vw 1vw",
                  borderRadius: "0.3vw",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "1vw"
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
        {showSavePopup && (
          <>
            <div className="question-popup-overlay"></div>
            <div className="question-popup">
              <h3>✅ Data saved</h3>
              <p>{savePopupMessage}</p>
              <p style={{ fontWeight: "bold" }}>Score: {score}</p>
              <label style={{ display: "flex", alignItems: "center", gap: "0.2vw", fontWeight: "bold", marginTop: "0.6vw" }}>
                <input
                  type="checkbox"
                  checked={savePopupSensorTapped}
                  onChange={(e) => setSavePopupSensorTapped(e.target.checked)}
                  style={{width: "25%"}}
                />
                Sensor Tapped
              </label>
              <button
                onClick={() => setShowSavePopup(false)}
                disabled={!savePopupSensorTapped}
                style={{
                  marginTop: "0.6vw",
                  backgroundColor: savePopupSensorTapped ? "#007bff" : "gray",
                  color: "white",
                  border: "none",
                  padding: "0.4vw 0.8vw",
                  borderRadius: "0.3vw",
                  cursor: savePopupSensorTapped ? "pointer" : "not-allowed",
                  fontWeight: "bold"
                }}
              >
                Close
              </button>
            </div>
          </>
        )}



      </div>
    </div>
  );

}

export default App;
