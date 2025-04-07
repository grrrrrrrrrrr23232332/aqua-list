import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const { searchParams } = request.nextUrl
    
    const query = searchParams.get("query")
    const sort = searchParams.get("sort") || "newest"
    const filter = searchParams.get("filter") || "all"
    
    // Build MongoDB query
    const mongoQuery: any = {}
    
    if (query) {
      mongoQuery.username = { $regex: query, $options: "i" }
    }
    
    if (filter === "verified") {
      mongoQuery.isVerified = true
    } else if (filter === "admin") {
      mongoQuery.isAdmin = true
    } else if (filter === "botDev") {
      // We'll handle this with aggregation
    }
    
    // Determine sort order
    let sortOptions: any = { createdAt: -1 } // default to newest
    
    if (sort === "oldest") {
      sortOptions = { createdAt: 1 }
    } else if (sort === "reputation") {
      sortOptions = { reputation: -1 }
    }
    
    // Execute query
    let users = await db.collection("users").find(mongoQuery).sort(sortOptions).limit(50).toArray()
    
    // Get bot counts for each user
    const userIds = users.map((user: any) => user.discordId)
    const botCounts = await db
      .collection("bots")
      .aggregate([
        { $match: { ownerId: { $in: userIds }, status: "approved" } },
        { $group: { _id: "$ownerId", count: { $sum: 1 } } },
      ])
      .toArray()
    
    // Create a map of user IDs to bot counts
    const botCountMap = botCounts.reduce((map: any, item: any) => {
      map[item._id] = item.count
      return map
    }, {})
    
    // Add bot counts to users
    users = users.map((user: any) => ({
      ...user,
      id: user._id.toString(),
      botCount: botCountMap[user.discordId] || 0,
    }))
    
    // If filter is botDev, filter users with at least one bot
    if (filter === "botDev") {
      users = users.filter((user: any) => user.botCount > 0)
    }
    
    // If sort is by bots, sort by bot count
    if (sort === "bots") {
      users.sort((a: any, b: any) => b.botCount - a.botCount)
    }
    
    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
} 