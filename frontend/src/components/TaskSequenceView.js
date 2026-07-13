import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./TaskSequenceView.css";

function SortableTask({ task, updateTaskRole, editable, isLastTask, slidersLocked }) {
  const getColorClass = () => {
    if (task.assignedTo === "Human") return "human";
    if (task.assignedTo === "Robot") return "robot";
    return "unassigned";
  };

  const getSliderValue = () => {
    if (task.sliderValue !== undefined) return task.sliderValue;
    return 5; // Default center value
  };

  const handleChange = (e) => {
    if (!editable || slidersLocked || task.fixedToHuman) return;
    const val = parseInt(e.target.value);
    const assignedTo = val > 5 ? "Robot" : "Human";
    updateTaskRole(task.id, assignedTo, val);
  };

  return (
    <div className={`task-card ${getColorClass()} ${isLastTask ? 'last-task-card' : ''}`}>
      <div className="task-inline">
        <span className="task-name">
          Task {task.id}: {task.name}
          {task.fixedToHuman && <span className="lock-icon">🔒</span>}

        </span>
        <div className="slider-inline">
          <label>human</label>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={getSliderValue()}
            onChange={handleChange}
            disabled={!editable || slidersLocked || task.fixedToHuman || isLastTask}
          />
          <label>robot</label>
          <span style={{ marginLeft: "0.2vw" }}>{getSliderValue()}</span>
        </div>
      </div>
    </div>
  );
}

function SortableDependencyGroup({ group, tasks, updateTaskRole, editable, groupNames, isLastTask, slidersLocked }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `group-${group.join('-')}`,
    disabled: isLastTask // Disable dragging for the last task
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const groupTasks = tasks.filter(task => group.includes(task.name));
  
  // Get the group name from the first task in the group
  const groupName = groupTasks.length > 0 ? groupNames[groupTasks[0].name] || "" : "";

  return (
    <div
      ref={setNodeRef}
      className={`dependency-group-container ${isLastTask ? 'last-task-fixed' : ''}`}
      {...(isLastTask ? {} : attributes)}
      {...(isLastTask ? {} : listeners)}
      style={style}
      data-dragging={isDragging}
    >
      {groupName && (
        <div className="dependency-group-header">
          <div className="dependency-group-label">{groupName}</div>
        </div>
      )}
      <div className="dependency-group-content">
        {groupTasks.map((task) => (
          <SortableTask
            key={task.id}
            task={task}
            updateTaskRole={updateTaskRole}
            editable={editable}
            isLastTask={isLastTask}
            slidersLocked={slidersLocked}
          />
        ))}
      </div>
    </div>
  );
}

function SortableIndependentTask({ task, updateTaskRole, editable, groupNames, isLastTask, slidersLocked }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    disabled: isLastTask // Disable dragging for the last task
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const groupName = groupNames[task.name] || "";

  return (
    <div
      ref={setNodeRef}
      className={`independent-task-container ${isLastTask ? 'last-task-fixed' : ''}`}
      {...(isLastTask ? {} : attributes)}
      {...(isLastTask ? {} : listeners)}
      style={style}
      data-dragging={isDragging}
    >
      {groupName && (
        <div className="dependency-group-header">
          <div className="dependency-group-label">{groupName}</div>
        </div>
      )}
      <div className="dependency-group-content">
        <SortableTask
          task={task}
          updateTaskRole={updateTaskRole}
          editable={editable}
          isLastTask={isLastTask}
          slidersLocked={slidersLocked}
        />
      </div>
    </div>
  );
}

