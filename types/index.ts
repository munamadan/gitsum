export interface AnalysisResult {
  projectOverview: string;
  prerequisites: string[];
  setupSteps: string[];
  runningInstructions: string;
  configuration: string;
  troubleshooting: string;
  osSpecificNotes?: string;
}

export type JobStatus = 'queued' | 'processing' | 'complete' | 'failed';

export interface Job {
  id: string;
  repo_url: string;
  session_id: string | null;
  status: JobStatus;
  result: AnalysisResult | null;
  error: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export interface SessionData {
  session_id: string;
  geminiKey: string | null;
  githubToken: string | null;
  created_at: Date;
  expires_at: Date;
  last_used_at: Date;
}

export interface FileScore {
  file: any;
  score: number;
  estimatedTokens: number;
}
