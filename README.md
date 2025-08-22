# MCP Task Server

A Model Context Protocol (MCP) server for managing projects and tasks, designed to work with Claude Code and other AI assistants.

## Features

- 📁 **Project Management**: Create, update, and delete projects
- ✅ **Task Tracking**: Manage tasks within projects with status tracking
- 🔄 **Status Management**: Both projects and tasks have todo/in_progress/done states
- 🎯 **Priority Levels**: Set priorities (low/medium/high/urgent)
- 👥 **Task Assignment**: Assign tasks to team members
- 📊 **Project Analytics**: Get project summaries with completion statistics
- 🔗 **MCP Protocol**: Full MCP implementation for AI assistant integration
- 💾 **Persistent Storage**: Automatic data persistence on Replit

## Quick Deploy to Replit

1. Fork this repository to your GitHub account
2. Go to [Replit.com](https://replit.com)
3. Click "Create Repl" → "Import from GitHub"
4. Paste your forked repo URL
5. Click "Import from GitHub"
6. Once imported, click "Run"
7. Your server will be available at `https://[repl-name].[username].repl.co`

## Configure with Claude Code

```bash
claude mcp add tasks https://[your-repl-url].repl.co
```

## MCP Tools Available

### Project Management
- `list_projects` - List all projects with optional status filtering
- `create_project` - Create a new project
- `update_project` - Update project details
- `delete_project` - Delete a project (optionally with all tasks)
- `get_project_summary` - Get project statistics and recent tasks

### Task Management
- `list_tasks` - List tasks with filtering by project/status/priority
- `create_task` - Create a new task within a project
- `update_task` - Update task details
- `delete_task` - Delete a task
- `move_task` - Move task to different project

## REST API Endpoints

The server also provides REST API endpoints for web/mobile integration:

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/move` - Move task to different project

## Example Usage in Claude

```
"Create a project called Website Redesign"
"List all projects that are in progress"
"Create task 'Design homepage' in Website Redesign project"
"Mark task as done"
"Show project summary for Website Redesign"
"Move task to different project"
```

## Local Development

```bash
npm install
npm start
```

Server runs on port 3000 by default.

## Tech Stack

- Node.js + Express
- UUID for unique IDs
- CORS enabled for cross-origin requests
- Replit Database for persistence (when deployed on Replit)

## License

MIT

## Author

Created with Claude Code assistance