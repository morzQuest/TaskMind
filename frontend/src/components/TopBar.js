import React from "react";

function TopBar({
  participantId,
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
  robotInitialized
}) {
  const applyDisabled = taskMode === "" || taskOrder === "";

  return (
    <div
      className="top-bar"
      style={{
        flexShrink: 0,
        flexGrow:0,
        flexBasis: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.3vw",
        background: "#f0fcf0ff",
        padding: "0.5vw",
        borderBottom: "0.1vw solid #ccc",
        marginBottom: "0.5vw",
        fontSize: "0.9vw"
      }}
    >
      {/* Save Mode */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5vw",
          flexWrap: "wrap"
        }}
      >
        <label style={{ fontWeight: "bold" }}>Activate Save Mode:</label>
        <label className="switch">
          <input type="checkbox" checked={saveEnabled} onChange={handleSaveToggle} />
          <span className="slider round"></span>
        </label>
        {saveEnabled && (
          <span style={{ fontWeight: "bold" }}>
            Participant ID: {participantId}
          </span>
        )}
      </div>

      {/* Task and Secondary Task Toggles */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: "3vw",
          flexWrap: "nowrap"
        }}
      >
        {/* Task Step */}
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

        {/* Question Toggle */}
        <div style={{ display: "flex", gap: "0.5vw", alignItems: "center" }}>
          <strong>Question:</strong>
          <span style={{ fontSize: "0.8vw", fontWeight: "bold", color: taskOrder === "Free" ? "#4CAF50" : "#888" }}>
            OFF
          </span>
          <label className="switch">
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

        {/* Apply and Start Buttons */}
        <div
          style={{
            display: "flex",
            gap: "1vw",
            alignItems: "center",
            flexShrink: 0
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
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
            {applyDisabled && (
              <p style={{ color: "red", fontSize: "0.8vw", marginTop: "0.3vw" }}>
                Prerequisits: Task Step and Question
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <button
              onClick={startRobot}
              disabled={!allTasksAssigned || !applied || !robotInitialized}
              style={{
                backgroundColor: (!allTasksAssigned || !applied || !robotInitialized)
                  ? "gray"
                  : startPressed
                  ? "green"
                  : "#007bff",
                color: "white",
                border: "none",
                padding: "0.4vw 0.8vw",
                borderRadius: "0.3vw",
                cursor: (!allTasksAssigned || !applied || !robotInitialized) ? "not-allowed" : "pointer",
                fontWeight: "bold"
              }}
            >
              ▶️ Start
            </button>
            {(!allTasksAssigned || !applied) && (
              <p style={{ color: "red", fontSize: "0.8vw", marginTop: "0.3vw" }}>
                Prerequisits: Apply and Task Allocation
              </p>
            )}
            {!robotInitialized && allTasksAssigned && applied && (
              <p style={{ color: "red", fontSize: "0.8vw", marginTop: "0.3vw" }}>
                Prerequisits: Initialize Robot
              </p>
            )}
            {robotInitialized && !startPressed && (
              <p style={{ color: "green", fontSize: "0.8vw", marginTop: "0.3vw", fontWeight: "bold" }}>
                ✅ Robot Initialized
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default TopBar;
