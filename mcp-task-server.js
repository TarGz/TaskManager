// MCP Task Server for Replit
// A simple but powerful task management server that works with Claude Code

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory database (Replit will persist this)
let tasks = [];
let lastModified = new Date().toISOString();

// Load tasks from Replit DB if available
if (process.env.REPLIT_DB_URL) {
  const Database = require("@replit/database");
  const db = new Database();
  
  // Load tasks on startup
  db.get("tasks").then(value => {
    if (value) tasks = JSON.parse(value);
    console.log(`Loaded ${tasks.length} tasks from database`);
  });
  
  // Save tasks function
  const saveTasks = () => {
    db.set("tasks", JSON.stringify(tasks));
    lastModified = new Date().toISOString();
  };
  
  // Auto-save every change
  const originalPush = tasks.push;
  tasks.push = function(...args) {
    const result = originalPush.apply(this, args);
    saveTasks();
    return result;
  };
}

// MCP Protocol Implementation
app.get('/', (req, res) => {
  res.json({
    name: "MCP Task Server",
    version: "1.0.0",
    description: "Personal task management with MCP protocol support",
    tools: [
      {
        name: "list_tasks",
        description: "List all tasks with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["todo", "in_progress", "done", "all"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent", "all"] }
          }
        }
      },
      {
        name: "create_task",
        description: "Create a new task",
        inputSchema: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "in_progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            due_date: { type: "string", format: "date" },
            tags: { type: "array", items: { type: "string" } },
            parent_id: { type: "string" }
          }
        }
      },
      {
        name: "update_task",
        description: "Update an existing task",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "in_progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            due_date: { type: "string", format: "date" },
            tags: { type: "array", items: { type: "string" } }
          }
        }
      },
      {
        name: "delete_task",
        description: "Delete a task",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" }
          }
        }
      },
      {
        name: "get_task",
        description: "Get a specific task by ID",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" }
          }
        }
      }
    ]
  });
});

// MCP Tool Endpoints
app.post('/tools/:toolName', (req, res) => {
  const { toolName } = req.params;
  const args = req.body.arguments || req.body;
  
  switch(toolName) {
    case 'list_tasks':
      handleListTasks(args, res);
      break;
    case 'create_task':
      handleCreateTask(args, res);
      break;
    case 'update_task':
      handleUpdateTask(args, res);
      break;
    case 'delete_task':
      handleDeleteTask(args, res);
      break;
    case 'get_task':
      handleGetTask(args, res);
      break;
    default:
      res.status(404).json({ error: `Unknown tool: ${toolName}` });
  }
});

// Tool Handlers
function handleListTasks(args, res) {
  let filtered = [...tasks];
  
  if (args.status && args.status !== 'all') {
    filtered = filtered.filter(t => t.status === args.status);
  }
  
  if (args.priority && args.priority !== 'all') {
    filtered = filtered.filter(t => t.priority === args.priority);
  }
  
  // Sort by priority and due date
  filtered.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (a.priority !== b.priority) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    return 0;
  });
  
  res.json({
    content: [{
      type: "text",
      text: `Found ${filtered.length} tasks`
    }],
    tasks: filtered,
    total: filtered.length,
    lastModified
  });
}

function handleCreateTask(args, res) {
  const newTask = {
    id: uuidv4(),
    title: args.title,
    description: args.description || '',
    status: args.status || 'todo',
    priority: args.priority || 'medium',
    due_date: args.due_date || null,
    tags: args.tags || [],
    parent_id: args.parent_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subtasks: []
  };
  
  tasks.push(newTask);
  
  // If this is a subtask, add it to parent's subtasks array
  if (args.parent_id) {
    const parent = tasks.find(t => t.id === args.parent_id);
    if (parent) {
      parent.subtasks.push(newTask.id);
    }
  }
  
  saveTasks();
  
  res.json({
    content: [{
      type: "text",
      text: `✅ Created task: ${newTask.title}`
    }],
    task: newTask
  });
}

function handleUpdateTask(args, res) {
  const taskIndex = tasks.findIndex(t => t.id === args.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  const task = tasks[taskIndex];
  
  // Update only provided fields
  if (args.title !== undefined) task.title = args.title;
  if (args.description !== undefined) task.description = args.description;
  if (args.status !== undefined) task.status = args.status;
  if (args.priority !== undefined) task.priority = args.priority;
  if (args.due_date !== undefined) task.due_date = args.due_date;
  if (args.tags !== undefined) task.tags = args.tags;
  
  task.updated_at = new Date().toISOString();
  
  saveTasks();
  
  res.json({
    content: [{
      type: "text",
      text: `✅ Updated task: ${task.title}`
    }],
    task
  });
}

function handleDeleteTask(args, res) {
  const taskIndex = tasks.findIndex(t => t.id === args.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  const deletedTask = tasks.splice(taskIndex, 1)[0];
  
  // Remove from parent's subtasks if it's a subtask
  if (deletedTask.parent_id) {
    const parent = tasks.find(t => t.id === deletedTask.parent_id);
    if (parent) {
      parent.subtasks = parent.subtasks.filter(id => id !== deletedTask.id);
    }
  }
  
  saveTasks();
  
  res.json({
    content: [{
      type: "text",
      text: `🗑️ Deleted task: ${deletedTask.title}`
    }],
    deleted: deletedTask
  });
}

function handleGetTask(args, res) {
  const task = tasks.find(t => t.id === args.id);
  
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  // Get subtasks if any
  const subtasks = task.subtasks.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  
  res.json({
    content: [{
      type: "text",
      text: `Task: ${task.title}`
    }],
    task: { ...task, subtasks }
  });
}

// REST API Endpoints (for web/mobile access)
app.get('/api/tasks', (req, res) => {
  res.json({ tasks, lastModified });
});

app.post('/api/tasks', (req, res) => {
  handleCreateTask(req.body, res);
});

app.put('/api/tasks/:id', (req, res) => {
  handleUpdateTask({ ...req.body, id: req.params.id }, res);
});

app.delete('/api/tasks/:id', (req, res) => {
  handleDeleteTask({ id: req.params.id }, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    tasks_count: tasks.length,
    last_modified: lastModified
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP Task Server running on port ${PORT}`);
  console.log(`📝 Currently managing ${tasks.length} tasks`);
  console.log(`🔗 Your server URL will be: https://<your-repl-name>.<your-username>.repl.co`);
});

// Graceful shutdown
const saveTasks = () => {
  if (process.env.REPLIT_DB_URL) {
    const Database = require("@replit/database");
    const db = new Database();
    db.set("tasks", JSON.stringify(tasks));
  }
};

process.on('SIGTERM', () => {
  saveTasks();
  process.exit(0);
});