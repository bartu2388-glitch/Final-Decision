
import React, { useState, useRef, useEffect } from 'react';

interface TerminalProps {
  onSubmit: (command: string) => void;
  isLoading: boolean;
  country: string;
  initialValue?: string;
}

const Terminal: React.FC<TerminalProps> = ({ onSubmit, isLoading, country, initialValue = '' }) => {
  const [input, setInput] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput(initialValue);
    if (initialValue && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSubmit(input);
      setInput('');
    }
  };

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  return (
    <div className="w-full mt-6">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <span className="text-blue-500 font-bold mono text-xs">
            {country.toLowerCase().replace(/\s+/g, '_')}@hq:~${' '}
          </span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder={isLoading ? "Iletişim hatları meşgul..." : "Emirlerinizi bekliyoruz..."}
          className={`w-full bg-slate-950 border-2 ${isLoading ? 'border-yellow-500/30' : 'border-slate-800'} focus:border-blue-500/50 rounded-2xl py-5 pl-40 pr-12 text-blue-100 mono text-sm outline-none transition-all shadow-2xl disabled:opacity-75`}
        />
        <div className="absolute inset-y-0 right-4 flex items-center">
          {isLoading ? (
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          ) : (
            <button type="submit" className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all shadow-lg active:scale-90">
              <i className="fas fa-arrow-right"></i>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default Terminal;
