const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'MCP-Protocol-Version', 'Origin']
}));
app.use(express.json());

// In-memory database
let projects = [];
let tasks = [];

// MCP Tools
const tools = [
  {
    name: "list_projects",
    description: "List all projects, optionally filtered by status",
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
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] }
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
        project_id: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "done"] },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] }
      }
    }
  },
  {
    name: "list_tasks", 
    description: "List tasks, optionally filtered by project or status",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "done", "all"] }
      }
    }
  }
];

// Tool implementations
function executeTool(name, args) {
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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// MCP HTTP Transport - Single endpoint for all MCP communication
app.all('/mcp', (req, res) => {
  // Set required headers
  res.setHeader('MCP-Protocol-Version', '2024-11-05');
  
  if (req.method === 'POST') {
    try {
      const message = req.body;
      
      // Handle different MCP message types
      if (message.method === 'initialize') {
        const response = {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "task-manager",
              version: "1.0.0"
            }
          }
        };
        res.json(response);
        
      } else if (message.method === 'tools/list') {
        const response = {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            tools: tools
          }
        };
        res.json(response);
        
      } else if (message.method === 'tools/call') {
        const { name, arguments: args } = message.params;
        const result = executeTool(name, args);
        
        const response = {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            content: [{
              type: "text",
              text: result
            }]
          }
        };
        res.json(response);
        
      } else {
        // Unknown method
        const errorResponse = {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`
          }
        };
        res.status(404).json(errorResponse);
      }
      
    } catch (error) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: req.body.id || null,
        error: {
          code: -32603,
          message: error.message
        }
      };
      res.status(500).json(errorResponse);
    }
    
  } else if (req.method === 'GET') {
    // Optional SSE support (not implemented for simplicity)
    res.status(501).json({ error: "SSE not implemented" });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    projects_count: projects.length,
    tasks_count: tasks.length,
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 MCP HTTP Server running on port ${port}`);
  console.log(`📊 Projects: ${projects.length} | Tasks: ${tasks.length}`);
  console.log(`🔗 MCP endpoint: http://localhost:${port}/mcp`);
});