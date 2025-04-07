"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, X, ExternalLink, Loader2, Bot, AlertCircle, Clock, User, Hash, MessageSquare } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function PendingBots() {
  const [pendingBots, setPendingBots] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({})
  const [selectedBot, setSelectedBot] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchPendingBots()
  }, [])

  const fetchPendingBots = async () => {
    try {
      const response = await fetch("/api/admin/bots/pending")
      if (response.ok) {
        const data = await response.json()
        setPendingBots(data.bots)
        if (data.bots.length > 0) {
          setSelectedBot(data.bots[0]._id)
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch pending bots",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching pending bots:", error)
      toast({
        title: "Error",
        description: "Failed to fetch pending bots",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (botId: string) => {
    setActionLoading(botId)
    try {
      const response = await fetch(`/api/admin/bots/${botId}/approve`, {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bot has been approved",
          variant: "success",
        })
        // Remove the bot from the list
        setPendingBots(pendingBots.filter((bot) => bot._id !== botId))
        if (selectedBot === botId) {
          setSelectedBot(pendingBots.find(bot => bot._id !== botId)?._id || null)
        }
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to approve bot",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error approving bot:", error)
      toast({
        title: "Error",
        description: "Failed to approve bot",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (botId: string) => {
    if (!rejectionReason[botId] || rejectionReason[botId].trim() === "") {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      })
      return
    }

    setActionLoading(botId)
    try {
      const response = await fetch(`/api/admin/bots/${botId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: rejectionReason[botId],
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bot has been rejected",
          variant: "success",
        })
        // Remove the bot from the list
        setPendingBots(pendingBots.filter((bot) => bot._id !== botId))
        if (selectedBot === botId) {
          setSelectedBot(pendingBots.find(bot => bot._id !== botId)?._id || null)
        }
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to reject bot",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error rejecting bot:", error)
      toast({
        title: "Error",
        description: "Failed to reject bot",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReasonChange = (botId: string, reason: string) => {
    setRejectionReason({
      ...rejectionReason,
      [botId]: reason,
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (pendingBots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Pending Bots
          </CardTitle>
          <CardDescription>Review and approve bot submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-3 mb-4">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">All Clear!</h3>
            <p className="text-muted-foreground max-w-md">
              No pending bots to review at this time. New submissions will appear here for your approval.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedBotData = pendingBots.find(bot => bot._id === selectedBot) || pendingBots[0]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Pending Bots
              </CardTitle>
              <CardDescription>Review and approve bot submissions</CardDescription>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
              {pendingBots.length} Pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
            {/* Bot List Sidebar */}
            <div className="md:col-span-1 border-r">
              <ScrollArea className="h-[600px]">
                <div className="px-4 py-2 bg-muted/50">
                  <h3 className="text-sm font-medium">Submissions ({pendingBots.length})</h3>
                </div>
                <div className="divide-y">
                  {pendingBots.map((bot) => (
                    <div 
                      key={bot._id}
                      className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${selectedBot === bot._id ? 'bg-muted/50 border-l-2 border-primary' : ''}`}
                      onClick={() => setSelectedBot(bot._id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-full">
                          <AvatarImage src={bot.avatar || "/placeholder.svg"} alt={bot.name} />
                          <AvatarFallback>{bot.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{bot.name}</p>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                              Pending
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            by {bot.ownerUsername || "Unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(bot.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            {/* Bot Details */}
            <div className="md:col-span-2 lg:col-span-3">
              {selectedBotData && (
                <Tabs defaultValue="details" className="w-full">
                  <div className="px-6 pt-6 border-b">
                    <div className="flex items-center gap-4 mb-6">
                      <Avatar className="h-16 w-16 rounded-full">
                        <AvatarImage src={selectedBotData.avatar || "/placeholder.svg"} alt={selectedBotData.name} />
                        <AvatarFallback>{selectedBotData.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedBotData.name}</h2>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(selectedBotData.tags || []).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <TabsList className="w-full justify-start border-b pb-px mb-[-1px]">
                      <TabsTrigger value="details" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                        Details
                      </TabsTrigger>
                      <TabsTrigger value="review" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                        Review
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="details" className="p-6 space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Description</h3>
                        <p className="text-muted-foreground">{selectedBotData.description}</p>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              Client ID
                            </h4>
                            <p className="font-mono text-sm bg-muted p-2 rounded">{selectedBotData.clientId}</p>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              Prefix
                            </h4>
                            <p className="font-mono text-sm bg-muted p-2 rounded">{selectedBotData.prefix}</p>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              Submitted by
                            </h4>
                            <p className="text-sm">{selectedBotData.ownerUsername || "Unknown"}</p>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              Submitted on
                            </h4>
                            <p className="text-sm">{formatDate(selectedBotData.createdAt)}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium mb-1">Links</h4>
                          <div className="space-y-2">
                            {selectedBotData.website && (
                              <a
                                href={selectedBotData.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline p-2 bg-muted/50 rounded"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Website
                              </a>
                            )}
                            
                            {selectedBotData.supportServer && (
                              <a
                                href={selectedBotData.supportServer}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline p-2 bg-muted/50 rounded"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Support Server
                              </a>
                            )}
                            
                            {selectedBotData.inviteUrl && (
                              <a
                                href={selectedBotData.inviteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline p-2 bg-muted/50 rounded"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Invite URL
                              </a>
                            )}
                            
                            {!selectedBotData.website && !selectedBotData.supportServer && !selectedBotData.inviteUrl && (
                              <p className="text-sm text-muted-foreground italic">No links provided</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="review" className="p-6 space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 mb-6">
                      <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-amber-800 dark:text-amber-400">Review Guidelines</h3>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            Please verify that this bot follows our community guidelines before approving.
                            Check for appropriate content, functionality, and ensure it doesn't violate Discord's Terms of Service.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <Label htmlFor={`rejection-${selectedBotData._id}`} className="text-base font-medium">
                        Rejection Reason (required if rejecting)
                      </Label>
                      <Textarea
                        id={`rejection-${selectedBotData._id}`}
                        placeholder="Provide a detailed reason if you're rejecting this bot..."
                        value={rejectionReason[selectedBotData._id] || ""}
                        onChange={(e) => handleReasonChange(selectedBotData._id, e.target.value)}
                        className="min-h-[120px]"
                      />
                      <p className="text-sm text-muted-foreground">
                        This message will be sent to the bot owner if you reject the submission.
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button
                        onClick={() => handleApprove(selectedBotData._id)}
                        disabled={actionLoading === selectedBotData._id}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === selectedBotData._id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Approve Bot
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(selectedBotData._id)}
                        disabled={actionLoading === selectedBotData._id}
                        className="flex-1"
                      >
                        {actionLoading === selectedBotData._id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Reject Bot
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

