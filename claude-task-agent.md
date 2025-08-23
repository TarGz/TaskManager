# Claude Task Management Agent

## Agent Configuration

```yaml
name: task-manager
description: Personal task management assistant
version: 1.0.0

startup_behavior:
  on_launch: 
    - LIST_TODAY_TASKS
    - SHOW_SUMMARY
  
default_actions:
  morning: "Show today's tasks and priorities"
  evening: "Show tomorrow's tasks"
  
commands:
  - /today - Show today's tasks
  - /tomorrow - Show tomorrow's tasks  
  - /done [task] - Mark task as complete
  - /add [task] to [project] - Add new task
  - /projects - List all projects
```

## Startup Script

When the agent starts, it will automatically:

1. **List Today's Tasks** from all active projects
2. **Show Priority Items** marked as urgent or high
3. **Display Overdue Tasks** if any
4. **Suggest Next Actions** based on context

## Example Launch Output

```
📅 Today's Tasks (Saturday, Aug 23)

🔴 HIGH PRIORITY
• RoseIndigo: Debug solde mass edit

📝 REGULAR TASKS  
• RATIERES: Acheter pain dans la matinée
• RATIERES: Passer chez le boucher dans la matinée

✅ COMPLETED TODAY
• Bike tour, sunday morning 8am
• Go to sleep now

📊 Summary: 2 tasks pending, 2 completed
```

## Natural Language Understanding

The agent understands:
- "What do I have today?" 
- "Show my tasks"
- "Mark X as done"
- "Add task: [description]"
- "Tasks for tomorrow"
- "All high priority items"