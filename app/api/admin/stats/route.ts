import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import { connectToDatabase } from "@/lib/mongodb"
import { UserRole } from "@/lib/models/user"

// GET /api/admin/stats - Get admin dashboard statistics
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
        user.roles.includes(UserRole.BOT_FOUNDER) ||
        user.roles.includes(UserRole.SUPPORT))

    if (!hasAccess) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get counts
    const usersCount = await db.collection("users").countDocuments()
    const botsCount = await db.collection("bots").countDocuments({ status: "approved" })
    const pendingBotsCount = await db.collection("bots").countDocuments({ status: "pending" })
    const votesCount = await db.collection("votes").countDocuments()

    // Get bot categories
    const botCategories = await db
      .collection("bots")
      .aggregate([
        { $match: { status: "approved" } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, name: "$_id", count: 1 } },
      ])
      .toArray()

    // Get recent activity (simplified example)
    const recentActivity = [
      {
        type: "Bot Approved",
        description: "Bot 'MusicMaster' was approved",
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        type: "Bot Submitted",
        description: "New bot 'ModeratorPro' was submitted",
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      },
      {
        type: "User Joined",
        description: "New user 'DiscordFan123' joined",
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
      },
    ]

    return NextResponse.json({
      users: usersCount,
      bots: botsCount,
      pendingBots: pendingBotsCount,
      votes: votesCount,
      botCategories,
      recentActivity,
    })
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    return NextResponse.json({ error: "Failed to fetch admin stats" }, { status: 500 })
  }
}

