import { NextResponse } from "next/server"

// In a real application, you would use a proper authentication system
// This is a simplified example for demonstration purposes
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // Validate credentials (this would connect to your database in a real app)
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 })
    }

    // Mock authentication - in a real app, you would verify against a database
    // and use a proper auth library like NextAuth.js
    if (email === "demo@example.com" && password === "password") {
      // Create a session or token
      return NextResponse.json(
        {
          success: true,
          user: {
            id: "1",
            email: "demo@example.com",
            username: "demouser",
          },
        },
        { status: 200 },
      )
    }

    // Authentication failed
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ message: "An error occurred during login" }, { status: 500 })
  }
}

