# GitSum - GitHub Repository Analyzer

A web application that analyzes public GitHub repositories and generates comprehensive, OS-specific setup guides using AI-powered analysis.

## Features

- Analyze any public GitHub repository (up to 100MB)
- Generate step-by-step setup instructions tailored to user's operating system
- Provide codebase architecture summaries
- Support user-provided API keys for unlimited usage
- Secure 24-hour session management with AES-256-GCM encryption
- Real-time progress tracking for large repositories
- Completely free to operate (using free-tier services)
- Terminal Brutalist aesthetic: pure black, monospace (JetBrains Mono), high contrast

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 3
- React Hook Form + Zod
- Lucide React icons

### Backend
- Vercel Serverless Functions
- Vercel Postgres (Neon Database)
- Vercel KV (Redis)
- Gemini 3.0 Flash API
- GitHub REST API

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- A Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- (Optional) A GitHub token for higher rate limits
- A Vercel account

### Local Development

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd gitsum
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment variables template:
   ```bash
   cp .env.local.example .env.local
   ```

4. Generate an encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output to `ENCRYPTION_KEY` in `.env.local`.

5. Generate a cron secret:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output to `CRON_SECRET` in `.env.local`.

6. Update `.env.local` with your values:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key
   GITHUB_TOKEN=your_github_token (optional)
   ENCRYPTION_KEY=your_64_char_hex_key
   CRON_SECRET=your_cron_secret
   ```

7. Set up Vercel Postgres and KV (for local development, skip this step and use Vercel's managed services when deploying).

8. Run the development server:
   ```bash
   npm run dev
   ```

9. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deployment to Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket).

2. Go to [Vercel](https://vercel.com) and click "Add New Project".

3. Import your repository.

4. Add environment variables in the Vercel dashboard:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `GITHUB_TOKEN`: (Optional) Your GitHub token
   - `ENCRYPTION_KEY`: Your 64-character hex encryption key
   - `CRON_SECRET`: Your cron authentication secret

5. Add Vercel Postgres:
   - Go to the Storage tab in your project
   - Click "Create Database"
   - Select "Postgres"
   - Click "Create"

6. Add Vercel KV:
   - Go to the Storage tab in your project
   - Click "Create Database"
   - Select "KV"
   - Click "Create"

7. Run the database migration:
   ```bash
   npm run db:migrate
   ```
   Or use the Vercel CLI:
   ```bash
   vercel env pull .env.local
   node scripts/migrate.js
   ```

8. Deploy your application:
   ```bash
   vercel --prod
   ```

9. Verify cron jobs are running in the Vercel dashboard under the "Cron Jobs" tab.

## Database Schema

### user_sessions
```sql
CREATE TABLE user_sessions (
  session_id TEXT PRIMARY KEY,
  encrypted_gemini_key TEXT,
  encrypted_github_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP DEFAULT NOW()
);
```

### jobs
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  repo_url TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE SET NULL
);
```

## API Endpoints

### POST /api/analyze
Analyzes a GitHub repository.

**Request Body:**
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "os": "windows",
  "geminiKey": "optional",
  "githubToken": "optional"
}
```

**Response (Complete):**
```json
{
  "status": "complete",
  "result": {
    "projectOverview": "...",
    "prerequisites": ["...", "..."],
    "setupSteps": ["...", "..."],
    "runningInstructions": "...",
    "configuration": "...",
    "troubleshooting": "..."
  },
  "usingUserKey": false
}
```

**Response (Queued):**
```json
{
  "status": "queued",
  "jobId": "abc123",
  "pollUrl": "/api/status/abc123",
  "estimatedTime": "1-2 minutes",
  "usingUserKey": false
}
```

### GET /api/status/:jobId
Polls for job status.

### GET /api/quota
Checks remaining daily analyses.

### POST /api/logout
Clears user session.

### GET /api/cron/process (Cron Job)
Background job processor (every minute).

### GET /api/cron/cleanup-sessions (Cron Job)
Deletes expired sessions (every hour).

## Architecture

```
┌─────────────────────────────────────┐
│         User Browser                │
│  Next.js Frontend (React)           │
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│      Vercel Serverless             │
│  /api/analyze, /api/status, etc.   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         Data Storage                │
│  Postgres (sessions, jobs)          │
│  KV Redis (rate limiting, cache)    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│        External APIs                │
│  Gemini 1.5 Flash, GitHub API      │
└─────────────────────────────────────┘
```

## Security

- User API keys are encrypted with AES-256-GCM
- Session IDs are stored in httpOnly cookies
- Automatic 24-hour session expiration
- Input validation with Zod
- SQL injection prevention (parameterized queries)
- Rate limiting with Redis atomic counters
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
