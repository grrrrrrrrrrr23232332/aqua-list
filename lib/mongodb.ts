import { MongoClient } from "mongodb"
import fs from "fs"
import path from "path"

// Read MongoDB URI from config.json
let uri: string
try {
  const configPath = path.join(process.cwd(), "config.json")
  const configData = JSON.parse(fs.readFileSync(configPath, "utf8"))
  
  if (configData.mongodb && configData.mongodb.uri) {
    uri = configData.mongodb.uri
  } else {
    throw new Error("MongoDB URI not found in config.json")
  }
} catch (error) {
  throw new Error("Failed to load MongoDB URI from config.json: " + (error as Error).message)
}

const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

export async function connectToDatabase() {
  const client = await clientPromise
  const db = client.db("AquaList")  // Using the database name from your config
  return { client, db }
}

export default clientPromise

