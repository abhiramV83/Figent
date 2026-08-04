<div align="center">

#  Figent
### *Autonomous Multi-Agent Code Review & Remediation Orchestrator powered by LangGraph*

[![Production App](https://img.shields.io/badge/Production-figent.vercel.app-60684f?style=for-the-badge&logo=vercel)](https://figent.vercel.app)
[![API Status](https://img.shields.io/badge/API_Status-Online-4a5c2d?style=for-the-badge&logo=fastapi)](https://figent-api.onrender.com/health)
[![LangGraph](https://img.shields.io/badge/Orchestrator-LangGraph-2c3024?style=for-the-badge)](https://github.com/langchain-ai/langgraph)
[![License](https://img.shields.io/badge/License-MIT-8f8b80?style=for-the-badge)](LICENSE)

---

**Figent** is a state-of-the-art, autonomous code review platform powered by cooperative AI agents built on **FastAPI**, **LangGraph**, and **React**. It doesn't just surface bugs—it synthesizes concrete git-diff patches, opens ready-to-merge **Pull Requests** or detailed **Issues** directly on GitHub, generates **PDF Reports**, and provides a context-aware **AI Chat Assistant** tailored to your codebase.

[Explore Live App](https://figent.vercel.app) • [View API Docs](https://figent-api.onrender.com/docs) • [Report Issue](https://figent.vercel.app/support)

</div>

---

## 🏛️ System Architecture & Workflow

Figent coordinates specialized AI agents into a sequential, asynchronous graph using **LangGraph** to process codebase checkouts:

```mermaid
graph TD
    A[Start: Git Repository URL] --> B[Orchestrator Node]
    B -->|Clones Repo & Runs Static Analysis| C[Quality Agent]
    C -->|Analyzes Code Smells & Structure| D[Security Agent]
    D -->|Identifies Security Vulnerabilities| E[Performance Agent]
    E -->|Checks Algorithmic Complexity| F[Synthesizer Node]
    F -->|Deduplicates & Synthesizes Git-Diff Patches| G[PR Agent]
    G -->|Owner Match: Open PR / Issue| H[Complete & Ready for AI Chat]
    G -->|Third-Party Repo / Guest: Report-Only Mode| H
```

### 🤖 The Multi-Agent Squad

1. **Orchestrator Node**: Clones the target GitHub repository into an isolated workspace, retrieves supported source files, and executes initial static analysis tools (*Radon* for complexity metrics, *Bandit* for security scans).
2. **Quality Agent**: Evaluates structural logic, naming conventions, error-handling completeness, function length, and structural maintainability.
3. **Security Agent**: Scans for OWASP Top 10 vulnerabilities, including hardcoded secrets/API keys, SQL injection vectors, command execution risks, and broken authentication patterns.
4. **Performance Agent**: Detects algorithmic bottlenecks (e.g., nested loops), database N+1 query patterns, blocking I/O calls on main threads, and excessive memory allocations.
5. **Synthesizer Node**: Deduplicates findings across all upstream agents, computes confidence scores, ranks severity levels, and generates precise `git-diff` code remediations.
6. **PR & Issue Agent**: Automatically opens ready-to-merge **Pull Requests** (for high-confidence critical/high findings) or **Issues** (for medium/low findings). *Bypassed automatically in Report-Only mode for non-owned repositories or guest sessions.*

---

## ✨ Core Features

- ⚡ **LangGraph Asynchronous Task Management**: Execution runs detached on the server via background queues. Closing your browser will not interrupt active audits—reopening the page instantly reconnects and streams progress logs.
- 🛡️ **Responsible AI Security Boundary**: Protects repository owners. Full analysis runs on any public repository, but active code mutations (PRs & Issues) are restricted strictly to repositories owned by the signed-in GitHub user.
- 📄 **One-Click PDF Report Export**: Export complete, beautifully styled analysis reports to crisp paginated PDF documents directly from your browser.
- 💬 **Context-Aware AI Assistant**: Chat with an AI assistant initialized with full repository audit data. Ask questions about specific files, request alternative implementations, or copy generated code snippets with interactive copy buttons.
- ⏱️ **Indian Standard Time (IST) & Email Alerts**: Receive asynchronous, beautifully formatted HTML email notifications upon user sign-in and audit completion (with timestamps converted to IST).
- 🔍 **History Dashboard Search**: Filter past repository code audits in real time by repository name or branch.
- 🔒 **Cryptographic Authentication**: Powered by PBKDF2-HMAC-SHA256 password hashing, 6-digit email verification OTPs, and seamless GitHub OAuth 2.0 single sign-on.

---

## 🔤 Supported Languages

| Language | Extension | Static Tools | Deep LLM Multi-Agent Analysis |
| :--- | :---: | :---: | :---: |
| **Python** | `.py` | Radon & Bandit | Yes (Specialized Agents) |
| **JavaScript** | `.js` | Syntax Tree | Yes |
| **TypeScript** | `.ts` | Syntax Tree | Yes |
| **Java** | `.java` | File AST | Yes |
| **Go** | `.go` | AST Parser | Yes |
| **Shell Script** | `.sh` | Parser | Yes |
| **Rust** | `.rs` | AST Parser | Yes |

---

## 💻 Tech Stack

- **Backend**: Python 3.12, FastAPI (Async WebSockets + REST API), LangGraph, LangChain, SQLAlchemy (ORM), PyGithub, Pydantic v2
- **Database**: PostgreSQL (Neon Serverless PostgreSQL integration)
- **Frontend**: React 18, Vite, React Router v6, Axios, html2pdf.js, Lucide Icons
- **Styling Tokens**: Figent Visual Design System (Signature Olive Green & Warm Sand palette, Glassmorphism, Inter typography)
- **Deployment**: Vercel (Frontend), Render (Backend API Service)

---

## 🚀 Getting Started

### Prerequisites
- **Python**: 3.12+
- **Node.js**: 18+
- **Database**: PostgreSQL instance
- **GitHub PAT**: Personal Access Token (with repo scope for PR generation)
- **Groq API Key**: (or alternative LangChain-supported LLM provider)

---

### 1. Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/abhiramV83/Figent.git
   cd Figent
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   
   # Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   
   # Linux / macOS:
   source venv/bin/activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. Configure your `.env` file in the root directory:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key
   GITHUB_TOKEN=ghp_your_github_token
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   FRONTEND_URL=http://localhost:5173
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   SMTP_FROM=your_email@gmail.com
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

5. Launch the backend API server:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
   *API will be active at `http://localhost:8000` (Swagger UI at `/docs`).*

---

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure `.env.local` for local development:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_WS_URL=ws://localhost:8000
   VITE_GITHUB_CLIENT_ID=your_github_client_id
   ```

4. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   *App will launch at `http://localhost:5173`.*

---

## 🛡️ Security & Privacy Policy

- **Branch Isolation**: All auto-fix Pull Requests are created in isolated git branches (`figent/fix-...`).
- **Owner Permissions**: Active GitHub PR/Issue creation is restricted to repositories owned by the authenticated user.
- **Third-Party Audits**: External repositories are strictly audited in **Report-Only Mode**.
- **Secret Protection**: `.env` and database files are strictly gitignored to protect API keys and tokens.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">

Made with ❤️ by [Abhiram](https://github.com/abhiramV83)

</div>
