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
  1. **Super Admin**: Full access to read, write, and execute all content.

