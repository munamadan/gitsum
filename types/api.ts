import { AnalysisResult, JobStatus } from './index';

export interface AnalyzeRequest {
  repoUrl: string;
  os?: 'windows' | 'macos' | 'linux' | 'all';
  geminiKey?: string;
  githubToken?: string;
}

export interface AnalyzeResponseComplete {
  status: 'complete';
  result: AnalysisResult;
  usingUserKey: boolean;
}

export interface AnalyzeResponseQueued {
  status: 'queued';
  jobId: string;
  pollUrl: string;
  estimatedTime: string;
  usingUserKey: boolean;
}

export interface AnalyzeResponseError {
  error: string;
  message: string;
  resetAt?: string;
  remainingToday?: number;
  suggestion?: string;
}

export type AnalyzeResponse = AnalyzeResponseComplete | AnalyzeResponseQueued | AnalyzeResponseError;

export interface StatusResponse {
  status: JobStatus;
  progress?: number;
  message?: string;
  result?: AnalysisResult;
  error?: string;
}

export interface QuotaResponse {
  remaining: number;
  total: number;
  resetAt: string;
  isUsingUserKey: boolean;
}

export interface LogoutResponse {
  success: boolean;
}
