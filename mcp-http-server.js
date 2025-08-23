const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();

// CORS configuration for MCP
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from Claude Code and other MCP clients
    if (!origin || origin.includes('localhost') || origin.includes('claude')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, implement proper validation later
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'MCP-Protocol-Version', 'Mcp-Session-Id', 'Authorization', 'Origin']
}));

app.use(express.json());

// In-memory database
let projects = [];
let tasks = [];

// Tool definitions
const tools = [
  {
    name: "list_projects",
    description: "List all projects, optionally filtered by status",
    inputSchema: {
      type: "object",
      properties: {
        status: { 
          type: "string", 
          enum: ["todo", "in_progress", "done", "all"],
          description: "Filter projects by status" 
        }
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
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Project description" },
        status: { 
          type: "string", 
          enum: ["todo", "in_progress", "done"],
          default: "todo",
          description: "Project status"
        },
        priority: { 
          type: "string", 
          enum: ["low", "medium", "high", "urgent"],
          default: "medium",
          description: "Project priority"
        }
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
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        project_id: { type: "string", description: "ID of the project this task belongs to" },
        status: { 
          type: "string", 
          enum: ["todo", "in_progress", "done"],
          default: "todo",
          description: "Task status"
        },
        priority: { 
          type: "string", 
          enum: ["low", "medium", "high", "urgent"],
          default: "medium",
          description: "Task priority"
        }
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
        status: { 
          type: "string", 
          enum: ["todo", "in_progress", "done", "all"],
          description: "Filter tasks by status"
        }
      }
    }
  },
  {
    name: "update_task",
    description: "Update an existing task",
    inputSchema: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string", description: "ID of the task to update" },
        title: { type: "string", description: "New task title" },
        description: { type: "string", description: "New task description" },
        status: { 
          type: "string", 
          enum: ["todo", "in_progress", "done"],
          description: "New task status"
        },
        priority: { 
          type: "string", 
          enum: ["low", "medium", "high", "urgent"],
          description: "New task priority"
        }
      }
    }
  },
  {
    name: "delete_task",
    description: "Delete a task",
    inputSchema: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string", description: "ID of the task to delete" }
      }
    }
  },
  {
    name: "update_project",
    description: "Update an existing project",
    inputSchema: {
      type: "object",
      required: ["project_id"],
      properties: {
        project_id: { type: "string", description: "ID of the project to update" },
        name: { type: "string", description: "New project name" },
        description: { type: "string", description: "New project description" },
        status: { 
          type: "string", 
          enum: ["todo", "in_progress", "done"],
          description: "New project status"
        },
        priority: { 
          type: "string", 
          enum: ["low", "medium", "high", "urgent"],
          description: "New project priority"
        }
      }
    }
  },
  {
    name: "delete_project",
    description: "Delete a project and all its tasks",
    inputSchema: {
      type: "object",
      required: ["project_id"],
      properties: {
        project_id: { type: "string", description: "ID of the project to delete" }
      }
    }
  }
];

