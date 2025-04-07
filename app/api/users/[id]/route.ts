import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// GET /api/users/[id] - Get a specific user
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Await params before accessing its properties
    const paramsResolved = await params
    const id = paramsResolved.id

    const { db } = await connectToDatabase()

    // Query by discordId instead of _id
    const user = await db.collection("users").findOne({
      discordId: id
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await connectToDatabase()

    // Find the user
    const user = await db.collection("users").findOne({
      _id: new ObjectId(params.id),
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if the user is updating their own profile or is an admin
    if (user.discordId !== session.user.discordId && !session.user.isAdmin) {
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
    if (session.user.isAdmin) {
      if (data.isAdmin !== undefined) {
        updateData.isAdmin = data.isAdmin
      }
    }

    await db.collection("users").updateOne({ _id: new ObjectId(params.id) }, { $set: updateData })

    return NextResponse.json({
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

