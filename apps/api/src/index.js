import { createAppServer } from "./server.js";
import { loadDotEnv } from "../../../scripts/load-env.js";

loadDotEnv();

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.API_PORT || 3000);

const server = createAppServer();
server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`API running at http://${host}:${port}`);
});
