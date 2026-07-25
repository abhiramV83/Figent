# Figent
### *Autonomous Multi-Agent Code Review & Remediation Orchestrator*

Figent is a state-of-the-art, autonomous code review platform powered by cooperative AI agents built on **FastAPI**, **LangGraph**, and **React**. It doesn't just report issues—it synthesizes code fixes and drafts ready-to-merge **Pull Requests** or detailed **Issues** directly on GitHub, complete with an interactive, context-aware code-review chatbot.

---

## System Architecture & Workflow

Figent organizes specialized AI agents into a sequential, coordinated pipeline using **LangGraph** to process codebase checkouts:

```mermaid
graph TD
    A[Start: Git Repository URL] --> B[Orchestrator Node]
    B -->|Clones Repo & Runs Radon/Bandit| C[Quality Agent]
    C -->|Analyzes Code Quality & Complexity| D[Security Agent]
    D -->|Identifies Security Vulnerabilities| E[Performance Agent]
    E -->|Checks Performance Bottlenecks| F[Synthesizer Node]
    F -->|Deduplicates & Generates Patches| G[PR Agent]
    G -->|High Confidence PR / Medium-Low Issue| H[End: Complete & Ready for Chat]
```

### The Multi-Agent Squad:
1. **Orchestrator**: Clones the target repository to a temporary directory, retrieves the list of supported source code files, and applies initial static analysis tools (e.g., Radon for complexity metrics, Bandit for security checking).
2. **Quality Agent**: Reviews function logic, checks naming conventions, searches for code duplication, ensures comprehensive error-handling patterns, and flags structural issues.
3. **Security Agent**: Scans for common vulnerabilities, including hardcoded secrets/API keys, SQL injection risks, command injection vectors, broken authentication patterns, and exposed sensitive data.
4. **Performance Agent**: Checks for algorithmic inefficiencies (e.g., nested loops), database N+1 query patterns, blocking I/O calls, and large object allocations in hot paths.
5. **Synthesizer Node**: Gathers findings from all upstream agents, clusters overlapping reports by file and line proximity, filters duplicates, ranks them by severity, and generates concrete git-diff code fixes.
6. **PR Agent**: Evaluates the synthesized fixes and automatically opens either **Pull Requests** (for high-confidence critical or high severity findings) or **Issues** (for medium/low findings) in the target GitHub repository.

---

## Core Features

- **Real-Time Analysis Cancellation**: Stop the pipeline at any point during the run via WebSocket or REST. Any findings processed by agents that completed before the stop command are safely retained and written to the database, allowing you to review intermediate progress.
- **Interactive Chat Assistant**: Chat directly with an AI assistant that has access to the full repository analysis results. Ask it questions about specific files, request alternative fixes, or seek explanations.
- **Secure Email Verification (OTP)**: Secure registration flow and password recovery utilizing 6-digit One-Time Passwords (OTP) delivered asynchronously over SMTP.
- **Modern Responsive UI**: Premium glassmorphism design system customized with Outfit/Plus Jakarta Sans typography and an Olive & Sand theme.

---

## Tech Stack

- **Backend**: Python 3.12, FastAPI (Async WebSockets + REST API), LangGraph, LangChain Core, SQLAlchemy (ORM)
- **Database**: PostgreSQL (Neon database integration with connection pooling)
- **Static Analysis Tools**: Radon (Complexity analysis), Bandit (Security checking)
- **Frontend**: React (Vite-powered, TailwindCSS styling)
- **Authentication**: JWT/Bearer token sessions, Secure Hash Verification (PBKDF2-HMAC-SHA256)

---

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL database
- GitHub Personal Access Token (with repository write scopes)
- Groq API Key (or alternative LLM API token)

### Backend Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/abhiramV83/Figent.git
   cd Figent
   ```
2. Set up a virtual environment and install dependencies:
   ```bash
   python -m venv backend/venv
   # Windows:
   .\backend\venv\Scripts\activate
   # macOS/Linux:
   source backend/venv/bin/activate
   
   pip install -r backend/requirements.txt
   ```
3. Create your environment configuration file named `.env` in the root folder with the following variables:
   ```env
   GROQ_API_KEY=your_groq_api_key
   GITHUB_TOKEN=your_github_personal_access_token
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_sender_email@gmail.com
   SMTP_PASSWORD=your_sender_email_app_password
   SMTP_FROM=your_sender_email@gmail.com
   FRONTEND_URL=http://localhost:5173
   ```

4. Run the API server:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

### Frontend Installation
1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
   *The application will launch at `http://localhost:5173`.*

---

## Security Policy
All automatic remediations operate strictly in branch isolation. PRs are created on a separate fork if direct push access to the repository is unavailable.
