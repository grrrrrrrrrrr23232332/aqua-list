import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import { connectToDatabase } from "@/lib/mongodb"
import { sendDiscordNotification } from "@/lib/discord-api"
import { ObjectId } from "mongodb"

// GET /api/bots/[id] - Get a specific bot
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    
    // Properly await params
    const botId = await params.id
    
    const bot = await db.collection("bots").findOne({
      clientId: botId
    })

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    return NextResponse.json(bot)
  } catch (error) {
    console.error("Error fetching bot:", error)
    return NextResponse.json({ error: "Failed to fetch bot" }, { status: 500 })
  }
}

// PUT /api/bots/[id] - Update a bot
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    // Properly await params
    const botId = await params.id

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const data = await request.json()

    // Find the bot using params directly
    const bot = await db.collection("bots").findOne({
      clientId: botId
    })

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Check if user is the owner
    const userId = session.user?.id || session.user?.discordId || session.user?.email || session.user?.name
    if (userId !== bot.ownerId) {
      return NextResponse.json({ error: "You don't have permission to update this bot" }, { status: 403 })
    }

    // Update bot
    const updateData = {
      prefix: data.prefix,
      description: data.description,
      longDescription: data.longDescription,
      tags: data.tags,
      website: data.website || "",
      supportServer: data.supportServer || "",
      githubRepo: data.githubRepo || "",
      updatedAt: new Date(),
    }

    await db.collection("bots").updateOne(
      { clientId: botId },
      { $set: updateData }
    )

    return NextResponse.json({ message: "Bot updated successfully" })
  } catch (error) {
    console.error("Error updating bot:", error)
    return NextResponse.json({ error: "Failed to update bot" }, { status: 500 })
  }
}

// DELETE /api/bots/[id] - Delete a bot
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await connectToDatabase()

    // Find the bot
    const bot = await db.collection("bots").findOne({
      _id: new ObjectId(params.id),
    })

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Check if user is the owner or an admin
    if (bot.ownerId !== session.user.discordId && !session.user.isAdmin) {
      return NextResponse.json({ error: "You don't have permission to delete this bot" }, { status: 403 })
    }

    // Delete bot
    await db.collection("bots").deleteOne({
      clientId: params.id
    })

    return NextResponse.json({
      message: "Bot deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting bot:", error)
    return NextResponse.json({ error: "Failed to delete bot" }, { status: 500 })
  }
}

