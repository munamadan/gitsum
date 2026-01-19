import TerminalInput from '@/components/TerminalInput';
import { Github, Zap, Shield, Clock } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-dark-bg text-dark-text antialiased">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <header className="mb-12 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="bg-gradient-to-br from-mint-400 to-mint-600 p-4 rounded-2xl shadow-lg shadow-mint-500/20">
              <Github className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-mint-400 to-mint-500 bg-clip-text text-transparent">
              GitSum
            </h1>
          </div>
          <p className="text-lg text-dark-muted max-w-2xl mx-auto">
            Analyze any GitHub repository and generate comprehensive, OS-specific setup guides
          </p>
        </header>

        <TerminalInput />

        <footer className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-mint-500/20 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-mint-400" />
              </div>
              <h3 className="font-semibold text-dark-text">Fast Analysis</h3>
            </div>
            <p className="text-sm text-dark-muted">
              Small repositories (&lt;20MB) analyzed in seconds, larger ones in 1-2 minutes
            </p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-yellow-500/20 p-2 rounded-lg">
                <Shield className="w-5 h-5 text-yellow-500" />
              </div>
              <h3 className="font-semibold text-dark-text">Secure & Private</h3>
            </div>
            <p className="text-sm text-dark-muted">
              API keys encrypted with AES-256-GCM, sessions expire in 24 hours
            </p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-semibold text-dark-text">AI-Powered</h3>
            </div>
            <p className="text-sm text-dark-muted">
              Uses Gemini AI to understand codebases and generate accurate setup instructions
            </p>
          </div>
        </footer>

        <div className="mt-12 text-center text-sm text-dark-muted">
          <p>Built with Next.js 15, TypeScript, and Tailwind CSS</p>
          <p className="mt-1">
            Terminal Brutalist Aesthetic{' '}
            <span className="text-mint-400">→</span>{' '}
            <span className="text-mint-400">Modern & Friendly</span>
          </p>
        </div>
      </div>
    </main>
  );
}
 
