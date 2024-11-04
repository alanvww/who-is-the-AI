import type { Player } from '../types';
import { MAX_REAL_PLAYERS } from '../constants';

export class PlayerManager {
  private players: Map<string, Player>;
  private aiPlayer: Player | null;

  constructor() {
    this.players = new Map();
    this.aiPlayer = null;
  }

  canAddPlayer(): boolean {
    const realPlayerCount = this.getRealPlayerCount();
    return realPlayerCount < MAX_REAL_PLAYERS;
  }

  addPlayer(id: string, name: string): Player {
    const newPlayer: Player = {
      id,
      name,
      isAI: false,
      isReady: false,
      connected: true
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  initializeAIPlayer(): Player {
    const aiPlayer: Player = {
      id: 'ai-player',
      name: 'AI Player',
      isAI: true,
      isReady: true,
      connected: true
    };
    this.aiPlayer = aiPlayer;
    this.players.set(aiPlayer.id, aiPlayer);
    return aiPlayer;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  private getRealPlayerCount(): number {
    return Array.from(this.players.values()).filter(p => !p.isAI).length;
  }

  getAIPlayer(): Player | null {
    return this.aiPlayer;
  }

  hasAIPlayer(): boolean {
    return this.aiPlayer !== null;
  }

  updatePlayerStatus(id: string, isReady: boolean): void {
    const player = this.players.get(id);
    if (player) {
      player.isReady = isReady;
    }
  }
}