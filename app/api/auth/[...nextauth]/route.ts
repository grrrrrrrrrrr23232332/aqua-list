import NextAuth from "next-auth"
import DiscordProvider from "next-auth/providers/discord"
import { connectToDatabase } from "@/lib/mongodb"
import { UserRole } from "@/lib/models/user"
import fs from "fs"
import path from "path"

// Load config directly
const configPath = path.join(process.cwd(), "config.json")
const configData = JSON.parse(fs.readFileSync(configPath, "utf8"))

// Configure NextAuth with Discord OAuth
export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: configData.discord.clientId,
      clientSecret: configData.discord.clientSecret,
      authorization: {
        params: {
          scope: "identify guilds guilds.join",
          redirect_uri: `${configData.nextAuth.url}/api/auth/callback/discord`,
        },
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.username,
          image: profile.avatar 
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` 
            : null,
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }: any) {
      // Persist the Discord access token to the token
      if (account) {
        token.accessToken = account.access_token
        token.discordId = profile.id
        
        // Remove email from token if it exists
        if (token.email) {
          delete token.email
        }
      }

      // Add user roles to token
      if (token.discordId) {
        try {
          const { db } = await connectToDatabase()
          const user = await db.collection("users").findOne({ discordId: token.discordId })

          if (user) {
            token.roles = user.roles || [UserRole.USER]
          } else {
            token.roles = [UserRole.USER]
          }
        } catch (error) {
          console.error("Error fetching user roles for token:", error)
          token.roles = [UserRole.USER]
        }
      }

      return token
    },
    async session({ session, token }: any) {
      // Send properties to the client
      session.accessToken = token.accessToken
      session.user.discordId = token.discordId
      session.user.roles = token.roles || [UserRole.USER]
      
      // Remove email from session if it exists
      if (session.user.email) {
        delete session.user.email
      }
      
      return session
    },
    async signIn({ user, account, profile }: any) {
      try {
        const { db } = await connectToDatabase()
 
        // Check if user exists
        const existingUser = await db.collection("users").findOne({ discordId: profile.id })

        // Try to add user to the Discord server
        if (account.access_token && configData.discord.serverId) {
          try {
            const response = await fetch(`https://discord.com/api/v10/guilds/${configData.discord.serverId}/members/${profile.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bot ${configData.discord.botToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                access_token: account.access_token,
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error(`Error adding user to Discord server: ${response.status}`, errorData);
              
              // If the user is already in the server, this is fine
              if (response.status !== 204 && response.status !== 201 && response.status !== 403) {
                // Only log non-success and non-already-member errors
                console.error(`Failed to add user to Discord server: ${response.status}`);
              }
            } else {
              console.log(`Successfully added user ${profile.username} (${profile.id}) to Discord server`);
            }
          } catch (error) {
            console.error("Error adding user to Discord server:", error);
            // Continue with login even if joining the server fails
          }
        }

        if (existingUser) {
          // Update user information - don't store email
          await db.collection("users").updateOne(
            { discordId: profile.id },
            {
              $set: {
                username: profile.username || user.name,
                avatar: profile.avatar
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                  : user.image,
                updatedAt: new Date(),
              },
            },
          )
        } else {
          // Create new user - don't store email
          await db.collection("users").insertOne({
            discordId: profile.id,
            username: profile.username || user.name,
            avatar: profile.avatar
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : user.image,
            roles: [UserRole.USER],
            bio: "",
            website: "",
            github: "",
            linkedin: "",
            twitter: "",
            isAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        return true
      } catch (error) {
        console.error("Error during sign in:", error)
        return false
      }
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: configData.nextAuth.secret,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

