import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/video-call/db-service"


const connectedClients: Map<string, { controller: ReadableStreamDefaultController }> = new Map()

export async function POST(request: NextRequest) {
  const data = await request.json()
  const { type, from, to, offer, answer, candidate, meetingId } = data

  switch (type) {
    case "join-meeting":
      const dbService = new DatabaseService()
      try {
        const isActive = await dbService.isMeetingActive(meetingId)
        
        if (!isActive) {
          return NextResponse.json({ error: "Meeting is not active" }, { status: 404 })
        }
        
        await dbService.joinMeeting(meetingId, from)
        
        const participants = await dbService.getMeetingParticipants(meetingId)
        
        for (const participantId of participants) {
          if (participantId !== from && connectedClients.has(participantId)) {
            const client = connectedClients.get(participantId)
            if (client?.controller) {
              client.controller.enqueue(
                JSON.stringify({
                  type: "user-joined",
                  userId: from,
                  meetingId,
                })
              )
            }
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          participants: participants.filter(p => p !== from)  // Return other participants
        })
      } catch (error) {
        console.error("Error in join-meeting:", error)
        return NextResponse.json({ error: "Failed to join meeting" }, { status: 500 })
      }

    case "offer":
      if (connectedClients.has(to)) {
        const targetClient = connectedClients.get(to)
        if (targetClient?.controller) {
          targetClient.controller.enqueue(
            JSON.stringify({
              type: "offer",
              from,
              offer,
            })
          )
        }
      }
      return NextResponse.json({ success: true })

    case "answer":
      if (connectedClients.has(to)) {
        const targetClient = connectedClients.get(to)
        if (targetClient?.controller) {
          targetClient.controller.enqueue(
            JSON.stringify({
              type: "answer",
              from,
              answer,
            })
          )
        }
      }
      return NextResponse.json({ success: true })

    case "ice-candidate":
      if (connectedClients.has(to)) {
        const targetClient = connectedClients.get(to)
        if (targetClient?.controller) {
          targetClient.controller.enqueue(
            JSON.stringify({
              type: "ice-candidate",
              from,
              candidate,
            })
          )
        }
      }
      return NextResponse.json({ success: true })

    case "leave-meeting":
      try {
        const db = new DatabaseService()
        await db.leaveMeeting(meetingId, from)

        const participants = await db.getMeetingParticipants(meetingId)
        
        for (const participantId of participants) {
          if (participantId !== from && connectedClients.has(participantId)) {
            const client = connectedClients.get(participantId)
            if (client?.controller) {
              client.controller.enqueue(
                JSON.stringify({
                  type: "user-left",
                  userId: from,
                  meetingId,
                })
              )
            }
          }
        }
        
        return NextResponse.json({ success: true })
      } catch (error) {
        console.error("Error in leave-meeting:", error)
        return NextResponse.json({ error: "Failed to leave meeting" }, { status: 500 })
      }

    default:
      return NextResponse.json({ error: "Invalid signal type" }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 })
  }

  const stream = new ReadableStream({
    start(controller) {
      connectedClients.set(userId, { controller })

      controller.enqueue(
        JSON.stringify({
          type: "connected",
          userId,
          timestamp: new Date().toISOString(),
        })
      )

      request.signal.addEventListener("abort", () => {
        connectedClients.delete(userId)
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}