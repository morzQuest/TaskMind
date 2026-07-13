import React, { useEffect, useRef, useState } from "react";

function TopBar({
  participantId,
  setParticipantId,
  participantIdError,
  saveEnabled,
  handleSaveToggle,
  taskMode,
  setTaskMode,
  taskOrder,
  setTaskOrder,
  applied,
  handleApplyToggles,
  allTasksAssigned,
  startRobot,
  startPressed,
  robotInitialized,
  sensorTapped,
  setSensorTapped,
  scenario,
  setScenario,
  robotFinished,
  score,
  onResetScoreAndTime
}) {
  const applyDisabled = taskMode === "" || taskOrder === "";
  const showParticipantIdError = saveEnabled && participantIdError;
  const startDisabled = !allTasksAssigned || !applied  || !robotInitialized || !sensorTapped || !participantId;
  const applyTooltip = applyDisabled ? "Prerequisits: Task Step and Question" : "";
  const startTooltip = startDisabled
    ? "Prerequisits: Apply, Task Allocation, Initialize Robot, Sensor tapped, Participant ID"
    : "";

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!robotFinished) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [robotFinished]);

  const formatElapsed = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleStartClick = () => {
    if (startDisabled) return;
    startRobot();
    setElapsedSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  return (
    <div
      className="top-bar"
      style={{
        flexShrink: 0,
        flexGrow: 0,
        flexBasis: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.4vw",
        background: "#f0fcf0ff",
        padding: "0.6vw",
        borderBottom: "0.1vw solid #ccc",
        marginBottom: "0.5vw",
        fontSize: "0.9vw"
      }}
    >

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1.4fr 1.4fr 1.2fr",
          gap: "0.8vw",
          alignItems: "start"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4vw" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontWeight: "bold" }}>Save Mode:</label>
              <label className="switch" style={{ transform: "scale(0.8)", transformOrigin: "center" }}>
                  <input type="checkbox" checked={saveEnabled} onChange={handleSaveToggle} />
                  <span className="slider round"></span>
              </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5vw", flexWrap: "wrap" }}>

            {saveEnabled && (
              <label style={{ fontWeight: "bold" }}>
                Participant ID:
                <input
                  type="text"
                  value={participantId}
                  onChange={e => setParticipantId(e.target.value)}
                  placeholder="P123MM"
                  style={{ width: "8vw", fontSize: "0.9em", marginLeft: "0.3vw" }}
                />
                {showParticipantIdError && (
                  <span style={{ marginLeft: "0.4vw", color: "red", fontSize: "0.8vw" }}>
                    {participantIdError}
                  </span>
                )}
              </label>
            )}
          </div>
          <div style={{ fontWeight: "bold", color: "#c00000", display: "flex", alignItems: "center", gap: "0.4vw" }}>
            <span>Score: {score}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5vw" }}>
          <div style={{ display: "flex", gap: "0.5vw", alignItems: "center" }}>
            <strong>Task Step:</strong>
            <label>
              <input
                type="radio"
                name="mode"
                value="First: Yellow"
                checked={taskMode === "First: Yellow"}
                onChange={() => setTaskMode("First: Yellow")}
              />{" "}
              First: Yellow
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.6vw", alignItems: "center" }}>
            <strong>Scenario:</strong>
            <label>
              <input
                  type="radio"
                  name="scenario"
                  value="T"
                  checked={scenario === "T"}
                  onChange={() => setScenario("T")}
              />{" "}
              T
            </label>
            <label>
              <input
                type="radio"
                name="scenario"
                value="M"
                checked={scenario === "M"}
                onChange={() => setScenario("M")}
              />{" "}
              M
            </label>
            <label>
              <input
                type="radio"
                name="scenario"
                value="MM"
                checked={scenario === "MM"}
                onChange={() => setScenario("MM")}
              />{" "}
              MM
            </label>
            <label>
              <input
                type="radio"
                name="scenario"
                value="F"
                checked={scenario === "F"}
                onChange={() => setScenario("F")}
              />{" "}
              F
            </label>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5vw" }}>
          <div style={{ display: "flex", gap: "0.5vw", alignItems: "center" }}>
            <strong>Question:</strong>
            <span style={{ fontSize: "0.8vw", fontWeight: "bold", color: taskOrder === "Free" ? "#4CAF50" : "#888" }}>
              OFF
            </span>
            <label className="switch" style={{ transform: "scale(0.8)", transformOrigin: "left center" }}>
              <input
                type="checkbox"
                checked={taskOrder === "Question"}
                onChange={e => {
                  const value = e.target.checked ? "Question" : "Free";
                  setTaskOrder(value);
                  localStorage.setItem("lastTaskOrder", value);
                }}
                disabled={applied}
              />
              <span className="slider round"></span>
            </label>
            <span style={{ fontSize: "0.8vw", fontWeight: "bold", color: taskOrder === "Question" ? "#4CAF50" : "#888" }}>
              ON
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4vw", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "0.6vw", alignItems: "center" }}>
            <span title={applyTooltip} style={{ display: "inline-flex" }}>
              <button
                onClick={handleApplyToggles}
                disabled={applyDisabled}
                style={{
                  backgroundColor: applied ? "green" : applyDisabled ? "gray" : "#007bff",
                  color: "white",
                  border: "none",
                  padding: "0.4vw 0.8vw",
                  borderRadius: "0.3vw",
                  cursor: applyDisabled ? "not-allowed" : "pointer",
                  fontWeight: "bold"
                }}
              >
                Apply
              </button>
            </span>
            <span title={startTooltip} style={{ display: "inline-flex" }}>
              <button
                onClick={startRobot}
                disabled={startDisabled}
                style={{
                  backgroundColor: startDisabled
                    ? "gray"
                    : startPressed
                    ? "green"
                    : "#007bff",
                  color: "white",
                  border: "none",
                  padding: "0.4vw 0.8vw",
                  borderRadius: "0.3vw",
                  cursor: startDisabled ? "not-allowed" : "pointer",
                  fontWeight: "bold"
                }}
              >
                ▶️ Start
              </button>
            </span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4vw", fontWeight: "bold", marginTop: "0.3vw" }}>
            <input
              type="checkbox"
              checked={sensorTapped}
              onChange={e => setSensorTapped(e.target.checked)}
              disabled={!applied}
            />
            Sensor Tapped
          </label>

        </div>

      </div>
    </div>
  );
}

export default TopBar;
