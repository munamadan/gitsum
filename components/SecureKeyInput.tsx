'use client';

import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Eye, EyeOff, Shield } from 'lucide-react';

interface SecureKeyInputProps {
  label: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  persist?: boolean;
  onPersistChange?: (persist: boolean) => void;
}

export default function SecureKeyInput({
  label,
  id,
  value,
  onChange,
  placeholder,
  persist,
  onPersistChange,
}: SecureKeyInputProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-dark-text">{label}</label>
      <div className="relative">
        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-muted" />
        <Input
          id={id}
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-12"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text transition-colors"
        >
          {showKey ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>
      {onPersistChange && (
        <div className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            id={`persist-${label}`}
            checked={persist}
            onChange={(e) => onPersistChange(e.target.checked)}
            className="w-4 h-4 rounded border-dark-border text-mint-500 focus:ring-mint-500 bg-dark-bg"
          />
          <label
            htmlFor={`persist-${label}`}
            className="text-sm text-dark-muted cursor-pointer"
          >
            Remember for 24 hours
          </label>
        </div>
      )}
    </div>
  );
}
