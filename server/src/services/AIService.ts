import fetch from 'node-fetch';
import { OLLAMA_URL } from '../constants';

export class AIService {
  static async getResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama2',
          prompt: prompt,
          stream: false
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI request failed: ${response.statusText}`);
      }
      
      const data = await response.json() as { response: string };
      return data.response;
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'AI processing error';
    }
  }
}