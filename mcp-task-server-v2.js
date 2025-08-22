// MCP Task Server v2 - With Projects Support
// Projects contain tasks, both have status tracking

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory database (Replit will persist this)
let projects = [];
let tasks = [];
let lastModified = new Date().toISOString();

// Load data from Replit DB if available
if (process.env.REPLIT_DB_URL) {
  const Database = require("@replit/database");
  const db = new Database();
  
  // Load data on startup
  Promise.all([
    db.get("projects").then(value => {
      if (value) projects = JSON.parse(value);
      console.log(`Loaded ${projects.length} projects from database`);
    }),
    db.get("tasks").then(value => {
      if (value) tasks = JSON.parse(value);
      console.log(`Loaded ${tasks.length} tasks from database`);
    })
  ]);
  
  // Save functions
  const saveProjects = () => {
    db.set("projects", JSON.stringify(projects));
    lastModified = new Date().toISOString();
  };
  
  const saveTasks = () => {
    db.set("tasks", JSON.stringify(tasks));
    lastModified = new Date().toISOString();
  };
}

// MCP Protocol Implementation
app.get('/', (req, res) => {
  res.json({
    name: "MCP Task Server v2",
    version: "2.0.0",
    description: "Project and task management with MCP protocol support",
    tools: [
      {
        name: "list_projects",
        description: "List all projects with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["todo", "in_progress", "done", "all"] }
          }
        }
      },
      {
        name: "create_project",
        description: "Create a new project",
        inputSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "in_progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            due_date: { type: "string", format: "date" },
            tags: { type: "array", items: { type: "string" } }
          }
        }
      },
      {
        name: "update_project",
        description: "Update an existing project",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "in_progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            due_date: { type: "string", format: "date" },
            tags: { type: "array", items: { type: "string" } }
          }
        }
      },
      {
        name: "delete_project",
        description: "Delete a project and optionally its tasks",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            delete_tasks: { type: "boolean", description: "Also delete all tasks in this project" }
          }
        }
      },
      {
        name: "list_tasks",
        description: "List tasks, optionally filtered by project or status",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Filter by project ID" },
            status: { type: "string", enum: ["todo", "in_progress", "done", "all"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent", "all"] }
          }
        }
      },
      {
        name: "create_task",
        description: "Create a new task within a project",
        inputSchema: {
          type: "object",
          required: ["title", "project_id"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            project_id: { type: "string", description: "ID of the project this task belongs to" },
            status: { type: "string", enum: ["todo", "in_progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            due_date: { type: "string", format: "date" },
            assignee: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            parent_task_id: { type: "string", description: "ID of parent task for subtasks" }
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
            assignee: { type: "string" },
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
        name: "move_task",
        description: "Move a task to a different project",
        inputSchema: {
          type: "object",
          required: ["task_id", "new_project_id"],
          properties: {
            task_id: { type: "string" },
            new_project_id: { type: "string" }
          }
        }
      },
      {
        name: "get_project_summary",
        description: "Get a summary of a project including task statistics",
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
    case 'list_projects':
      handleListProjects(args, res);
      break;
    case 'create_project':
      handleCreateProject(args, res);
      break;
    case 'update_project':
      handleUpdateProject(args, res);
      break;
    case 'delete_project':
      handleDeleteProject(args, res);
      break;
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
    case 'move_task':
      handleMoveTask(args, res);
      break;
    case 'get_project_summary':
      handleGetProjectSummary(args, res);
      break;
    default:
      res.status(404).json({ error: `Unknown tool: ${toolName}` });
  }
});

// Project Handlers
function handleListProjects(args, res) {
  let filtered = [...projects];
  
  if (args.status && args.status !== 'all') {
    filtered = filtered.filter(p => p.status === args.status);
  }
  
  // Add task counts to each project
  const projectsWithCounts = filtered.map(project => {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    return {
      ...project,
      task_counts: {
        total: projectTasks.length,
        todo: projectTasks.filter(t => t.status === 'todo').length,
        in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
        done: projectTasks.filter(t => t.status === 'done').length
      }
    };
  });
  
  // Sort by priority and due date
  projectsWithCounts.sort((a, b) => {
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
      text: `Found ${projectsWithCounts.length} projects`
    }],
    projects: projectsWithCounts,
    total: projectsWithCounts.length,
    lastModified
  });
}

