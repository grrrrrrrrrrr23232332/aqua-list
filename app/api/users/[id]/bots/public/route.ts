import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Await params before accessing its properties
    const paramsResolved = await params
    const id = paramsResolved.id

    const { db } = await connectToDatabase()
    
    // Fetch approved bots owned by the user
    const bots = await db
      .collection("bots")
      .find({ 
        ownerId: id,
        status: "approved" 
      })
      .sort({ createdAt: -1 })
      .toArray()
    
    return NextResponse.json({ bots })
  } catch (error) {
    console.error("Error fetching user bots:", error)
    return NextResponse.json({ error: "Failed to fetch bots" }, { status: 500 })
  }
} 