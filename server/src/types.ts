// src/types.ts

export interface Player {
    id: string;
    name: string;
    isAI: boolean;
    isReady: boolean;
    connected: boolean;
  }
  
  export interface PlayerResponse {
    playerId: string;
    playerName: string;
    response: string;
    timestamp: string;
    isAI: boolean;
  }
  
  export interface GameRound {
    roundId: string;
    prompt: string;
    responses: Map<string, PlayerResponse>;
    isComplete: boolean;
    startTime: string;
  }
  
  export interface RevealedResponses {
    roundId: string;
    prompt: string;
    responses: PlayerResponse[];
  }
  
  export interface GameStatus {
    totalPlayers: number;
    maxRealPlayers: number;
    hasAIPlayer: boolean;
    availableSlots: number;
  }
  
  export interface ErrorResponse {
    error: string;
    message: string;
  }
  
  export interface RegistrationSuccess {
    id: string;
    name: string;
  }
  
  export interface RoundStart {
    roundId: string;
    prompt: string;
  }
  
  export interface ResponseReceived {
    playerId: string;
    playerName: string;
  }
  
  export interface PlayerLeft {
    id: string;
  }
  
  export interface AIPlayerJoined {
    player: Player;
  }
  
  export interface ConnectionRejected {
    reason: string;
  }
  
  export interface CurrentRoundStatus {
    roundId: string;
    prompt: string;
    responseCount: number;
    isComplete: boolean;
  }