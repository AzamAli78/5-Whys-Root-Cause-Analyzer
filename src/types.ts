export interface WhyStep {
  question: string;
  options: string[];
}

export interface HistoryEntry {
  id: string;
  date: string;
  problem: string;
  steps: { why: string; answer: string }[];
  rootCause: string;
  solution: string[];
  proTip: string;
  feedback?: 'helpful' | 'not-helpful';
}

export interface AnalysisState {
  problem: string;
  steps: { why: string; answer: string }[];
  currentStep: number;
  status: 'idle' | 'input_problem' | 'questioning' | 'analyzing' | 'completed' | 'history';
  currentWhy?: WhyStep;
  result?: {
    rootCause: string;
    solution: string[];
    proTip: string;
  };
}
