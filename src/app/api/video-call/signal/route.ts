import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/video-call/db-service"


const connectedClients: Map<string, { controller: ReadableStreamDefaultController }> = new Map()

export async function POST(request: NextRequest) {
    const data = await request.json()
    const { type, from, to, offer, answer, candidate, meetingId, enabled } = data
  
    switch (type) {
      case "join-meeting":
          const dbService = new DatabaseService();
          try {
              const isActive = await dbService.isMeetingActive(meetingId);
      
              if (!isActive) {
                  console.error(`Meeting ${meetingId} does not exist`);
                  return NextResponse.json({ error: "Meeting does not exist" }, { status: 404 });
              }
      
              // Update this line to handle the new return type
              const participant = await dbService.joinMeeting(meetingId, from);
      
              const participants = await dbService.getMeetingParticipants(meetingId);
      
              console.log(`Participants in meeting ${meetingId}:`, participants);
      
              for (const participantId of participants) {
                  if (participantId !== from && connectedClients.has(participantId)) {
                      const client = connectedClients.get(participantId);
                      if (client?.controller) {
                          console.log(`Notifying ${participantId} of new user ${from}`);
                          client.controller.enqueue(
                              "data: " + JSON.stringify({
                                  type: "user-joined",
                                  userId: from,
                                  meetingId,
                              }) + '\n\n'
                          );
                      }
                  }
              }
      
              return NextResponse.json({
                  success: true,
                  participants: participants.filter((p) => p !== from),
              });
          } catch (error) {
              console.error("Error in join-meeting:", error);
              return NextResponse.json({ error: "Failed to join meeting" }, { status: 500 });
          }
  
    case 'video-toggle':
    case 'audio-toggle':
      if (to && connectedClients.has(to)) {
        const targetClient = connectedClients.get(to);
        if (targetClient?.controller) {
          targetClient.controller.enqueue(
            "data: " + JSON.stringify({
              type,
              from,
              enabled,
            }) + '\n\n'
          );
        }
      } else if (meetingId) {
        const dbService = new DatabaseService();
        const participants = await dbService.getMeetingParticipants(meetingId);
        for (const participantId of participants) {
          if (participantId !== from && connectedClients.has(participantId)) {
            const client = connectedClients.get(participantId);
            if (client?.controller) {
              client.controller.enqueue(
                "data: " + JSON.stringify({
                  type,
                  from,
                  enabled,
                }) + '\n\n'
              );
            }
          }
        }
      }
      return NextResponse.json({ success: true });
      case "offer":
        if (connectedClients.has(to)) {
          const targetClient = connectedClients.get(to)
          if (targetClient?.controller) {
            targetClient.controller.enqueue(
              "data: " + JSON.stringify({
                type: "offer",
                from,
                offer,
              }) + '\n\n'
            )
          }
        }
        return NextResponse.json({ success: true })
  
      case "answer":
        if (connectedClients.has(to)) {
          const targetClient = connectedClients.get(to)
          if (targetClient?.controller) {
            targetClient.controller.enqueue(
              "data: " + JSON.stringify({
                type: "answer",
                from,
                answer,
              }) + '\n\n'
            )
          }
        }
        return NextResponse.json({ success: true })
  
      case "ice-candidate":
        if (connectedClients.has(to)) {
          const targetClient = connectedClients.get(to)
          if (targetClient?.controller) {
            targetClient.controller.enqueue(
              "data: " + JSON.stringify({
                type: "ice-candidate",
                from,
                candidate,
              }) + '\n\n'
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
                  "data: " + JSON.stringify({
                    type: "user-left",
                    userId: from,
                    meetingId,
                  }) + '\n\n'
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
    const userId = request.nextUrl.searchParams.get("userId");
  
    if (!userId) {
      console.error("User ID missing in GET request");
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
  
    console.log(`Setting up EventSource stream for user: ${userId}`);
  
    const stream = new ReadableStream({
      start(controller) {
        connectedClients.set(userId, { controller });
  
        // Proper SSE format: "data: " + JSON + "\n\n"
        controller.enqueue(
          "data: " + JSON.stringify({
            type: "connected",
            userId,
            timestamp: new Date().toISOString(),
          }) + "\n\n"
        );
  
        request.signal.addEventListener("abort", () => {
          console.log(`Client disconnected: ${userId}`);
          connectedClients.delete(userId);
        });
      },
    });
  
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
}