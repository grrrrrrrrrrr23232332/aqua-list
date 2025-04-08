import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../../auth/[...nextauth]/route"
import { connectToDatabase } from "@/lib/mongodb"
import { UserRole } from "@/lib/models/user"
import { sendDiscordNotification } from "@/lib/discord-api"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await connectToDatabase()

    const user = await db.collection("users").findOne({ discordId: session.user.discordId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const hasAccess =
      user.roles &&
      (user.roles.includes(UserRole.ADMIN) ||
        user.roles.includes(UserRole.BOT_REVIEWER) ||
        user.roles.includes(UserRole.BOT_FOUNDER))

    if (!hasAccess) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { reason, deleteBot } = await request.json()

    if (!reason || reason.trim() === "") {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    const bot = await db.collection("bots").findOne({
      clientId: params.id,
    })

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    if (deleteBot) {
         
      await db.collection("bots").deleteOne({ clientId: params.id })
    } else {
     
        await db.collection("bots").updateOne(
        { clientId: params.id },
        {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
            rejectedBy: session.user.discordId,
            rejectionReason: reason,
          },
        },
      )
    }

    
    try {
      await sendDiscordNotification({
        type: "bot_rejected",
        botId: bot.clientId,
        botName: bot.name,
        userId: bot.ownerId,
        username: bot.ownerUsername,
        reason: reason,
      })
    } catch (error) {
      console.error("Failed to send Discord notification:", error)
     
    }

    return NextResponse.json({
      message: deleteBot ? "Bot deleted successfully" : "Bot rejected successfully",
    })
  } catch (error) {
    console.error("Error rejecting bot:", error)
    return NextResponse.json({ error: "Failed to reject bot" }, { status: 500 })
  }
}

