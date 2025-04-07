import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../auth/[...nextauth]/route"
import { connectToDatabase } from "@/lib/mongodb"
import { UserRole } from "@/lib/models/user"

// GET /api/admin/bots/pending - Get all pending bots
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await connectToDatabase()

    // Get user to check roles
    const user = await db.collection("users").findOne({ discordId: session.user.discordId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has admin, bot_reviewer, or founder role
    const hasAccess =
      user.roles &&
      (user.roles.includes(UserRole.ADMIN) ||
        user.roles.includes(UserRole.BOT_REVIEWER) ||
        user.roles.includes(UserRole.BOT_FOUNDER))

    if (!hasAccess) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get all pending bots
    const bots = await db.collection("bots").find({ status: "pending" }).sort({ createdAt: -1 }).toArray()

    return NextResponse.json({ bots })
  } catch (error) {
    console.error("Error fetching pending bots:", error)
    return NextResponse.json({ error: "Failed to fetch pending bots" }, { status: 500 })
  }
}

