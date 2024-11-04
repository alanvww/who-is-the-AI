import { v4 as uuidv4 } from 'uuid';
import type { Player, PlayerResponse, GameRound, RevealedResponses } from '../types';
import { AIService } from './AIService';
import type { PlayerManager } from './PlayerManager';

export class GameManager {
  private currentRound: GameRound | null = null;
  private playerManager: PlayerManager;

  constructor(playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  async startNewRound(prompt: string): Promise<string> {
    const roundId = uuidv4();
    this.currentRound = {
      roundId,
      prompt,
      responses: new Map(),
      isComplete: false,
      startTime: new Date().toISOString()
    };

    // Automatically get AI response
    if (this.playerManager.hasAIPlayer()) {
      const aiResponse = await AIService.getResponse(prompt);
      const aiPlayer = this.playerManager.getAIPlayer();
      if (aiPlayer) {
        this.addResponse(aiPlayer.id, {
          playerId: aiPlayer.id,
          playerName: aiPlayer.name,
          response: aiResponse,
          timestamp: new Date().toISOString(),
          isAI: true
        });
      }
    }

    return roundId;
  }

  addResponse(playerId: string, response: PlayerResponse): void {
    if (!this.currentRound || this.currentRound.isComplete) {
      throw new Error('No active round or round is complete');
    }
    this.currentRound.responses.set(playerId, response);
  }

  getCurrentRound(): GameRound | null {
    return this.currentRound;
  }

  checkRoundComplete(): boolean {
    if (!this.currentRound) return false;

    const activePlayers = this.playerManager.getAllPlayers();
    const expectedResponses = activePlayers.length;
    const actualResponses = this.currentRound.responses.size;

    return actualResponses >= expectedResponses;
  }

  completeRound(): RevealedResponses | null {
    if (!this.currentRound) return null;

    const responses = Array.from(this.currentRound.responses.values());
    const revealed: RevealedResponses = {
      roundId: this.currentRound.roundId,
      prompt: this.currentRound.prompt,
      responses: responses
    };

    this.currentRound.isComplete = true;
    return revealed;
  }

  resetRound(): void {
    this.currentRound = null;
  }
}
