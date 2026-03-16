import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowRight, RefreshCw, CheckCircle2, Lightbulb, AlertCircle, Loader2, ChevronRight, History, Trash2, X, Calendar, Target } from 'lucide-react';
import { AnalysisState, HistoryEntry } from './types';
import { generateNextWhy, generateFinalAnalysis } from './services/geminiService';

export default function App() {
  const [state, setState] = useState<AnalysisState>({
    problem: '',
    steps: [],
    currentStep: 0,
    status: 'idle',
  });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholders = useMemo(() => [
    "e.g., My project is always behind schedule...",
    "e.g., I keep losing customers after free trial...",
    "e.g., My team is not hitting targets...",
    "e.g., I procrastinate on important tasks...",
    "e.g., My startup is not growing after launch...",
    "e.g., I always run out of budget mid-month...",
    "e.g., My employees seem disengaged at work...",
    "e.g., I can't focus during study sessions...",
    "e.g., My app has high uninstall rate...",
    "e.g., I always miss my gym routine...",
  ], []);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (state.status !== 'idle') return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [state.status, placeholders.length]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('5whys_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('5whys_history', JSON.stringify(history));
  }, [history]);

  const startAnalysis = async (problem: string) => {
    if (!problem.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const firstWhy = await generateNextWhy(problem, []);
      setState({
        problem,
        steps: [],
        currentStep: 1,
        status: 'questioning',
        currentWhy: firstWhy,
      });
    } catch (err) {
      setError('Failed to start analysis. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!state.currentWhy) return;
    
    const newSteps = [...state.steps, { why: state.currentWhy.question, answer }];
    const nextStepNum = state.currentStep + 1;

    setLoading(true);
    setError(null);
    try {
      if (nextStepNum <= 5) {
        const nextWhy = await generateNextWhy(state.problem, newSteps);
        setState(prev => ({
          ...prev,
          steps: newSteps,
          currentStep: nextStepNum,
          currentWhy: nextWhy,
        }));
      } else {
        setState(prev => ({ ...prev, status: 'analyzing', steps: newSteps }));
        const analysis = await generateFinalAnalysis(state.problem, newSteps);
        
        const newEntry: HistoryEntry = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          problem: state.problem,
          rootCause: analysis.rootCause,
          solution: analysis.solution,
          proTip: analysis.proTip,
        };
        setHistory(prev => [newEntry, ...prev]);

        setState(prev => ({
          ...prev,
          status: 'completed',
          result: analysis,
        }));
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryEntry = (id: string) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  };

  const reset = () => {
    setState({
      problem: '',
      steps: [],
      currentStep: 0,
      status: 'idle',
    });
    setInputValue('');
    setError(null);
  };

  const filteredHistory = useMemo(() => {
    return history.filter(entry => 
      entry.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.rootCause.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [history, searchQuery]);

  const getEncouragement = (step: number) => {
    if (step === 2) return "Good insight 👀";
    if (step === 3) return "Getting closer…";
    if (step === 4) return "Almost there…";
    if (step === 5) return "One last push! 🎯";
    return null;
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-light font-sans selection:bg-indigo-accent selection:text-white">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="mb-12 text-center relative">
          <button 
            onClick={() => setState(prev => ({ ...prev, status: prev.status === 'history' ? 'idle' : 'history' }))}
            className="absolute right-0 top-0 p-3 rounded-xl bg-navy-800 hover:bg-navy-800/80 transition-colors text-slate-muted"
            title="History"
          >
            {state.status === 'history' ? <X size={24} /> : <History size={24} />}
          </button>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block mb-6"
          >
            <div className="w-16 h-16 bg-indigo-accent rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-accent/20">
              <Search size={32} />
            </div>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4 tracking-tight"
          >
            5 Whys Analyzer
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-muted text-lg font-medium"
          >
            Find the real reason behind any problem.
          </motion.p>
        </header>

        <main className="relative">
          <AnimatePresence mode="wait">
            
            {/* History State */}
            {state.status === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-6"
              >
                <div className="bg-navy-800 rounded-[32px] p-8 shadow-xl border border-white/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <h2 className="text-2xl font-bold">Past Insights</h2>
                    <div className="relative flex-grow md:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted" size={18} />
                      <input 
                        type="text"
                        placeholder="Search by problem or cause..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-navy-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-accent transition-all text-sm"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-muted hover:text-slate-light"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {history.length > 0 && filteredHistory.length === 0 ? (
                    <div className="text-center py-16 text-slate-muted">
                      <Search size={64} className="mx-auto mb-4 opacity-10" />
                      <p className="text-lg mb-2">No results found for "{searchQuery}"</p>
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-indigo-accent hover:underline font-medium"
                      >
                        Clear search
                      </button>
                    </div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-16 text-slate-muted">
                      <History size={64} className="mx-auto mb-4 opacity-10" />
                      <p className="text-lg">No past analyses found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredHistory.map((entry) => (
                        <div key={entry.id} className="group relative p-6 rounded-2xl bg-navy-900 border border-white/5 hover:border-indigo-accent/40 transition-all">
                          <button 
                            onClick={() => deleteHistoryEntry(entry.id)}
                            className="absolute right-4 top-4 p-2 text-slate-muted hover:text-amber-warning opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                          
                          <div className="flex items-center gap-2 text-slate-muted text-xs font-semibold mb-3">
                            <Calendar size={14} />
                            {new Date(entry.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                          
                          <h3 className="font-bold text-lg mb-2 leading-tight pr-8 text-slate-light">{entry.problem}</h3>
                          <div className="flex items-start gap-2 text-sm text-cyan-highlight">
                            <Target size={14} className="mt-1 flex-shrink-0" />
                            <p className="font-medium">{entry.rootCause}</p>
                          </div>

                          <div className="mt-4 pt-4 border-t border-white/5 hidden group-hover:block animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-muted mb-2">Solution</h4>
                                <ul className="text-sm space-y-2">
                                  {entry.solution.map((s, i) => (
                                    <li key={i} className="flex gap-2 text-slate-light">
                                      <span className="text-emerald-success font-bold">✓</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="p-4 bg-navy-800 rounded-xl border border-white/5">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-warning mb-1">Pro Tip</h4>
                                <p className="text-xs text-slate-light italic opacity-90">{entry.proTip}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setState(prev => ({ ...prev, status: 'idle' }))}
                  className="w-full py-5 bg-indigo-accent text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-accent/90 transition-all shadow-lg shadow-indigo-accent/20"
                >
                  Start New Analysis
                </button>
              </motion.div>
            )}

            {/* Idle / Input State */}
            {state.status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="bg-navy-800 rounded-[32px] p-10 shadow-2xl border border-white/5"
              >
                <h2 className="text-2xl font-bold mb-8 text-center">What's the problem?</h2>
                <div className="space-y-6">
                  <div className="relative">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full h-40 p-6 rounded-2xl bg-navy-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-accent transition-all resize-none text-xl font-medium placeholder:text-slate-muted/50"
                    />
                    <AnimatePresence mode="wait">
                      {!inputValue && (
                        <motion.div
                          key={placeholderIndex}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 4 }}
                          className="absolute top-6 left-6 pointer-events-none text-xl font-medium text-slate-muted/50"
                        >
                          {placeholders[placeholderIndex]}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={() => startAnalysis(inputValue)}
                    disabled={loading || !inputValue.trim()}
                    className="w-full py-5 bg-indigo-accent text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-accent/90 transition-all shadow-lg shadow-indigo-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={24} />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <span>Start Analysis</span>
                        <ArrowRight size={24} />
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-8 text-sm text-slate-muted text-center font-medium">
                  We'll guide you through 5 layers of "Why" to find the root cause.
                </p>
              </motion.div>
            )}

            {/* Questioning State */}
            {state.status === 'questioning' && state.currentWhy && (
              <motion.div
                key={`why-${state.currentStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-highlight">
                      Why {state.currentStep} of 5
                    </span>
                    <AnimatePresence>
                      {getEncouragement(state.currentStep) && (
                        <motion.span 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-bold text-emerald-success"
                        >
                          {getEncouragement(state.currentStep)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="h-2 w-full bg-navy-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(state.currentStep / 5) * 100}%` }}
                      className="h-full bg-cyan-highlight shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                    />
                  </div>
                </div>

                <div className="bg-navy-800 rounded-[32px] p-10 shadow-2xl border border-white/5">
                  <h3 className="text-3xl font-bold mb-10 leading-tight">
                    {state.currentWhy.question}
                  </h3>
                  
                  <div className="grid gap-4">
                    {state.currentWhy.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(option)}
                        disabled={loading}
                        className="group flex items-center justify-between p-6 rounded-2xl bg-navy-900 border border-white/5 hover:border-indigo-accent hover:bg-navy-900/50 transition-all text-left"
                      >
                        <span className="text-lg font-medium">{option}</span>
                        <ChevronRight className="text-slate-muted group-hover:text-indigo-accent transition-colors" size={24} />
                      </button>
                    ))}
                    <div className="relative mt-4">
                      <input
                        type="text"
                        placeholder="D) Other (type your own answer...)"
                        className="w-full p-6 rounded-2xl bg-navy-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-accent transition-all text-lg font-medium"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            handleAnswer(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-muted text-xs font-bold uppercase tracking-widest opacity-50">
                        Press Enter
                      </div>
                    </div>
                    <p className="text-center text-xs text-slate-muted font-bold uppercase tracking-widest mt-2">
                      pick what feels closest
                    </p>
                  </div>
                </div>

                {loading && (
                  <div className="flex justify-center">
                    <Loader2 className="animate-spin text-indigo-accent" size={40} />
                  </div>
                )}
              </motion.div>
            )}

            {/* Analyzing State */}
            {state.status === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-24"
              >
                <div className="relative inline-block mb-8">
                  <Loader2 className="animate-spin text-indigo-accent" size={64} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Target className="text-cyan-highlight" size={24} />
                  </div>
                </div>
                <h2 className="text-3xl font-bold mb-4">Synthesizing Results</h2>
                <p className="text-slate-muted text-lg font-medium italic">Connecting the dots to find the root cause...</p>
              </motion.div>
            )}

            {/* Completed State */}
            {state.status === 'completed' && state.result && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-emerald-success">Here's what we found 🎯</h2>
                </div>

                <div className="bg-white rounded-[32px] p-10 shadow-2xl text-navy-900">
                  <div className="flex items-center gap-4 mb-8 text-indigo-accent">
                    <Search size={32} />
                    <h2 className="text-xl font-bold uppercase tracking-widest">🔍 Root Cause Identified</h2>
                  </div>
                  <p className="text-3xl font-bold leading-tight mb-10">
                    {state.result.rootCause}
                  </p>

                  <div className="h-px bg-navy-900/10 mb-10" />

                  <div className="space-y-8">
                    <div className="flex items-center gap-4 text-emerald-success">
                      <CheckCircle2 size={32} />
                      <h3 className="text-xl font-bold uppercase tracking-widest">✅ Actionable Solution</h3>
                    </div>
                    <ul className="space-y-6">
                      {state.result.solution.map((step, i) => (
                        <li key={i} className="flex gap-5 items-start">
                          <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-success/10 text-emerald-success flex items-center justify-center text-lg font-bold">
                            {i + 1}
                          </span>
                          <span className="text-xl font-medium text-navy-900/90">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-12 p-8 bg-amber-warning/5 rounded-3xl border border-amber-warning/20">
                    <div className="flex items-center gap-4 mb-4 text-amber-warning">
                      <Lightbulb size={28} />
                      <h4 className="font-bold uppercase tracking-widest text-sm">💡 Pro Tip</h4>
                    </div>
                    <p className="italic text-xl text-navy-900/80 leading-relaxed">
                      {state.result.proTip}
                    </p>
                  </div>
                </div>

                <button
                  onClick={reset}
                  className="w-full py-5 bg-indigo-accent text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-accent/90 transition-all shadow-lg shadow-indigo-accent/20 text-lg"
                >
                  <RefreshCw size={24} />
                  Analyze Another Problem
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-amber-warning/10 text-amber-warning rounded-2xl flex items-center gap-4 border border-amber-warning/20"
            >
              <AlertCircle size={24} />
              <p className="text-lg font-bold">{error}</p>
            </motion.div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-24 text-center text-slate-muted text-sm font-bold uppercase tracking-widest opacity-50">
          <p>© {new Date().getFullYear()} 5 Whys Root Cause Analyzer</p>
          <p className="mt-2 italic lowercase tracking-normal font-medium">Built for clarity and action.</p>
        </footer>
      </div>
    </div>
  );
}
