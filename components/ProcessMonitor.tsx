'use client';

import { useState, useEffect } from 'react';
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProcessMonitorProps {
  status: 'queued' | 'processing' | 'complete';
  message?: string;
  estimatedTime?: string;
}

export default function ProcessMonitor({
  status,
  message,
  estimatedTime,
}: ProcessMonitorProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-lg">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {status === 'queued' && (
            <div className="bg-yellow-500/20 p-3 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
          )}
          {status === 'processing' && (
            <div className="bg-mint-500/20 p-3 rounded-xl">
              <Loader2 className="w-6 h-6 text-mint-500 animate-spin" />
            </div>
          )}
          {status === 'complete' && (
            <div className="bg-green-500/20 p-3 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-dark-text">
              {status === 'queued' && 'Queued'}
              {status === 'processing' && 'Processing'}
              {status === 'complete' && 'Complete'}
            </h3>
            {status === 'processing' && (
              <span className="text-sm text-dark-muted">{dots}</span>
            )}
          </div>

          {message && (
            <p className="text-sm text-dark-muted">{message}</p>
          )}

          {estimatedTime && status === 'queued' && (
            <div className="flex items-center gap-2 text-sm text-dark-muted">
              <Clock className="w-4 h-4" />
              <span>Estimated time: {estimatedTime}</span>
            </div>
          )}

          {status === 'processing' && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-dark-muted">
                <span>Progress</span>
                <span>Processing</span>
              </div>
              <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-mint-400 to-mint-500 animate-pulse transition-all duration-1000" style={{ width: '60%' }} />
              </div>
              <div className="flex gap-1 mt-2">
                <div className="w-2 h-2 bg-mint-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-mint-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-mint-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
