export interface Vote {
  id: string
  botId: string
  userId: string
  createdAt: Date
  expiresAt: Date // When the user can vote again (typically 12 hours later)
}

