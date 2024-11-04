import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { io, Socket } from 'socket.io-client';
import { config } from './config';


interface Player {
  id: string;
  name: string;
  isAI: boolean;
  isReady: boolean;
}

interface Response {
  playerId: string;
  playerName: string;
  response: string;
  isAI: boolean;
}

interface GameResult {
  voteResults: {
    correct: number;
    total: number;
    aiPlayer: string;
  };
  responses: Response[];
}

type GameState = 'joining' | 'answering' | 'waiting' | 'voting' | 'finished';

const PROMPT = "What is your favorite food and why do you love it?";

const ChatApp = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>('joining');
  const [playerName, setPlayerName] = useState('');
  const [response, setResponse] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const serverUrl = config.getServerUrl();
    console.log('Connecting to server at:', serverUrl);
    
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('connection_rejected', (data) => {
      setError(data.reason);
    });

    newSocket.on('players_update', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('round_started', () => {
      setGameState('answering');
    });

    newSocket.on('response_received', ({ playerName }) => {
      console.log(`${playerName} submitted their response`);
    });

    newSocket.on('responses_revealed', ({ responses }) => {
      setResponses(responses);
      setGameState('voting');
    });

    newSocket.on('game_complete', (result: GameResult) => {
      setGameResult(result);
      setGameState('finished');
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoinGame = () => {
    if (!playerName.trim() || !socket) return;
    setIsLoading(true);

    socket.emit('register_player', playerName);
    socket.once('registration_successful', () => {
      socket.emit('start_round', PROMPT);
      setIsLoading(false);
    });
  };

  const handleSubmitResponse = () => {
    if (!response.trim() || !socket) return;
    setIsLoading(true);

    socket.emit('submit_response', response);
    setGameState('waiting');
    setIsLoading(false);
  };

  const handleVote = (playerId: string) => {
    if (!socket) return;
    setSelectedResponse(playerId);
    setIsLoading(true);

    socket.emit('submit_vote', {
      votedPlayerId: playerId,
      isAIGuess: true
    });

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 w-screen">
      <div className="max-w-4xl mx-auto">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Food Description Game</CardTitle>
            <CardDescription>
              {gameState === 'joining' && "Join the game and describe your favorite food"}
              {gameState === 'answering' && "Write your response to the prompt"}
              {gameState === 'waiting' && "Waiting for other players..."}
              {gameState === 'voting' && "Vote for which response you think was written by AI"}
              {gameState === 'finished' && "Game Results"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {gameState === 'joining' && (
              <div className="space-y-4">
                <Input
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
                <Button
                  onClick={handleJoinGame}
                  disabled={isLoading || !playerName.trim()}
                  className="w-full"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Join Game'}
                </Button>
              </div>
            )}


            {gameState === 'answering' && (
              <div className="space-y-4">
                <Alert>
                  <AlertTitle>Prompt:</AlertTitle>
                  <AlertDescription>{PROMPT}</AlertDescription>
                </Alert>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Players in game: {players.length}</p>
                </div>
                <Input
                  placeholder="Describe your favorite food..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  className="mb-4"
                />
                <Button
                  onClick={handleSubmitResponse}
                  disabled={isLoading || !response.trim()}
                  className="w-full"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Response'}
                </Button>
              </div>
            )}

            {gameState === 'waiting' && (
              <div className="text-center p-8">
                <Loader2 className="animate-spin mx-auto mb-4 h-8 w-8" />
                <p>Waiting for other players to respond...</p>
                <p className="text-sm text-gray-500 mt-2">
                  Responses received: {responses.length} / {players.length}
                </p>
              </div>
            )}

            {gameState === 'voting' && (
              <div className="space-y-4 w-full">
                <Alert>
                  <AlertTitle>Time to Vote!</AlertTitle>
                  <AlertDescription>
                    Read all responses and click on the one you think was written by the AI player.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4">
                  {responses.map((resp, index) => (
                    <Button
                      key={resp.playerId}
                      onClick={() => handleVote(resp.playerId)}
                      variant={selectedResponse === resp.playerId ? "secondary" : "outline"}
                      className="w-full text-left justify-start p-4 h-auto"
                      disabled={isLoading}
                    >
                      <div className="flex flex-col h-auto">
                        <div className="font-semibold mb-1 ">Response {index + 1}:</div>
                        <div className="text-sm"><p className='h-max w-auto'>{resp.response}</p></div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {gameState === 'finished' && gameResult && (
              <div className="space-y-4">
                <Alert className={
                  gameResult.voteResults.correct === gameResult.voteResults.total
                    ? "bg-green-50"
                    : "bg-orange-50"
                }>
                  <AlertTitle>Game Results</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">
                      {gameResult.voteResults.correct} out of {gameResult.voteResults.total} players
                      correctly identified the AI response!
                    </p>
                    <p className="mb-4">The AI player was: {gameResult.voteResults.aiPlayer}</p>

                    <div className="mt-4 space-y-4">
                      <h3 className="font-semibold">All Responses:</h3>
                      {gameResult.responses.map((resp) => (
                        <div
                          key={resp.playerId}
                          className={`p-4 rounded-lg ${resp.isAI ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                            }`}
                        >
                          <div className="font-semibold">
                            {resp.playerName} {resp.isAI ? '(AI)' : '(Human)'}:
                          </div>
                          <div className="mt-1">{resp.response}</div>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Play Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatApp;