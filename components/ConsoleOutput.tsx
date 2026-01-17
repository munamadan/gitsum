'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, FileText, Settings, Play, AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import { AnalysisResult } from '@/types';
import { Button } from './ui/button';

interface ConsoleOutputProps {
  result: AnalysisResult;
}

export default function ConsoleOutput({ result }: ConsoleOutputProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CustomHeading = ({ children, level }: any) => {
    const text = typeof children === 'string' ? children : String(children);

    return (
      <div className={`font-semibold ${level === 1 ? 'text-2xl mt-8 mb-4' : 'text-xl mt-6 mb-3'}`}>
        {text}
      </div>
    );
  };

  const CustomCode = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    if (!inline && language) {
      const code = String(children).replace(/\n$/, '');
      const sectionId = Math.random().toString(36).substr(2, 9);

      return (
        <div className="relative my-4 rounded-xl overflow-hidden">
          <div className="bg-dark-bg border-b border-dark-border px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">{language}</span>
            <button
              onClick={() => copyToClipboard(code, sectionId)}
              className="flex items-center gap-1.5 text-xs text-mint-400 hover:text-mint-300 transition-colors"
            >
              {copiedSection === sectionId ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '13px',
              lineHeight: '1.6',
            }}
            {...props}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <code
        className="bg-dark-bg text-mint-400 px-1.5 py-0.5 rounded text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  };

  const CustomList = ({ children, ordered }: any) => {
    const items = React.Children.toArray(children);

    return (
      <div className="my-4 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-3 text-dark-text">
            <span className={`flex-shrink-0 mt-0.5 ${ordered ? 'text-mint-500' : 'text-dark-muted'}`}>
              {ordered ? `${index + 1}.` : '•'}
            </span>
            <div className="flex-1">{item}</div>
          </div>
        ))}
      </div>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'prerequisites', label: 'Prerequisites', icon: Info },
    { id: 'setup', label: 'Setup', icon: Play },
    { id: 'configuration', label: 'Configuration', icon: Settings },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
  ];

  const formatSectionAsMarkdown = (sectionId: string) => {
    switch (sectionId) {
      case 'overview':
        return `# Project Overview\n\n${result.projectOverview}`;
      case 'prerequisites':
        return `# Prerequisites\n\n${result.prerequisites.map(p => `- ${p}`).join('\n')}`;
      case 'setup':
        return `# Setup Steps\n\n${result.setupSteps.map(s => `${s}`).join('\n')}\n\n# Running\n\n${result.runningInstructions}`;
      case 'configuration':
        return `# Configuration\n\n${result.configuration}`;
      case 'troubleshooting':
        return `# Troubleshooting\n\n${result.troubleshooting}`;
      default:
        return '';
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl shadow-xl overflow-hidden">
      <div className="border-b border-dark-border">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-mint-400 bg-mint-500/10 border-b-2 border-mint-500'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 max-h-[600px] overflow-y-auto">
        <ReactMarkdown
          components={{
            h1: CustomHeading,
            h2: CustomHeading,
            h3: CustomHeading,
            code: CustomCode,
            ul: CustomList,
            ol: (props) => <CustomList {...props} ordered />,
          }}
        >
          {formatSectionAsMarkdown(activeTab)}
        </ReactMarkdown>
      </div>

      <div className="border-t border-dark-border p-4 bg-dark-bg">
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Analyze Another Repository
        </Button>
      </div>
    </div>
  );
}