function TaskSequenceView({ tasks, setTasks, updateTaskRole, editable, robotStarted, onOrderChange, savedBlockOrder, slidersLocked }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );
  const [allSortableItems, setAllSortableItems] = useState([]);
  const [groupNames, setGroupNames] = useState({});

  // Function to group dependent tasks
  const groupDependentTasks = (tasks) => {
    const groups = [];
    const visited = new Set();
    
    // Helper function to find all connected tasks (dependencies)
    const findConnectedTasks = (taskName, currentGroup) => {
      if (visited.has(taskName)) return;
      visited.add(taskName);
      currentGroup.push(taskName);
      
      // Find tasks that depend on this task
      tasks.forEach(task => {
        if (task.dependencies && task.dependencies.includes(taskName)) {
          findConnectedTasks(task.name, currentGroup);
        }
      });
      
      // Find tasks that this task depends on
      const currentTask = tasks.find(t => t.name === taskName);
      if (currentTask && currentTask.dependencies) {
        currentTask.dependencies.forEach(dep => {
          findConnectedTasks(dep, currentGroup);
        });
      }
    };
    
    // Find groups for each unvisited task, in the order they appear in the tasks array
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!visited.has(task.name)) {
        const group = [];
        findConnectedTasks(task.name, group);
        if (group.length > 1) { // Only create groups for dependent tasks
          groups.push([...new Set(group)]); // Remove duplicates
        }
      }
    }
    
    return groups;
  };

  // Fetch dependencies and create unified sortable list
  useEffect(() => {
    console.log("🔄 TaskSequenceView useEffect triggered");
    console.log("TaskSequenceView received tasks:", tasks.map(t => ({ name: t.name, id: t.id })));
    console.log("TaskSequenceView task order:", tasks.map(t => t.name));
    console.log("TaskSequenceView savedBlockOrder:", savedBlockOrder);
    
    const fetchDependencies = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/get-task-dependencies');
        const data = await response.json();
        
        // Add dependencies to tasks
        const tasksWithDeps = tasks.map(task => ({
          ...task,
          dependencies: data.dependencies[task.name] || []
        }));
        
        const groups = groupDependentTasks(tasksWithDeps);
        setGroupNames(data.group_names || {});
        
        // Find independent tasks (not in any group)
        const groupedTaskNames = new Set();
        groups.forEach(group => {
          group.forEach(taskName => groupedTaskNames.add(taskName));
        });
        
        const independent = tasks.filter(task => !groupedTaskNames.has(task.name));
        
        // Create a unified list where each red box is a single block
        const unifiedBlocks = [];
        
        // Add dependent groups as blocks
        groups.forEach(group => {
          const groupTasks = tasks.filter(task => group.includes(task.name));
          // Sort group tasks by their current order in the tasks array
          groupTasks.sort((a, b) => {
            const indexA = tasks.findIndex(t => t.id === a.id);
            const indexB = tasks.findIndex(t => t.id === b.id);
            return indexA - indexB;
          });
          
          unifiedBlocks.push({
            type: 'group',
            tasks: groupTasks,
            originalOrder: Math.min(...groupTasks.map(t => tasks.findIndex(task => task.id === t.id)))
          });
        });
        
        // Add independent tasks as individual blocks
        independent.forEach(task => {
          unifiedBlocks.push({
            type: 'independent',
            tasks: [task],
            originalOrder: tasks.findIndex(t => t.id === task.id)
          });
        });
        
        // Sort blocks by their current order in the tasks array
        console.log('Before sorting - unified blocks:', unifiedBlocks.map(block => ({
          type: block.type,
          firstTask: block.tasks[0].name,
          currentOrder: tasks.findIndex(t => t.id === block.tasks[0].id)
        })));
        
        // Helper function to find block name from task name
        const findBlockNameFromTask = (taskName) => {
          const taskNameLower = taskName.toLowerCase();
          if (taskNameLower.includes('hospital')) return 'Hospital';
          if (taskNameLower.includes('bridge')) return 'Bridge';
          if (taskNameLower.includes('snap')) return 'Snap';
          if (taskNameLower.includes('dovetail')) return 'Dovetail';
          if (taskNameLower.includes('wheel')) return 'Wheel';
          if (taskNameLower.includes('triangle')) return 'Triangle';
          if (taskNameLower.includes('museum')) return 'Museum';
          if (taskNameLower.includes('inspection')) return 'Inspection';
          return taskName;
        };
        
        console.log('🔄 Starting block sorting...');
        console.log('🔄 Saved block order available:', savedBlockOrder && savedBlockOrder.length > 0);
        if (savedBlockOrder && savedBlockOrder.length > 0) {
          console.log('🔄 Saved block order:', savedBlockOrder);
        }
        
        unifiedBlocks.sort((a, b) => {
          // If we have saved block order, use it to sort
          if (savedBlockOrder && savedBlockOrder.length > 0) {
            console.log("🔄 Using saved block order for sorting:", savedBlockOrder);
            const aFirstTask = a.tasks[0];
            const bFirstTask = b.tasks[0];
            
            // Prefer explicit group name from Excel mapping when available,
            // fallback to heuristic mapping from task name
            const aBlockName = (groupNames[aFirstTask.name] || findBlockNameFromTask(aFirstTask.name));
            const bBlockName = (groupNames[bFirstTask.name] || findBlockNameFromTask(bFirstTask.name));
            
            console.log(`🔄 Comparing blocks: ${aBlockName} vs ${bBlockName}`);
            
            const aOrder = savedBlockOrder.findIndex(blockName => 
              blockName.toLowerCase() === aBlockName.toLowerCase()
            );
            const bOrder = savedBlockOrder.findIndex(blockName => 
              blockName.toLowerCase() === bBlockName.toLowerCase()
            );
            
            console.log(`🔄 Block orders in saved list: ${aBlockName} at index ${aOrder}, ${bBlockName} at index ${bOrder}`);
            
            // If both blocks are found in saved order, sort by their order
            if (aOrder !== -1 && bOrder !== -1) {
              console.log(`Sorting by saved order: ${aBlockName} (${aOrder}) vs ${bBlockName} (${bOrder})`);
              return aOrder - bOrder;
            }
            // If only one is found, prioritize the found one
            else if (aOrder !== -1) {
              console.log(`Prioritizing ${aBlockName} (found in saved order)`);
              return -1;
            }
            else if (bOrder !== -1) {
              console.log(`Prioritizing ${bBlockName} (found in saved order)`);
              return 1;
            }
          }
          
          // Fallback to current order in tasks array
          const aFirstTask = a.tasks[0];
          const bFirstTask = b.tasks[0];
          
          const aCurrentOrder = tasks.findIndex(t => t.id === aFirstTask.id);
          const bCurrentOrder = tasks.findIndex(t => t.id === bFirstTask.id);
          
          console.log(`Sorting by current order: ${aFirstTask.name} (${aCurrentOrder}) vs ${bFirstTask.name} (${bCurrentOrder})`);
          
          return aCurrentOrder - bCurrentOrder;
        });
        
        console.log('After sorting - unified blocks:', unifiedBlocks.map(block => ({
          type: block.type,
          firstTask: block.tasks[0].name,
          currentOrder: tasks.findIndex(t => t.id === block.tasks[0].id)
        })));
        
        // Log the final block order for debugging
        console.log('🔄 Final block order after sorting:', unifiedBlocks.map(block => {
          const blockName = findBlockNameFromTask(block.tasks[0].name);
          return blockName;
        }));
        
        setAllSortableItems(unifiedBlocks);
        
        // Debug: Log the unified blocks
        console.log('Unified blocks created:', unifiedBlocks.map(block => ({
          type: block.type,
          taskNames: block.tasks.map(t => t.name),
          originalOrder: block.originalOrder,
          currentOrder: tasks.findIndex(t => t.id === block.tasks[0].id)
        })));
        
        // Debug: Log the final block order
        console.log('Final block order after sorting:', unifiedBlocks.map(block => {
          if (block.type === 'group') {
            return groupNames[block.tasks[0].name] || block.tasks[0].name;
          } else {
            return block.tasks[0].name;
          }
        }));
      } catch (error) {
        console.error('Failed to fetch dependencies:', error);
      }
    };
    
    fetchDependencies();
  }, [tasks, savedBlockOrder]);

  const handleDragEnd = (event) => {
    // Prevent dragging when robot has started
    if (!editable) return;

    // Allow dragging even when not in applied mode, but show a warning
    const { active, over } = event;
    if (!over) return;

    // Handle complex dependency mode
    // Find old and new indices in the unified list
    let oldIndex = -1;
    let newIndex = -1;

    // Find the dragged item
    for (let i = 0; i < allSortableItems.length; i++) {
      const item = allSortableItems[i];
      let itemId;

      if (item.type === 'group') {
        itemId = `group-${item.tasks.map(t => t.name).join('-')}`;
      } else {
        itemId = `task-${item.tasks[0].id}`;
      }

      if (itemId === active.id) {
        oldIndex = i;
      }

      if (itemId === over.id) {
        newIndex = i;
      }
    }

    // Prevent reordering if the last task (Inspection) is being moved
    if (oldIndex === allSortableItems.length - 1) {
      console.log('❌ Cannot reorder the Inspection task - it must remain at the end');
      return;
    }

    // Prevent moving any task to the last position (where Inspection should be)
    if (newIndex === allSortableItems.length - 1) {
      console.log('❌ Cannot move task to the last position - Inspection task must remain at the end');
      return;
    }

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const reorderedItems = arrayMove(allSortableItems, oldIndex, newIndex);
      setAllSortableItems(reorderedItems);

      // Create new task order based on the reordered blocks
      const newTasksOrder = [];

      reorderedItems.forEach(item => {
        // Add all tasks from this block in their original order within the block
        item.tasks.forEach(task => {
          newTasksOrder.push(task);
        });
      });

      // Update the main tasks array with the new order
      // This will trigger a re-render of the GraphicalTaskFlow component
      setTasks(newTasksOrder);

      // Notify parent component of order change with block information
      if (onOrderChange) {
        // Create block order information
        const blockOrder = reorderedItems.map(item => {
          if (item.type === 'group') {
            // For dependency groups, use the group name or first task name
            const groupName = groupNames[item.tasks[0].name] || item.tasks[0].name;
            return {
              type: 'group',
              name: groupName,
              tasks: item.tasks.map(t => t.name)
            };
          } else {
            // For independent tasks, use the task name
            return {
              type: 'independent',
              name: item.tasks[0].name,
              tasks: [item.tasks[0].name]
            };
          }
        });

        onOrderChange(newTasksOrder, blockOrder);
      }

      // Debug: Log the reordering
      console.log('Tasks reordered:', newTasksOrder.map(t => t.name));
      console.log('Block order:', reorderedItems.map(item => {
        if (item.type === 'group') {
          return groupNames[item.tasks[0].name] || item.tasks[0].name;
        } else {
          return item.tasks[0].name;
        }
      }));
      console.log('New task order IDs:', newTasksOrder.map(t => t.id));
    }
  };

  // Create sortable items from unified list
  const sortableItems = allSortableItems.map(item => {
    if (item.type === 'group') {
      return `group-${item.tasks.map(t => t.name).join('-')}`;
    } else {
      return `task-${item.tasks[0].id}`;
    }
  });

  return (
    <div className="sequence-view">
      <h3>Task Allocation</h3>
      <div className="allocation-legend">
        {/* <strong>0 = Human ———— 10 = Robot</strong> */}
      </div>
      {editable && (
        <div style={{
          fontSize: "0.7vw",
          color: "#666",
          marginBottom: "0.3vw",
          fontStyle: "italic"
        }}>
          Allocate tasks to human or robot using the sliders below
        </div>
      )}
      {!editable && robotStarted && (
        <div style={{ 
          fontSize: "0.7vw", 
          color: "#ff6b6b", 
          marginBottom: "0.3vw",
          fontStyle: "italic"
        }}>
          Order locked - robot has started
        </div>
      )}
      {!editable && !robotStarted && (
        <div style={{ 
          fontSize: "0.7vw", 
          color: "#ff6b6b", 
          marginBottom: "0.3vw",
          fontStyle: "italic"
        }}>
          Click 'Apply' to continue
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableItems}
          strategy={verticalListSortingStrategy}
        >
          {/* Render all sortable items */}
          {allSortableItems.map((item, index) => {
            const isLastTask = index === allSortableItems.length - 1;
            if (item.type === 'group') {
              return (
                <SortableDependencyGroup
                  key={`group-${item.tasks.map(t => t.name).join('-')}`}
                  group={item.tasks.map(t => t.name)}
                  tasks={tasks}
                  updateTaskRole={updateTaskRole}
                  editable={editable}
                  groupNames={groupNames}
                  isLastTask={isLastTask}
                  slidersLocked={slidersLocked}
                />
              );
            } else {
              return (
                <SortableIndependentTask
                  key={`task-${item.tasks[0].id}`}
                  task={item.tasks[0]}
                  updateTaskRole={updateTaskRole}
                  editable={editable}
                  groupNames={groupNames}
                  isLastTask={isLastTask}
                  slidersLocked={slidersLocked}
                />
              );
            }
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default TaskSequenceView;
