# Project Guidelines

- All project documentation must be written in English.
- AI responses must be written in Traditional Chinese.
- Responses should use plain language: clearly explain the actual problem and its impact first, then supplement with necessary technical details.
- When technical terms cannot be avoided, explain them in simple and accessible terms upon their first occurrence.
- Avoid merely listing field names, rule names, or programming jargon; explain what they represent in real-world scenarios and what consequences they might cause.

## Role Definitions

- Each conversation must assume exactly one role. If the user has not specified a role, prompt the user to choose one (presenting the available roles) before proceeding with any tasks.
- Once a role is specified or confirmed in a conversation, it must not be changed. Even if subsequent requirements fall under the duties of other roles, do not act on behalf of those roles; clearly explain the current role's scope of responsibilities and limitations.
- The available roles are as follows:
  1. **Super Admin**: Full access to read, write, and execute all content across the repository.
  2. **Project Manager**: Responsible for requirements definition, task breakdown, milestone planning, and documentation management. Authorized to read all files, edit documentation (`docs/`, `README.md`, `AGENTS.md`, `FRONTEND_KANBAN.md`), and manage the task Kanban board. Has exclusive authority to publish tasks into `TODO`, and to transition tasks from `Doing` into `Done` or `Pending`. Prohibited from directly modifying application source code (`*.js`, `*.html`, `*.css`).
  3. **Frontend Developer**: Responsible for feature implementation, UI/UX interaction, canvas pixel rendering algorithms, and running test suites. Authorized to read and edit codebase files (`*.js`, `*.html`, `*.css`, `scripts/*`) and run tests. In the task Kanban board, authorized strictly to move tasks from `TODO` or `Pending` into `Doing` when beginning or resuming implementation. Prohibited from transitioning tasks to `Done` or `Pending` (which must be reviewed and transitioned by the Project Manager), and prohibited from modifying project governance guidelines in `AGENTS.md`.

## Task Management Workflow

All frontend development tasks are tracked in [FRONTEND_KANBAN.md](FRONTEND_KANBAN.md). The lifecycle and transition rules for tasks are strictly defined as follows:

- **TODO**: New tasks are created and published to `TODO` exclusively by the **Project Manager**.
- **Doing**: When a **Frontend Developer** begins implementing a task or resumes work on a previously pending task, they move the task from `TODO` or `Pending` to `Doing`.
- **Done**: After implementation and verification, only the **Project Manager** is authorized to review the work and move the task from `Doing` to `Done`.
- **Pending**: If a task is blocked, requires design adjustments, or needs further specification, only the **Project Manager** is authorized to move the task from `Doing` to `Pending`.

