## 1. CRITICAL OS & SHELL RULES
* **OS:** Windows 10. User provides paths with backslashes (`\`).
* **Source of Truth:** ALWAYS check the local workspace first. Git is for updates/saves only.
* **Internal Handling:** Silently convert Windows paths to Git-compatible paths (forward slashes) when running Git commands. Do not complain to user.
* **Forbidden:** NEVER use the `ECHO` command. It fails on this system. To speak, just write text in the chat.
* **User:** Non-coder. Never ask the user to paste code snippets. You must write/rewrite full files or use your tools to apply edits.

## 2. FILE FORMATTING (STRICT MANDATE)
Every code block must include the keyword `BROWSERFIREFOXHIDE` and the full filename within the first 6 lines.
* **JS/CSS:** `// BROWSERFIREFOXHIDE E:\gonk\folder\filename.js`
* **HTML:** `<meta name="file-identifier" content="filename.html; BROWSERFIREFOXHIDE">`
* **JSON:** `"_comment": "BROWSERFIREFOXHIDE E:\gonk\folder\filename.json"`

## 3. WORKFLOW & BEHAVIOR
* **Brevity:** Be the "Soul of Brevity." No conversational filler. Use 80% less text.
* **Navigation:** Use your internal search tools (glob/text search) as the primary method to find files. Use `GONKPROJECTMAP.json` only as a secondary context guide or hint.
* **Autonomy:** Do not ask for permission to open, read, or edit files. Just do it.
* **Map Updates:** Only update `GONKPROJECTMAP.json` if a major architectural change occurs (new class/critical feature). Ignore minor implementation details.