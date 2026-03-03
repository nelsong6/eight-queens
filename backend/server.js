import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { createGoogleAuth, requireOwner } from './middleware/google-auth.js';
import { fetchAppConfig } from './startup/app-config.js';
import { createRunRoutes } from './routes/runs.js';

const app = express();
const PORT = process.env.PORT || 3000;
let serverReady = false;

// Middleware that does NOT depend on async config
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

// Gate all requests (except startup probes) until async init completes.
app.use((req, res, next) => {
  if (serverReady) return next();
  res.status(503).json({ error: 'Server is starting up, please retry shortly.' });
});

async function startServer() {
  // Step 1: Fetch all config (App Configuration + Key Vault).
  const config = await fetchAppConfig();

  // Step 2: Build Google auth middleware.
  const requireAuth = createGoogleAuth({
    googleClientId: config.googleClientId,
    ownerEmail: config.ownerEmail,
  });

  // Step 3: Initialize Cosmos DB client.
  const DATABASE_NAME = process.env.COSMOS_DB_DATABASE_NAME || 'EightQueensDB';
  const CONTAINER_NAME = process.env.COSMOS_DB_CONTAINER_NAME || 'runs';

  let container;
  try {
    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({
      endpoint: config.cosmosDbEndpoint,
      aadCredentials: credential,
    });

    const database = client.database(DATABASE_NAME);
    container = database.container(CONTAINER_NAME);
    console.log('Connected to Cosmos DB using Azure Identity');
  } catch (error) {
    console.error('Failed to connect to Cosmos DB:', error);
    process.exit(1);
  }

  // Step 4: Health check.
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: DATABASE_NAME,
      container: CONTAINER_NAME,
    });
  });

  // Step 5: Mount API routes.
  app.use(createRunRoutes({ container, requireAuth, requireOwner }));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  console.log(`Database: ${DATABASE_NAME}`);
  console.log(`Container: ${CONTAINER_NAME}`);
  serverReady = true;
  console.log('Server ready');
}

// Listen immediately so Azure startup probes pass while async init runs.
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}, initializing...`);
});

startServer().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});

export default app;
