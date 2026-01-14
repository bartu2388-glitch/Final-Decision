
export interface Stats {
  gdp: number; 
  inflation: number; 
  unemployment: number; 
  budgetBalance: number; 
  armyMorale: number; 
  publicSupport: number; 
  stability: number; 
  techPoints?: number;
}

export interface Ministry {
  id: string;
  name: string;
  ministerName: string;
  role: string;
  morale: number;
  budgetShare: number;
  efficiency: number;
  icon: string;
  automatedActions?: string[]; 
}

export interface Technology {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'Military' | 'Economic' | 'Social';
  benefit: string;
  unlocked: boolean;
  icon: string;
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  fromMinistryId: string;
  options: {
    label: string;
    impact: string;
    action: string;
  }[];
}

export interface Report {
  date: string;
  location: string;
  summary: string;
  intelligence: string;
  pendingIssues: string[];
  statsSnapshot: Stats;
  cabinetDecisions?: Decision[];
  npcActivity?: { ministerId: string, action: string }[];
}

export interface GameState {
  country: string;
  playerRole: string;
  currentDate: string;
  currentStats: Stats;
  history: Report[];
  relations: Record<string, number>;
  ministries: Ministry[];
  unlockedTechIds: string[];
  stagedDecisions: { decisionTitle: string, selectedOption: string }[];
}

export enum GameView {
  DASHBOARD = 'dashboard',
  HISTORY = 'history',
  DIPLOMACY = 'diplomacy',
  CABINET = 'cabinet',
  TECH = 'tech'
}
