import { initializeBotUser } from './botClient';

export const initializeApp = async () => {
  // Only run in development or when explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.INITIALIZE_BOT === 'true') {
    try {
      await initializeBotUser();
      console.log('Bot user initialized successfully');
    } catch (error) {
      console.error('Failed to initialize bot user:', error);
    }
  }
};

// Additional app initialization can be added here 