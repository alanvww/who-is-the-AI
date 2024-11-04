import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { PlayerManager } from './src/services/PlayerManager';

// Constants
const MAX_REAL_PLAYERS = 16;
const DEFAULT_PORT = 3000;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

// CORS Configuration
const getAllowedOrigins = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'development') {
    // In development, allow both localhost and IP-based connections
    return [
      'http://localhost:5173',    // Vite default
      'http://127.0.0.1:5173',   // Localhost IP
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/,  // Local network IPs
      /^http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/,  // Docker network
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/    // Other private networks
    ];
  }

  // In production, use your production domain
  return ['https://your-production-domain.com'];
};

// Types
interface Player {
  id: string;
  name: string;
  isAI: boolean;
  isReady: boolean;
  connected: boolean;
}

interface PlayerResponse {
  playerId: string;
  playerName: string;
  response: string;
  timestamp: string;
  isAI: boolean;
}

interface PlayerVote {
  voterId: string;
  votedPlayerId: string;
  isAIGuess: boolean;
}

interface GameRound {
  roundId: string;
  prompt: string;
  responses: Map<string, PlayerResponse>;
  votes: Map<string, PlayerVote>;
  isComplete: boolean;
  startTime: string;
}

// AI Service
class AIService {
  static async getResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1',
          prompt: `As an AI player pretending to be a human player in a game where the human players will try to identify the AI among them, please provide a short, simple, discussion group style, 1 sentence response to this prompt: ${prompt}.`,
          stream: false
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI request failed: ${response.statusText}`);
      }
      
      const data = await response.json() as { response: string };
      return data.response.trim();
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'I love pizza with extra cheese and crispy crust.';
    }
  }
}

// Game Manager with voting functionality
class GameManager {
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
      votes: new Map(),
      isComplete: false,
      startTime: new Date().toISOString()
    };

    // Get AI response immediately
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

  addVote(voterId: string, votedPlayerId: string, isAIGuess: boolean): void {
    if (!this.currentRound) throw new Error('No active round');
    
    this.currentRound.votes.set(voterId, {
      voterId,
      votedPlayerId,
      isAIGuess
    });
  }

  getCurrentRound(): GameRound | null {
    return this.currentRound;
  }

  checkRoundComplete(): boolean {
    if (!this.currentRound) return false;
    const activePlayers = this.playerManager.getAllPlayers();
    const expectedResponses = activePlayers.length;
    return this.currentRound.responses.size >= expectedResponses;
  }

  checkVotingComplete(): boolean {
    if (!this.currentRound) return false;
    const humanPlayers = this.playerManager.getAllPlayers().filter(p => !p.isAI);
    return this.currentRound.votes.size >= humanPlayers.length;
  }

  getVoteResults(): { correct: number; total: number; aiPlayer: string } {
    if (!this.currentRound) throw new Error('No active round');

    const aiPlayer = this.playerManager.getAIPlayer();
    if (!aiPlayer) throw new Error('No AI player found');

    const votes = Array.from(this.currentRound.votes.values());
    const correctVotes = votes.filter(vote => 
      (vote.votedPlayerId === aiPlayer.id && vote.isAIGuess) ||
      (vote.votedPlayerId !== aiPlayer.id && !vote.isAIGuess)
    );

    return {
      correct: correctVotes.length,
      total: votes.length,
      aiPlayer: aiPlayer.name
    };
  }

  completeRound(): {
    roundId: string;
    prompt: string;
    responses: PlayerResponse[];
    voteResults: { correct: number; total: number; aiPlayer: string };
  } | null {
    if (!this.currentRound) return null;

    const responses = Array.from(this.currentRound.responses.values());
    const voteResults = this.getVoteResults();

    this.currentRound.isComplete = true;
    return {
      roundId: this.currentRound.roundId,
      prompt: this.currentRound.prompt,
      responses,
      voteResults
    };
  }

  resetRound(): void {
    this.currentRound = null;
  }
}

// Express and Socket.IO setup
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if the origin matches any of our allowed origins
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return allowedOrigin === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`Origin ${origin} not allowed by CORS`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

// Initialize managers
const playerManager = new PlayerManager();
const gameManager = new GameManager(playerManager);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin
    if (!origin) {
      return callback(null, true);
    }

    // Check if the origin matches any of our allowed origins
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  console.log('Client connected from:', socket.handshake.headers.origin);

  if (!playerManager.canAddPlayer() && !playerManager.getPlayer(socket.id)) {
    socket.emit('connection_rejected', { reason: 'Server is full' });
    socket.disconnect(true);
    return;
  }

  socket.on('register_player', (playerName: string) => {
    if (!playerManager.getPlayer(socket.id)) {
      const newPlayer = playerManager.addPlayer(socket.id, playerName);
      
      // Add AI player if this is the first real player
      if (playerManager.getAllPlayers().length === 1) {
        const aiPlayer = playerManager.initializeAIPlayer();
        io.emit('ai_player_joined', { player: aiPlayer });
      }

      io.emit('players_update', playerManager.getAllPlayers());
      socket.emit('registration_successful', { id: socket.id, name: playerName });
    }
  });

  socket.on('start_round', async (prompt: string) => {
    try {
      const roundId = await gameManager.startNewRound(prompt);
      io.emit('round_started', { roundId, prompt });
    } catch (error) {
      socket.emit('error', { message: 'Failed to start round' });
    }
  });

  socket.on('submit_response', async (response: string) => {
    try {
      const player = playerManager.getPlayer(socket.id);
      if (!player) return;

      const playerResponse: PlayerResponse = {
        playerId: player.id,
        playerName: player.name,
        response: response,
        timestamp: new Date().toISOString(),
        isAI: player.isAI
      };

      gameManager.addResponse(player.id, playerResponse);
      io.emit('response_received', {
        playerId: player.id,
        playerName: player.name
      });

      if (gameManager.checkRoundComplete()) {
        const responses = Array.from(gameManager.getCurrentRound()?.responses.values() ?? []);
        io.emit('responses_revealed', { responses });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to submit response' });
    }
  });

  socket.on('submit_vote', ({ votedPlayerId, isAIGuess }) => {
    try {
      gameManager.addVote(socket.id, votedPlayerId, isAIGuess);
      
      if (gameManager.checkVotingComplete()) {
        const roundResult = gameManager.completeRound();
        if (roundResult) {
          io.emit('game_complete', roundResult);
          gameManager.resetRound();
        }
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to submit vote' });
    }
  });

  socket.on('disconnect', () => {
    const player = playerManager.getPlayer(socket.id);
    if (player && !player.isAI) {
      playerManager.removePlayer(socket.id);
      io.emit('player_left', { id: socket.id });
      io.emit('players_update', playerManager.getAllPlayers());
    }
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  console.error('Origin:', req.headers.origin);
  res.status(500).json({ 
    error: 'Server error', 
    message: err.message,
    // Don't send stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_PORT;
const host = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

httpServer.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
  console.log(`Maximum players: ${MAX_REAL_PLAYERS} real + 1 AI player`);
  console.log('Allowed origins:', getAllowedOrigins());
  console.log('NODE_ENV:', process.env.NODE_ENV);
});

export default app;