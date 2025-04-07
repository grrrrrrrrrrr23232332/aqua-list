import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../auth/[...nextauth]/route"
import { connectToDatabase } from "@/lib/mongodb"
import { getUserDiscordRoles } from "@/lib/discord-api"

// GET /api/users/discord/[discordId] - Get a user by Discord ID
export async function GET(request: Request, { params }: { params: { discordId: string } }) {
  try {
    const { db } = await connectToDatabase()

    const user = await db.collection("users").findOne({
      discordId: params.discordId,
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get Discord server roles if configured
    let discordRoles = user.discordRoles || []

    // If we have a Discord server ID in the environment, fetch fresh roles
    if (process.env.DISCORD_SERVER_ID) {
      try {
        const roles = await getUserDiscordRoles(params.discordId, process.env.DISCORD_SERVER_ID)
        if (roles) {
          discordRoles = roles

          // Update the user's Discord roles in the database
          await db.collection("users").updateOne({ discordId: params.discordId }, { $set: { discordRoles: roles } })
        }
      } catch (error) {
        console.error("Error fetching Discord roles:", error)
      }
    }

    // Remove sensitive information
    const { password, ...safeUser } = user

    return NextResponse.json({
      ...safeUser,
      discordRoles,
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

// PUT /api/users/discord/[discordId] - Update a user by Discord ID
export async function PUT(request: Request, { params }: { params: { discordId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await connectToDatabase()

    // Find the user
    const user = await db.collection("users").findOne({
      discordId: params.discordId,
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if the user is updating their own profile or is an admin
    if (user.discordId !== session.user.discordId && !session.user.roles?.includes("admin")) {
      return NextResponse.json({ error: "You don't have permission to update this user" }, { status: 403 })
    }

    const data = await request.json()

    // Only allow updating certain fields
    const updateData: any = {
      bio: data.bio,
      website: data.website,
      github: data.github,
      linkedin: data.linkedin,
      twitter: data.twitter,
      updatedAt: new Date(),
    }

    // If admin, allow updating more fields
    if (session.user.roles?.includes("admin")) {
      if (data.isAdmin !== undefined) {
        updateData.isAdmin = data.isAdmin
      }

      if (data.roles !== undefined) {
        updateData.roles = data.roles
      }
    }

    await db.collection("users").updateOne({ discordId: params.discordId }, { $set: updateData })

    return NextResponse.json({
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

