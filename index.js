import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { PrivyClient } from '@privy-io/server-auth';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Add CORS middleware - allows all origins for now
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Add basic security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Validate environment variables
if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_API_KEY) {
  console.error(
    'Missing required environment variables: PRIVY_APP_ID and PRIVY_API_KEY'
  );
  process.exit(1);
}

// Initialize Privy client with error handling
let privy;
try {
  privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_API_KEY);
  console.log('Privy client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Privy client:', error);
  process.exit(1);
}

// Send OTP to email using Privy
app.post('/send-login-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Use Privy's sendLoginCode method
    await privy.sendLoginCode({
      email: email.toLowerCase().trim(),
    });

    res.status(200).json({
      message: 'Login code sent successfully',
      email: email.toLowerCase().trim(),
    });
  } catch (error) {
    console.error('Error sending login code:', error);
    res.status(500).json({
      error: 'Failed to send login code',
      details:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
    });
  }
});

// Verify OTP and create user with wallet
app.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    // Verify the login code with Privy
    const authResult = await privy.verifyLoginCode({
      email: email.toLowerCase().trim(),
      code: code,
    });

    // Create or get user and ensure they have a Solana wallet
    const user = await privy.getOrCreateUserByEmail(email.toLowerCase().trim());

    // Check if user already has a Solana wallet, if not create one
    const hasWallet = user.linkedAccounts.some(
      (account) => account.type === 'wallet' && account.chainType === 'solana'
    );

    let updatedUser = user;
    if (!hasWallet) {
      updatedUser = await privy.linkWallet(user.id, {
        chainType: 'solana',
        createSmartWallet: true,
      });
    }

    res.status(200).json({
      message: 'Code verified and wallet created successfully',
      userId: updatedUser.id,
      user: updatedUser,
      wallet: updatedUser.linkedAccounts.find(
        (account) => account.type === 'wallet' && account.chainType === 'solana'
      ),
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(400).json({
      error: 'Invalid verification code',
      details:
        process.env.NODE_ENV === 'production'
          ? 'Verification failed'
          : error.message,
    });
  }
});

// User creation endpoint (without OTP)
app.post('/create-user', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    console.log('Creating user with email:', email.toLowerCase().trim());

    // Check if user already exists first
    let existingUser;
    try {
      existingUser = await privy.getUser({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(200).json({
          message: 'User already exists',
          user: existingUser,
        });
      }
    } catch (err) {
      // User doesn't exist, which is what we want for import
      console.log('User does not exist yet, proceeding with import');
    }

    const user = await privy.importUser({
      linkedAccounts: [
        {
          type: 'email',
          address: email.toLowerCase().trim(),
        },
      ],
      createSolanaWallet: true,
    });

    console.log('User created successfully:', user.id);

    res.status(200).json({
      message: 'User and wallet created successfully',
      user,
    });
  } catch (error) {
    console.error('Error creating user:', error);

    // Provide more detailed error information
    const errorDetails = {
      message: error.message,
      type: error.type || 'unknown_error',
      status: error.status || 500,
    };

    res.status(error.status || 500).json({
      error: 'Failed to create user and wallet',
      details:
        process.env.NODE_ENV === 'production'
          ? 'User creation failed'
          : errorDetails,
    });
  }
});

// Health check endpoint to verify Privy client setup
app.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Server is running',
    privyConfigured: !!(process.env.PRIVY_APP_ID && process.env.PRIVY_API_KEY),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Remove or secure debug endpoint for production
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug-env', (req, res) => {
    res.status(200).json({
      hasAppId: !!process.env.PRIVY_APP_ID,
      hasApiKey: !!process.env.PRIVY_API_KEY,
      appIdLength: process.env.PRIVY_APP_ID?.length,
      environment: process.env.NODE_ENV,
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
