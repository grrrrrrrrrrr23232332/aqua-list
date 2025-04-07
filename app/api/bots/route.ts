import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { connectToDatabase } from "@/lib/mongodb"
import { getUserInfo } from "@/lib/discord-api"
import { sendDiscordNotification } from "@/lib/discord-api"

// GET /api/bots - Get all bots
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || ""
    const tag = searchParams.get("tag") || ""
    const sort = searchParams.get("sort") || "newest"
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    const { db } = await connectToDatabase()

    // Build query
    const filter: any = { status: "approved" }
    if (query) {
      filter.$or = [{ name: { $regex: query, $options: "i" } }, { description: { $regex: query, $options: "i" } }]
    }
    if (tag) {
      filter.tags = tag
    }

    // Build sort
    let sortOptions: any = {}
    switch (sort) {
      case "popular":
        sortOptions = { votes: -1 }
        break
      case "servers":
        sortOptions = { servers: -1 }
        break
      case "newest":
      default:
        sortOptions = { createdAt: -1 }
    }

    // Execute query
    const bots = await db
      .collection("bots")
      .find(filter)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    const total = await db.collection("bots").countDocuments(filter)

    return NextResponse.json({
      bots,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching bots:", error)
    return NextResponse.json({ error: "Failed to fetch bots" }, { status: 500 })
  }
}


const galaxyApiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000;


async function fetchGalaxyBotData(botId: string) {

  const cachedData = galaxyApiCache.get(botId);
  if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
    return cachedData.data;
  }
  
  try {
    const response = await fetch(`https://galaxy-api-gets.vercel.app/bot/${botId}`);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Store in cache
    galaxyApiCache.set(botId, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  } catch (error) {
    console.error("Error fetching from Galaxy API:", error);
    return null;
  }
}

async function fetchBotData(botId: string) {
  try {
    const response = await fetch(`https://galaxy-api-gets.vercel.app/bot/${botId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch bot data')
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching from Galaxy API:", error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const data = await request.json()

    // Validate required fields
    if (!data.clientId || !data.description || !data.longDescription || !data.prefix) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create bot document
    const bot = {
      ...data,
      ownerId: (session.user as any).id,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.collection("bots").insertOne(bot)

    return NextResponse.json({ success: true, bot }, { status: 201 })
  } catch (error) {
    console.error("Error submitting bot:", error)
    return NextResponse.json(
      { error: "Failed to submit bot" }, 
      { status: 500 }
    )
  }
}

