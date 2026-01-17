'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Infinity, AlertTriangle } from 'lucide-react';

interface QuotaStatusProps {
  className?: string;
}

export default function QuotaStatus({ className }: QuotaStatusProps) {
  const [quota, setQuota] = useState<{
    remaining: number;
    total: number;
    isUsingUserKey: boolean;
  } | null>(null);

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const response = await fetch('/api/quota');
        const data = await response.json();
        setQuota(data);

        // Show warning banner when <5 remaining
        if (!data.isUsingUserKey && data.remaining <= 5) {
          setShowWarning(true);
        }
      } catch (error) {
        console.error('Failed to fetch quota:', error);
      }
    }

    fetchQuota();
    const interval = setInterval(fetchQuota, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatResetTime = (resetAt: string): string => {
    const resetDate = new Date(resetAt);
    return resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!quota) {
    return (
      <div className={`bg-dark-bg border border-dark-border rounded-lg px-4 py-2 flex items-center gap-2 ${className}`}>
        <BarChart3 className="w-4 h-4 text-dark-muted animate-pulse" />
        <span className="text-sm text-dark-muted">Loading quota...</span>
      </div>
    );
  }

  if (quota.isUsingUserKey) {
    return (
      <div className={`bg-mint-500/10 border border-mint-500/30 rounded-lg px-4 py-2 flex items-center gap-2 ${className}`}>
        <Infinity className="w-4 h-4 text-mint-400" />
        <span className="text-sm font-medium text-mint-400">Unlimited Access</span>
      </div>
    );
  }

  const percentage = (quota.remaining / quota.total) * 100;
  const isLow = quota.remaining <= 5;
  const isMedium = quota.remaining <= 10;
  const isCritical = quota.remaining <= 2;

  const barColor = isCritical ? 'bg-red-500' : isLow ? 'bg-yellow-500' : isMedium ? 'bg-orange-500' : 'bg-mint-500';
  const textColor = isCritical ? 'text-red-400' : isLow ? 'text-yellow-400' : isMedium ? 'text-orange-400' : 'text-mint-400';

  return (
    <div className="space-y-3">
      {/* Warning Banner */}
      {showWarning && isLow && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-400">
              Only {quota.remaining} analyses left today
            </p>
            <p className="text-xs text-dark-muted mt-1">
              Add your Gemini API key in Advanced Options for unlimited access
            </p>
          </div>
          <button
            onClick={() => setShowWarning(false)}
            className="text-yellow-500/50 hover:text-yellow-500 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* Quota Display */}
      <div className={`bg-dark-bg border border-dark-border rounded-lg px-4 py-2 ${className}`}>
        <div className="flex items-center gap-3">
          <BarChart3 className={`w-4 h-4 ${textColor}`} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-dark-text">
              {quota.remaining}/{quota.total}
            </span>
            <div className="w-24 h-2 bg-dark-border rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
