import { MongoClient, type Db } from "mongodb";

import type { Bindings } from "./env";

let clientPromise: Promise<MongoClient> | null = null;

function getMongoUri(env: Bindings): string {
  const uri = env.MONGO_URI || env.MONGO_DB_SERVER;
  if (!uri)
    throw new Error(
      "Missing MongoDB connection string (MONGO_URI/MONGO_DB_SERVER)",
    );
  return uri;
}

export async function getDb(env: Bindings): Promise<Db> {
  if (!clientPromise) {
    const uri = getMongoUri(env);
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db();
}
