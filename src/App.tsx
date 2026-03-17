import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowRight, RefreshCw, CheckCircle2, Lightbulb, AlertCircle, Loader2, ChevronRight, History, Trash2, X, Calendar, Target, Settings, Save, ThumbsUp, ThumbsDown } from 'lucide-react';
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

  const [customWhyInstruction, setCustomWhyInstruction] = useState('You are a Root Cause Analysis expert.');
  const [customAnalysisInstruction, setCustomAnalysisInstruction] = useState('You are a Root Cause Analysis expert.');
  const [showSettings, setShowSettings] = useState(false);

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

    const savedState = localStorage.getItem('5whys_current_state');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.status === 'analyzing') {
          parsedState.status = 'questioning';
        }
        setState(parsedState);
        if (parsedState.problem) {
          setInputValue(parsedState.problem);
        }
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }

    const savedWhyPrompt = localStorage.getItem('5whys_custom_why_prompt');
    if (savedWhyPrompt) setCustomWhyInstruction(savedWhyPrompt);
    
    const savedAnalysisPrompt = localStorage.getItem('5whys_custom_analysis_prompt');
    if (savedAnalysisPrompt) setCustomAnalysisInstruction(savedAnalysisPrompt);
  }, []);

  useEffect(() => {
    localStorage.setItem('5whys_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    // Don't save if in history view, we want to resume the actual analysis
    if (state.status !== 'history') {
      localStorage.setItem('5whys_current_state', JSON.stringify(state));
    }
  }, [state]);

  const startAnalysis = async (problem: string) => {
    if (!problem.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const firstWhy = await generateNextWhy(problem, [], customWhyInstruction);
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
        const nextWhy = await generateNextWhy(state.problem, newSteps, customWhyInstruction);
        setState(prev => ({
          ...prev,
          steps: newSteps,
          currentStep: nextStepNum,
          currentWhy: nextWhy,
        }));
      } else {
        setState(prev => ({ ...prev, status: 'analyzing', steps: newSteps }));
        const analysis = await generateFinalAnalysis(state.problem, newSteps, customAnalysisInstruction);
        
        const newEntry: HistoryEntry = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          problem: state.problem,
          steps: newSteps,
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

  const handleFeedback = (id: string, feedback: 'helpful' | 'not-helpful') => {
    setHistory(prev => prev.map(entry => 
      entry.id === id ? { ...prev.find(e => e.id === id)!, feedback } : entry
    ));
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
        <header className="mb-8 md:mb-12 text-center relative">
          <div className="flex justify-end gap-2 mb-6 md:absolute md:right-0 md:top-0 md:mb-0">
            <button 
              onClick={() => {
                setShowSettings(!showSettings);
                if (state.status === 'history') setState(prev => ({ ...prev, status: 'idle' }));
              }}
              className={`p-2.5 md:p-3 rounded-xl transition-colors ${showSettings ? 'bg-indigo-accent text-white' : 'bg-navy-800 text-slate-muted hover:bg-navy-800/80'}`}
              title="Settings"
            >
              <Settings size={20} className="md:w-6 md:h-6" />
            </button>
            <button 
              onClick={() => {
                setState(prev => ({ ...prev, status: prev.status === 'history' ? 'idle' : 'history' }));
                if (showSettings) setShowSettings(false);
              }}
              className={`p-2.5 md:p-3 rounded-xl transition-colors ${state.status === 'history' ? 'bg-indigo-accent text-white' : 'bg-navy-800 text-slate-muted hover:bg-navy-800/80'}`}
              title="History"
            >
              {state.status === 'history' ? <X size={20} className="md:w-6 md:h-6" /> : <History size={20} className="md:w-6 md:h-6" />}
            </button>
          </div>

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
            
            {/* Settings State */}
            {showSettings && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-navy-800 rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-xl border border-white/5 mb-8"
              >
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold">Prompt Settings</h2>
                  <button onClick={() => setShowSettings(false)} className="text-slate-muted hover:text-slate-light">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-muted">
                        "Why" Generation Instruction
                      </label>
                      <div className="group relative">
                        <AlertCircle size={14} className="text-slate-muted cursor-help" />
                        <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-navy-900 border border-white/10 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-[10px] leading-relaxed text-slate-muted">
                          <p className="font-bold text-slate-light mb-1 uppercase tracking-wider">Pro Tip:</p>
                          Define a persona or focus. 
                          <br/><br/>
                          <span className="text-indigo-accent italic">"Act as a lean manufacturing consultant focusing on waste reduction."</span>
                        </div>
                      </div>
                    </div>
                    <textarea 
                      value={customWhyInstruction}
                      onChange={(e) => setCustomWhyInstruction(e.target.value)}
                      className="w-full h-28 md:h-32 p-4 rounded-xl bg-navy-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-accent transition-all text-sm font-medium"
                      placeholder="e.g., You are a business consultant focusing on efficiency..."
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-muted">
                        Final Analysis Instruction
                      </label>
                      <div className="group relative">
                        <AlertCircle size={14} className="text-slate-muted cursor-help" />
                        <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-navy-900 border border-white/10 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-[10px] leading-relaxed text-slate-muted">
                          <p className="font-bold text-slate-light mb-1 uppercase tracking-wider">Pro Tip:</p>
                          Specify the output style or target audience.
                          <br/><br/>
                          <span className="text-indigo-accent italic">"Provide solutions suitable for a small non-profit with limited budget."</span>
                        </div>
                      </div>
                    </div>
                    <textarea 
                      value={customAnalysisInstruction}
                      onChange={(e) => setCustomAnalysisInstruction(e.target.value)}
                      className="w-full h-28 md:h-32 p-4 rounded-xl bg-navy-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-accent transition-all text-sm font-medium"
                      placeholder="e.g., Provide solutions specifically for a tech startup context..."
                    />
                  </div>

                  <button 
                    onClick={() => {
                      localStorage.setItem('5whys_custom_why_prompt', customWhyInstruction);
                      localStorage.setItem('5whys_custom_analysis_prompt', customAnalysisInstruction);
                      setShowSettings(false);
                    }}
                    className="w-full py-4 bg-emerald-success text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-success/90 transition-all shadow-lg shadow-emerald-success/20"
                  >
                    <Save size={20} />
                    <span>Save Custom Prompts</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setCustomWhyInstruction('You are a Root Cause Analysis expert.');
                      setCustomAnalysisInstruction('You are a Root Cause Analysis expert.');
                      localStorage.removeItem('5whys_custom_why_prompt');
                      localStorage.removeItem('5whys_custom_analysis_prompt');
                    }}
                    className="w-full text-xs font-bold uppercase tracking-widest text-slate-muted hover:text-amber-warning transition-colors"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </motion.div>
            )}

            {/* History State */}
            {state.status === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-6"
              >
                <div className="bg-navy-800 rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-xl border border-white/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl md:text-2xl font-bold">Past Insights</h2>
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
                        <div key={entry.id} className="group relative p-5 md:p-6 rounded-2xl bg-navy-900 border border-white/5 hover:border-indigo-accent/40 transition-all">
                          <button 
                            onClick={() => deleteHistoryEntry(entry.id)}
                            className="absolute right-4 top-4 p-2 text-slate-muted hover:text-amber-warning md:opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                          
                          <div className="flex items-center gap-2 text-slate-muted text-[10px] md:text-xs font-semibold mb-3">
                            <Calendar size={12} className="md:w-3.5 md:h-3.5" />
                            {new Date(entry.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            {entry.feedback && (
                              <span className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full ${entry.feedback === 'helpful' ? 'bg-emerald-success/10 text-emerald-success' : 'bg-amber-warning/10 text-amber-warning'}`}>
                                {entry.feedback === 'helpful' ? <ThumbsUp size={10} /> : <ThumbsDown size={10} />}
                                {entry.feedback === 'helpful' ? 'Helpful' : 'Not Helpful'}
                              </span>
                            )}
                          </div>
                          
                          <h3 className="font-bold text-base md:text-lg mb-2 leading-tight pr-8 text-slate-light">{entry.problem}</h3>
                          <div className="flex items-start gap-2 text-xs md:text-sm text-cyan-highlight">
                            <Target size={14} className="mt-0.5 md:mt-1 flex-shrink-0" />
                            <p className="font-medium">{entry.rootCause}</p>
                          </div>

                          <div className="mt-4 pt-4 border-t border-white/5 md:hidden group-hover:block animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-muted mb-3">The "Why" Chain</h4>
                                <div className="space-y-4">
                                  {entry.steps.map((step, i) => (
                                    <div key={i} className="flex gap-3 text-xs md:text-sm">
                                      <span className="text-indigo-accent font-bold">W{i + 1}</span>
                                      <div>
                                        <p className="text-slate-muted text-[10px] md:text-xs italic mb-1">{step.why}</p>
                                        <p className="text-slate-light font-medium">{step.answer}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

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
                className="bg-navy-800 rounded-[24px] md:rounded-[32px] p-6 md:p-10 shadow-2xl border border-white/5"
              >
                <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 text-center">What's the problem?</h2>
                <div className="space-y-6">
                  <div className="relative">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full h-32 md:h-40 p-4 md:p-6 rounded-2xl bg-navy-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-accent transition-all resize-none text-lg md:text-xl font-medium placeholder:text-slate-muted/50"
                    />
                    <AnimatePresence mode="wait">
                      {!inputValue && (
                        <motion.div
                          key={placeholderIndex}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 4 }}
                          className="absolute top-4 left-4 md:top-6 md:left-6 pointer-events-none text-lg md:text-xl font-medium text-slate-muted/50 pr-8"
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

                <div className="bg-navy-800 rounded-[24px] md:rounded-[32px] p-6 md:p-10 shadow-2xl border border-white/5">
                  <h3 className="text-xl md:text-3xl font-bold mb-8 md:mb-10 leading-tight">
                    {state.currentWhy.question}
                  </h3>
                  
                  <div className="grid gap-3 md:gap-4">
                    {state.currentWhy.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(option)}
                        disabled={loading}
                        className="group flex items-center justify-between p-4 md:p-6 rounded-2xl bg-navy-900 border border-white/5 hover:border-indigo-accent hover:bg-navy-900/50 transition-all text-left"
                      >
                        <span className="text-base md:text-lg font-medium pr-4">{option}</span>
                        <ChevronRight className="text-slate-muted group-hover:text-indigo-accent transition-colors flex-shrink-0" size={20} />
                      </button>
                    ))}
                    <div className="relative mt-2 md:mt-4">
                      <input
                        type="text"
                        placeholder="D) Other (type your own...)"
                        className="w-full p-4 md:p-6 rounded-2xl bg-navy-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-accent transition-all text-base md:text-lg font-medium"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            handleAnswer(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <div className="hidden md:block absolute right-6 top-1/2 -translate-y-1/2 text-slate-muted text-xs font-bold uppercase tracking-widest opacity-50">
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

                <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-10 shadow-2xl text-navy-900">
                  <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8 text-indigo-accent">
                    <Search size={24} className="md:w-8 md:h-8" />
                    <h2 className="text-base md:text-xl font-bold uppercase tracking-widest">🔍 Root Cause Identified</h2>
                  </div>
                  <p className="text-xl md:text-3xl font-bold leading-tight mb-8 md:mb-10">
                    {state.result.rootCause}
                  </p>

                  <div className="h-px bg-navy-900/10 mb-8 md:mb-10" />

                  <div className="space-y-6 md:space-y-8">
                    <div className="flex items-center gap-3 md:gap-4 text-emerald-success">
                      <CheckCircle2 size={24} className="md:w-8 md:h-8" />
                      <h3 className="text-base md:text-xl font-bold uppercase tracking-widest">✅ Actionable Solution</h3>
                    </div>
                    <ul className="space-y-4 md:space-y-6">
                      {state.result.solution.map((step, i) => (
                        <li key={i} className="flex gap-3 md:gap-5 items-start">
                          <span className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-emerald-success/10 text-emerald-success flex items-center justify-center text-sm md:text-lg font-bold">
                            {i + 1}
                          </span>
                          <span className="text-base md:text-xl font-medium text-navy-900/90">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 md:mt-12 p-6 md:p-8 bg-amber-warning/5 rounded-2xl md:rounded-3xl border border-amber-warning/20">
                    <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4 text-amber-warning">
                      <Lightbulb size={24} className="md:w-7 md:h-7" />
                      <h4 className="font-bold uppercase tracking-widest text-xs md:text-sm">💡 Pro Tip</h4>
                    </div>
                    <p className="italic text-base md:text-xl text-navy-900/80 leading-relaxed">
                      {state.result.proTip}
                    </p>
                  </div>

                  <div className="mt-10 pt-10 border-t border-navy-900/10 text-center">
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-muted mb-4">Was this analysis helpful?</p>
                    <div className="flex justify-center gap-4">
                      {history[0]?.feedback ? (
                        <p className="text-emerald-success font-bold flex items-center gap-2">
                          <CheckCircle2 size={20} />
                          Thanks for your feedback!
                        </p>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleFeedback(history[0].id, 'helpful')}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-navy-900/10 hover:bg-emerald-success/10 hover:border-emerald-success hover:text-emerald-success transition-all font-bold"
                          >
                            <ThumbsUp size={20} />
                            Helpful
                          </button>
                          <button 
                            onClick={() => handleFeedback(history[0].id, 'not-helpful')}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-navy-900/10 hover:bg-amber-warning/10 hover:border-amber-warning hover:text-amber-warning transition-all font-bold"
                          >
                            <ThumbsDown size={20} />
                            Not Helpful
                          </button>
                        </>
                      )}
                    </div>
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
