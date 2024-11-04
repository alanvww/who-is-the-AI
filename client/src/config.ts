// config.ts or similar file
export const config = {
    nodeEnv: import.meta.env.VITE_NODE_ENV || 'development',
    serverPort: import.meta.env.VITE_SERVER_PORT || 3000,
    isDev: import.meta.env.DEV, // Built-in Vite env variable
    isProd: import.meta.env.PROD, // Built-in Vite env variable
    
    // Function to get the server URL
    getServerUrl: () => {
      if (import.meta.env.DEV) {
        // In development, use the current hostname (for network access)
        const hostname = window.location.hostname;
        const port = import.meta.env.VITE_SERVER_PORT || 3000;
        return `http://${hostname}:${port}`;
      }
      // In production, use the configured server URL
      return import.meta.env.VITE_SERVER_URL;
    }
  };