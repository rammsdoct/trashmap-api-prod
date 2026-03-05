// cosmos.js
import { CosmosClient } from "@azure/cosmos";

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

export const db = client.database(process.env.COSMOS_DB);
export const reportsContainer = db.container(process.env.COSMOS_REPORTS_CONTAINER || "reports");
export const usersContainer = db.container(process.env.COSMOS_USERS_CONTAINER || "users");