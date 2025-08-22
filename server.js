#!/usr/bin/env node

// Hybrid MCP Server - Works both locally (stdio) and hosted (HTTP)
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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
    name: "list_tasks",
    description: "List tasks, optionally filtered by project or status", 
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "done", "all"] }
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
  }
];

// Tool handler function
function handleTool(name, args) {
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

    case "list_tasks":
      let filteredTasks = tasks;
      if (args.project_id) {
        filteredTasks = tasks.filter(t => t.project_id === args.project_id);
      }
      if (args.status && args.status !== "all") {
        filteredTasks = filteredTasks.filter(t => t.status === args.status);
      }
      return `Tasks (${filteredTasks.length}):\n${JSON.stringify(filteredTasks, null, 2)}`;

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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Check if running in stdio mode (Claude Code) or HTTP mode (Railway)
const isStdio = process.argv.includes('--stdio') || process.stdin.isTTY === false;

if (isStdio) {
  // MCP stdio mode for Claude Code
  const server = new Server({
    name: 'task-manager',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = handleTool(name, args);
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  });

  async function runMCPServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Task Manager MCP server running on stdio");
  }

  runMCPServer().catch(console.error);

} else {
  // HTTP mode for Railway hosting
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      projects_count: projects.length,
      tasks_count: tasks.length,
      timestamp: new Date().toISOString()
    });
  });

  // MCP endpoints for hosted version
  app.get('/tools/list', (req, res) => {
    res.json({ tools });
  });

  app.post('/tools/call', (req, res) => {
    try {
      const { name, arguments: args } = req.body;
      const result = handleTool(name, args);
      res.json({
        content: [{
          type: "text",
          text: result
        }]
      });
    } catch (error) {
      res.status(400).json({
        error: error.message
      });
    }
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Task Manager HTTP server running on port ${port}`);
    console.log(`📊 Projects: ${projects.length} | Tasks: ${tasks.length}`);
  });
}