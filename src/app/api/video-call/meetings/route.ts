import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/video-call/db-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostId } = body
    
    if (!hostId) {
      console.error("Missing hostId in request:", body)
      return NextResponse.json({ error: "Host ID is required" }, { status: 400 })
    }
    
    console.log("Creating meeting for host:", hostId)
    const dbService = new DatabaseService()
    const meetingId = await dbService.createMeeting(hostId)
    
    console.log("Meeting created successfully:", meetingId)
    return NextResponse.json({ meetingId })
  } catch (error) {
    console.error("Error creating meeting:", error)
    return NextResponse.json({ 
      error: "Failed to create meeting", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const meetingId = request.nextUrl.searchParams.get("meetingId")
    
    if (!meetingId) {
      return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
    }
    
    const dbService = new DatabaseService()
    const participants = await dbService.getMeetingParticipants(meetingId)
    
    return NextResponse.json({ participants })
  } catch (error) {
    console.error("Error getting meeting participants:", error)
    return NextResponse.json({ 
      error: "Failed to get meeting participants",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}