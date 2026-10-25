import { analytics, createApp, genie, lakebase, server } from '@databricks/appkit';
import { setupFraudOpsRoutes } from './routes/reviews';

const lakebaseEnabled = Boolean(process.env.PGHOST || process.env.LAKEBASE_ENDPOINT);
const genieSpaceId = process.env.DATABRICKS_GENIE_SPACE_ID;

createApp({
  plugins: [
    analytics(),
    ...(lakebaseEnabled ? [lakebase()] : []),
    server(),
    ...(genieSpaceId ? [genie({ spaces: { default: genieSpaceId } })] : []),
  ],
  async onPluginsReady(appkit) {
    await setupFraudOpsRoutes(appkit);
  },
}).catch(console.error);