// Tool execution
function executeTool(name, args = {}) {
  switch (name) {
    case "list_projects":
      let filteredProjects = projects;
      if (args.status && args.status !== "all") {
        filteredProjects = projects.filter(p => p.status === args.status);
      }
      return `Projects (${filteredProjects.length}):\n${JSON.stringify(filteredProjects, null, 2)}`;

    case "create_project":
      const newProject = {
        id: uuidv4(),
        name: args.name,
        description: args.description || "",
        status: args.status || "todo",
        priority: args.priority || "medium",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      projects.push(newProject);
      return `✅ Created project: "${newProject.name}" (${newProject.id})\nStatus: ${newProject.status} | Priority: ${newProject.priority}`;

    case "create_task":
      const project = projects.find(p => p.id === args.project_id);
      if (!project) {
        throw new Error(`Project not found: ${args.project_id}`);
      }
      
      const newTask = {
        id: uuidv4(),
        title: args.title,
        description: args.description || "",
        project_id: args.project_id,
        status: args.status || "todo",
        priority: args.priority || "medium",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      tasks.push(newTask);
      return `✅ Created task: "${newTask.title}" in project "${project.name}"\nStatus: ${newTask.status} | Priority: ${newTask.priority}`;

    case "list_tasks":
      let filteredTasks = tasks;
      if (args.project_id) {
        filteredTasks = tasks.filter(t => t.project_id === args.project_id);
      }
      if (args.status && args.status !== "all") {
        filteredTasks = filteredTasks.filter(t => t.status === args.status);
      }
      return `Tasks (${filteredTasks.length}):\n${JSON.stringify(filteredTasks, null, 2)}`;

    case "update_task":
      const taskIndex = tasks.findIndex(t => t.id === args.task_id);
      if (taskIndex === -1) {
        throw new Error(`Task not found: ${args.task_id}`);
      }
      
      // Update only provided fields
      if (args.title !== undefined) tasks[taskIndex].title = args.title;
      if (args.description !== undefined) tasks[taskIndex].description = args.description;
      if (args.status !== undefined) tasks[taskIndex].status = args.status;
      if (args.priority !== undefined) tasks[taskIndex].priority = args.priority;
      tasks[taskIndex].updated_at = new Date().toISOString();
      
      return `✅ Updated task: "${tasks[taskIndex].title}"\nStatus: ${tasks[taskIndex].status} | Priority: ${tasks[taskIndex].priority}`;

    case "delete_task":
      const taskToDelete = tasks.find(t => t.id === args.task_id);
      if (!taskToDelete) {
        throw new Error(`Task not found: ${args.task_id}`);
      }
      
      tasks = tasks.filter(t => t.id !== args.task_id);
      return `🗑️ Deleted task: "${taskToDelete.title}"`;

    case "update_project":
      const projectIndex = projects.findIndex(p => p.id === args.project_id);
      if (projectIndex === -1) {
        throw new Error(`Project not found: ${args.project_id}`);
      }
      
      // Update only provided fields
      if (args.name !== undefined) projects[projectIndex].name = args.name;
      if (args.description !== undefined) projects[projectIndex].description = args.description;
      if (args.status !== undefined) projects[projectIndex].status = args.status;
      if (args.priority !== undefined) projects[projectIndex].priority = args.priority;
      projects[projectIndex].updated_at = new Date().toISOString();
      
      return `✅ Updated project: "${projects[projectIndex].name}"\nStatus: ${projects[projectIndex].status} | Priority: ${projects[projectIndex].priority}`;

    case "delete_project":
      const projectToDelete = projects.find(p => p.id === args.project_id);
      if (!projectToDelete) {
        throw new Error(`Project not found: ${args.project_id}`);
      }
      
      // Delete all tasks associated with the project
      const deletedTasksCount = tasks.filter(t => t.project_id === args.project_id).length;
      tasks = tasks.filter(t => t.project_id !== args.project_id);
      projects = projects.filter(p => p.id !== args.project_id);
      
      return `🗑️ Deleted project: "${projectToDelete.name}" and ${deletedTasksCount} associated tasks`;

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Global session state
let sessions = new Map();

// MCP HTTP Transport Endpoint
app.all('/mcp', (req, res) => {
  const protocolVersion = '2024-11-05';
  
  // Set required MCP headers
  res.setHeader('MCP-Protocol-Version', protocolVersion);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Authorization, Origin');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    try {
      const message = req.body;
      console.log('Received MCP message:', JSON.stringify(message, null, 2));
      
      // Validate JSON-RPC format
      if (!message.jsonrpc || message.jsonrpc !== '2.0') {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: message.id || null,
          error: {
            code: -32600,
            message: 'Invalid Request - missing or invalid jsonrpc version'
          }
        });
      }
      
      let response;
      
      switch (message.method) {
        case 'initialize':
          const sessionId = uuidv4();
          sessions.set(sessionId, {
            capabilities: message.params?.capabilities || {},
            clientInfo: message.params?.clientInfo || {}
          });
          
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: protocolVersion,
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'task-manager',
                version: '1.0.0'
              }
            }
          };
          
          // Set session header for future requests
          res.setHeader('Mcp-Session-Id', sessionId);
          break;
          
        case 'tools/list':
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: tools
            }
          };
          break;
          
        case 'tools/call':
          const { name, arguments: args } = message.params;
          const result = executeTool(name, args);
          
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [{
                type: 'text',
                text: result
              }]
            }
          };
          break;
          
        case 'notifications/initialized':
          // Client finished initializing, send 202 for notifications
          return res.status(202).end();
          
        default:
          response = {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`
            }
          };
      }
      
      console.log('Sending MCP response:', JSON.stringify(response, null, 2));
      res.json(response);
      
    } catch (error) {
      console.error('MCP Error:', error);
      const errorResponse = {
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: error.message
        }
      };
      res.status(500).json(errorResponse);
    }
    
  } else if (req.method === 'GET') {
    // Server-Sent Events endpoint
    const accept = req.headers.accept;
    
    if (accept && accept.includes('text/event-stream')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'MCP-Protocol-Version': protocolVersion
      });
      
      // Send initial connection event
      res.write(`data: ${JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated'
      })}\n\n`);
      
      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }, 30000);
      
      // Clean up on close
      req.on('close', () => {
        clearInterval(heartbeat);
        console.log('SSE client disconnected');
      });
      
    } else {
      res.status(400).json({
        error: 'Bad Request - Accept header must include text/event-stream for GET requests'
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    projects_count: projects.length,
    tasks_count: tasks.length,
    sessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint for server info
app.get('/', (req, res) => {
  res.json({
    name: 'MCP Task Manager Server',
    version: '1.0.0',
    protocol: 'MCP 2024-11-05',
    transport: 'HTTP with SSE',
    endpoints: {
      mcp: '/mcp',
      health: '/health'
    },
    tools: tools.map(t => ({ name: t.name, description: t.description }))
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 MCP HTTP Server running on port ${port}`);
  console.log(`📊 Projects: ${projects.length} | Tasks: ${tasks.length}`);
  console.log(`🔗 MCP endpoint: ${port === 3000 ? `http://localhost:${port}` : 'Railway deployment'}/mcp`);
  console.log(`💡 Protocol: MCP 2024-11-05 with HTTP+SSE transport`);
});