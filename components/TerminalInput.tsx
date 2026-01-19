'use client';

import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import SecureKeyInput from './SecureKeyInput';
import QuotaStatus from './QuotaStatus';
import ProcessMonitor from './ProcessMonitor';
import ConsoleOutput from './ConsoleOutput';
import { AnalysisResult } from '@/types';
import { Github, ChevronDown, ChevronUp, Zap, Lock, Clock, Infinity, AlertCircle } from 'lucide-react';

interface ErrorInfo {
  message: string;
  suggestion?: string;
  resetAt?: string;
  isRateLimit?: boolean;
}

export default function TerminalInput() {
  const [repoUrl, setRepoUrl] = useState('');
  const [os, setOs] = useState<'windows' | 'macos' | 'linux' | 'all'>('all');
  const [geminiKey, setGeminiKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [persistSession, setPersistSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!repoUrl) {
      setError({ message: 'Repository URL is required' });
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    setResult(null);
    setError(null);

    try {
      console.log('Submitting analysis request:', JSON.stringify({ repoUrl, os }));
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl,
          os,
          geminiKey: geminiKey || undefined,
          githubToken: githubToken || undefined,
        }),
      });

      console.log('Response status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data));

      if (!response.ok) {
        const errorInfo: ErrorInfo = {
          message: data.message || data.error || 'Analysis failed',
          suggestion: data.suggestion,
          resetAt: data.resetAt,
          isRateLimit: response.status === 429,
        };

        console.error('API Error:', JSON.stringify(errorInfo));

        // Auto-expand advanced options on rate limit
        if (errorInfo.isRateLimit) {
          setShowAdvanced(true);
        }

        setError(errorInfo);
        return;
      }

      if (data.status === 'complete') {
        setResult(data.result);
        setStatus('complete');
      } else if (data.status === 'queued') {
        setJobId(data.jobId);
        setStatus('queued');
      }
    } catch (err) {
      console.error('Submit error:', err instanceof Error ? err.message : String(err));
      setError({
        message: err instanceof Error ? err.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'queued' && jobId) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/status/${jobId}`);
          const data = await response.json();

          if (data.status === 'complete') {
            setResult(data.result);
            setStatus('complete');
            clearInterval(pollInterval);
          } else if (data.status === 'processing') {
            setStatus('processing');
          } else if (data.status === 'failed') {
            setError({ message: data.error || 'Job failed' });
            setStatus('error');
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [status, jobId]);

  const formatResetTime = (resetAt: string): { time: string; remaining: string } => {
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diff = resetDate.getTime() - now.getTime();

    if (diff <= 0) {
      return {
        time: 'Very soon',
        remaining: 'Almost there',
      };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const timeStr = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const remainingStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return {
      time: timeStr,
      remaining: remainingStr,
    };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-dark-card border border-dark-border rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-mint-500/20 p-3 rounded-xl">
            <Github className="w-6 h-6 text-mint-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-text">GitSum</h1>
            <p className="text-sm text-dark-muted">Repository Analyzer</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              Repository URL
            </label>
            <div className="relative">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-muted" />
              <Input
                type="text"
                id="repo-url-input"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                disabled={isLoading}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              Operating System
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['windows', 'macos', 'linux', 'all'] as const).map((osOption) => (
                <Button
                  key={osOption}
                  type="button"
                  variant={os === osOption ? 'default' : 'outline'}
                  onClick={() => setOs(osOption)}
                  disabled={isLoading}
                  className="capitalize"
                >
                  {osOption}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {showAdvanced ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide Advanced Options
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show Advanced Options
                </>
              )}
            </Button>
          </div>

          {showAdvanced && (
            <div id="advanced-options" className="space-y-4 p-5 bg-dark-bg rounded-xl border border-dark-border">
              <SecureKeyInput
                label="Gemini API Key (Optional)"
                id="gemini-key-input"
                value={geminiKey}
                onChange={setGeminiKey}
                placeholder="AIza..."
                persist={persistSession}
                onPersistChange={setPersistSession}
              />
              <SecureKeyInput
                label="GitHub Token (Optional)"
                id="github-token-input"
                value={githubToken}
                onChange={setGithubToken}
                placeholder="ghp_..."
              />
            </div>
          )}

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="w-full flex items-center justify-center gap-2"
            disabled={isLoading || !repoUrl}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Analyze Repository
              </>
            )}
          </Button>
        </form>
      </div>

      <div className="flex justify-end">
        <QuotaStatus />
      </div>

      {status === 'queued' && (
        <ProcessMonitor
          status="queued"
          message="Your repository has been queued for analysis"
          estimatedTime="1-2 minutes"
        />
      )}

      {status === 'processing' && (
        <ProcessMonitor
          status="processing"
          message="Analyzing repository files and dependencies"
        />
      )}

      {status === 'complete' && result && <ConsoleOutput result={result} />}

      {status === 'error' && error && (
        <div className={`${error.isRateLimit ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/50'} border-2 rounded-xl p-6 text-dark-text`}>
          <div className="flex items-start gap-3 mb-4">
            <div className={`${error.isRateLimit ? 'bg-yellow-500/20' : 'bg-red-500/20'} p-2 rounded-lg mt-0.5`}>
              {error.isRateLimit ? (
                <Clock className="w-5 h-5 text-yellow-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold mb-1 ${error.isRateLimit ? 'text-yellow-400' : 'text-red-400'}`}>
                {error.isRateLimit ? 'Daily Limit Reached' : 'Error'}
              </h3>
              <p className="text-sm text-dark-muted">{error.message}</p>
            </div>
          </div>

          {error.isRateLimit && (
            <div className="bg-dark-bg rounded-lg p-4 border border-yellow-500/20 mb-4">
              <div className="flex items-start gap-2 mb-3">
                <Infinity className="w-5 h-5 text-mint-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-dark-text mb-2">
                    Suggestion: Add your own API keys for unlimited access
                  </p>
                  <p className="text-xs text-dark-muted">
                    {error.suggestion}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-dark-muted" />
                  <span className="text-sm text-dark-muted">
                    Resets in: {error.resetAt ? formatResetTime(error.resetAt).remaining : '...'}
                  </span>
                  <span className="text-dark-muted">|</span>
                  <span className="text-sm text-dark-muted">
                    At: {error.resetAt ? formatResetTime(error.resetAt).time : '...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button
            variant={error.isRateLimit ? 'outline' : 'default'}
            onClick={() => {
              if (error.isRateLimit) {
                setError(null);
                if (!showAdvanced) {
                  setShowAdvanced(true);
                  setTimeout(() => {
                    document.getElementById('gemini-key-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }
              } else {
                setStatus('idle');
                setError(null);
              }
            }}
            className={`w-full flex items-center justify-center gap-2 ${error.isRateLimit ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10' : ''}`}
          >
            {error.isRateLimit ? (
              <>
                <Lock className="w-4 h-4" />
                Add API Key to Continue
              </>
            ) : (
              'Try Again'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
