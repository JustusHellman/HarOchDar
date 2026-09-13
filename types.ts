export interface Location {
  lat: number;
  lng: number;
}

export interface User {
  username: string;
  id: string;
  email?: string;
}

export interface Question {
  id: string;
  imageUrl: string;
  location: Location;
  title?: string;
  locationSource?: 'IMAGE' | 'GPS' | 'DEFAULT' | 'MANUAL';
  trailId?: string;
}

export interface Trail {
  id: string;
  name: string;
  questions: Question[];
  creatorId: string;
  lastUpdated: number;
  startingView?: { center: Location; zoom: number };
}

export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  lastGuess?: Location;
  lastDistance?: number;
  lastPointsGained?: number;
  hasGuessed: boolean;
}

export interface GameState {
  id: string;
  status: 'LOBBY' | 'PLAYING' | 'COUNTDOWN' | 'RESULTS' | 'SCOREBOARD' | 'FINISHED';
  questions: Question[];
  currentQuestionIndex: number;
  players: Player[];
  hostId: string;
  startingView?: { center: Location; zoom: number };
}

export type AppView = 'HOME' | 'AUTH' | 'DASHBOARD' | 'CREATE' | 'LOBBY' | 'PLAYING' | 'JOIN' | 'SOLO_PLAY' | 'LEADERBOARD';

export interface SpotGuess {
  questionIndex: number;
  guess: Location;
  distanceKm: number;
}

export interface TrailRun {
  id: string;
  trailId: string;
  playerName: string;
  playerColor: string;
  totalDistanceKm: number;
  totalScore: number;
  guesses: SpotGuess[];
  createdAt: string;
}

export interface LeaderboardRanking {
  run: TrailRun;
  distanceRank: number;
  pointRank: number;
  calculatedPoints: number;
  spotWins: number;
}