function handleCreateProject(args, res) {
  const newProject = {
    id: uuidv4(),
    name: args.name,
    description: args.description || '',
    status: args.status || 'todo',
    priority: args.priority || 'medium',
    due_date: args.due_date || null,
    tags: args.tags || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  projects.push(newProject);
  
  if (saveProjects) saveProjects();
  
  res.json({
    content: [{
      type: "text",
      text: `✅ Created project: ${newProject.name}`
    }],
    project: newProject
  });
}

function handleUpdateProject(args, res) {
  const projectIndex = projects.findIndex(p => p.id === args.id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  const project = projects[projectIndex];
  
  // Update only provided fields
  if (args.name !== undefined) project.name = args.name;
  if (args.description !== undefined) project.description = args.description;
  if (args.status !== undefined) project.status = args.status;
  if (args.priority !== undefined) project.priority = args.priority;
  if (args.due_date !== undefined) project.due_date = args.due_date;
  if (args.tags !== undefined) project.tags = args.tags;
  
  project.updated_at = new Date().toISOString();
  
  if (saveProjects) saveProjects();
  
  res.json({
    content: [{
      type: "text",
      text: `✅ Updated project: ${project.name}`
    }],
    project
  });
}

function handleDeleteProject(args, res) {
  const projectIndex = projects.findIndex(p => p.id === args.id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  const deletedProject = projects.splice(projectIndex, 1)[0];
  
  // Optionally delete all tasks in this project
  if (args.delete_tasks) {
    const deletedTasks = tasks.filter(t => t.project_id === args.id);
    tasks = tasks.filter(t => t.project_id !== args.id);
    
    if (saveTasks) saveTasks();
    
    res.json({
      content: [{
        type: "text",
        text: `🗑️ Deleted project: ${deletedProject.name} and ${deletedTasks.length} tasks`
      }],
      deleted: { project: deletedProject, tasks: deletedTasks }
    });
  } else {
    res.json({
      content: [{
        type: "text",
        text: `🗑️ Deleted project: ${deletedProject.name}`
      }],
      deleted: { project: deletedProject }
    });
  }
  
  if (saveProjects) saveProjects();
}

// Task Handlers
function handleListTasks(args, res) {
  let filtered = [...tasks];
  
  if (args.project_id) {
    filtered = filtered.filter(t => t.project_id === args.project_id);
  }
  
  if (args.status && args.status !== 'all') {
    filtered = filtered.filter(t => t.status === args.status);
  }
  
  if (args.priority && args.priority !== 'all') {
    filtered = filtered.filter(t => t.priority === args.priority);
  }
  
  // Add project names to tasks
  const tasksWithProjects = filtered.map(task => {
    const project = projects.find(p => p.id === task.project_id);
    return {
      ...task,
      project_name: project ? project.name : 'Unknown Project'
    };
  });
  
  // Sort by priority and due date
  tasksWithProjects.sort((a, b) => {
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
      text: `Found ${tasksWithProjects.length} tasks`
    }],
    tasks: tasksWithProjects,
    total: tasksWithProjects.length,
    lastModified
  });
}

function handleCreateTask(args, res) {
  // Verify project exists
  const project = projects.find(p => p.id === args.project_id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  const newTask = {
    id: uuidv4(),
    title: args.title,
    description: args.description || '',
    project_id: args.project_id,
    project_name: project.name,
    status: args.status || 'todo',
    priority: args.priority || 'medium',
    due_date: args.due_date || null,
    assignee: args.assignee || null,
    tags: args.tags || [],
    parent_task_id: args.parent_task_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subtasks: []
  };
  
  tasks.push(newTask);
  
  // If this is a subtask, add it to parent's subtasks array
  if (args.parent_task_id) {
    const parent = tasks.find(t => t.id === args.parent_task_id);
    if (parent) {
      parent.subtasks.push(newTask.id);
    }
  }
  
  if (saveTasks) saveTasks();
  
  res.json({
    content: [{
      type: "text",
      text: `✅ Created task: ${newTask.title} in project: ${project.name}`
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
  if (args.assignee !== undefined) task.assignee = args.assignee;
  if (args.tags !== undefined) task.tags = args.tags;
  
  task.updated_at = new Date().toISOString();
  
  if (saveTasks) saveTasks();
  
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
  if (deletedTask.parent_task_id) {
    const parent = tasks.find(t => t.id === deletedTask.parent_task_id);
    if (parent) {
      parent.subtasks = parent.subtasks.filter(id => id !== deletedTask.id);
    }
  }
  
  if (saveTasks) saveTasks();
  
  res.json({
    content: [{
      type: "text",
      text: `🗑️ Deleted task: ${deletedTask.title}`
    }],
    deleted: deletedTask
  });
}

function handleMoveTask(args, res) {
  const task = tasks.find(t => t.id === args.task_id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  const newProject = projects.find(p => p.id === args.new_project_id);
  if (!newProject) {
    return res.status(404).json({ error: "New project not found" });
  }
  
  const oldProjectName = task.project_name;
  task.project_id = args.new_project_id;
  task.project_name = newProject.name;
  task.updated_at = new Date().toISOString();
  
  if (saveTasks) saveTasks();
  
  res.json({
    content: [{
      type: "text",
      text: `✅ Moved task "${task.title}" from "${oldProjectName}" to "${newProject.name}"`
    }],
    task
  });
}

function handleGetProjectSummary(args, res) {
  const project = projects.find(p => p.id === args.id);
  
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  const projectTasks = tasks.filter(t => t.project_id === args.id);
  
  const summary = {
    project,
    statistics: {
      total_tasks: projectTasks.length,
      todo: projectTasks.filter(t => t.status === 'todo').length,
      in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
      done: projectTasks.filter(t => t.status === 'done').length,
      completion_percentage: projectTasks.length > 0 
        ? Math.round((projectTasks.filter(t => t.status === 'done').length / projectTasks.length) * 100)
        : 0
    },
    tasks_by_priority: {
      urgent: projectTasks.filter(t => t.priority === 'urgent').length,
      high: projectTasks.filter(t => t.priority === 'high').length,
      medium: projectTasks.filter(t => t.priority === 'medium').length,
      low: projectTasks.filter(t => t.priority === 'low').length
    },
    recent_tasks: projectTasks
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 5)
  };
  
  res.json({
    content: [{
      type: "text",
      text: `📊 Project: ${project.name} - ${summary.statistics.completion_percentage}% complete (${summary.statistics.done}/${summary.statistics.total_tasks} tasks done)`
    }],
    summary
  });
}

// REST API Endpoints (for web/mobile access)
app.get('/api/projects', (req, res) => {
  handleListProjects({ status: 'all' }, res);
});

app.post('/api/projects', (req, res) => {
  handleCreateProject(req.body, res);
});

app.get('/api/projects/:id', (req, res) => {
  handleGetProjectSummary({ id: req.params.id }, res);
});

app.put('/api/projects/:id', (req, res) => {
  handleUpdateProject({ ...req.body, id: req.params.id }, res);
});

app.delete('/api/projects/:id', (req, res) => {
  handleDeleteProject({ id: req.params.id, delete_tasks: req.query.delete_tasks === 'true' }, res);
});

app.get('/api/tasks', (req, res) => {
  handleListTasks({
    project_id: req.query.project_id,
    status: req.query.status || 'all',
    priority: req.query.priority || 'all'
  }, res);
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

app.post('/api/tasks/:id/move', (req, res) => {
  handleMoveTask({ task_id: req.params.id, new_project_id: req.body.new_project_id }, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    projects_count: projects.length,
    tasks_count: tasks.length,
    last_modified: lastModified,
    version: '2.0.0'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP Task Server v2 running on port ${PORT}`);
  console.log(`📁 Currently managing ${projects.length} projects`);
  console.log(`📝 Currently managing ${tasks.length} tasks`);
  console.log(`🔗 Your server URL will be: https://<your-repl-name>.<your-username>.repl.co`);
});

// Graceful shutdown
const saveData = () => {
  if (process.env.REPLIT_DB_URL) {
    const Database = require("@replit/database");
    const db = new Database();
    db.set("projects", JSON.stringify(projects));
    db.set("tasks", JSON.stringify(tasks));
  }
};

process.on('SIGTERM', () => {
  saveData();
  process.exit(0);
});