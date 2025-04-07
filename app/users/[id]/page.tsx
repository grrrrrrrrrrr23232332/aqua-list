import { redirect } from "next/navigation"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { Metadata } from 'next'
import { getUserById } from '@/lib/actions/user'

interface PageProps {
  params: {
    id: string
  }
}

async function getUserDiscordId(id: string) {
  try {
    // Check if the ID is a valid MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      // If not a valid ObjectId, assume it's already a Discord ID
      return id
    }

    const { db } = await connectToDatabase()
    const user = await db.collection("users").findOne({
      _id: new ObjectId(id),
    })

    if (!user) {
      return null
    }

    return user.discordId
  } catch (error) {
    console.error("Error fetching user:", error)
    return null
  }
}

export default async function UserProfileRedirect({ params }: PageProps) {
  const discordId = await getUserDiscordId(params.id)

  if (!discordId) {
    // Handle user not found
    return redirect("/users")
  }

  // Redirect to the Discord ID-based profile page
  return redirect(`/users/discord/${discordId}`)
}

// Generate metadata for user profile pages
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await getUserById(params.id)
  
  if (!user) {
    return {
      title: 'Profile Not Found - AquaList',
      description: 'The requested user profile could not be found.',
    }
  }

  const botCount = user.bots?.length || 0
  const description = `${user.username}'s profile on AquaList. Developer of ${botCount} Discord ${botCount === 1 ? 'bot' : 'bots'}.`

  return {
    title: `${user.username} - Developer Profile | AquaList`,
    description,
    openGraph: {
      title: `${user.username} - Discord Bot Developer`,
      description,
      images: [
        {
          url: user.avatarUrl || '/default-avatar.png',
          width: 512,
          height: 512,
          alt: `${user.username}'s Profile Picture`,
        }
      ],
      type: 'profile',
      profile: {
        username: user.username,
      },
    },
    twitter: {
      card: 'summary',
      title: `${user.username} - Discord Bot Developer`,
      description,
      images: [user.avatarUrl || '/default-avatar.png'],
    },
  }
}

