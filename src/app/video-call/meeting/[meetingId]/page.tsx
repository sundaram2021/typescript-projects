"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Users, LayoutGrid, Settings, Share2, Copy 
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { WebRTCService } from "@/lib/video-call/webrtc-service"
import { v4 as uuidv4 } from 'uuid'
import { Toaster, toast } from 'sonner'

interface Participant {
  id: string
  name: string
  isCurrentUser: boolean
  stream?: MediaStream
}

export default function MeetingRoom() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.meetingId as string
  const userId = useRef(localStorage.getItem('userId') || uuidv4()).current
  const webRTCServiceRef = useRef<WebRTCService | null>(null)
  
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([
    { id: userId, name: "You", isCurrentUser: true }
  ])

  useEffect(() => {
    localStorage.setItem('userId', userId)
    
    const webRTCService = new WebRTCService(userId)
    webRTCServiceRef.current = webRTCService
    
    webRTCService.onTrack((stream, peerId) => {
      setParticipants(prev => {
        const existingParticipant = prev.find(p => p.id === peerId)
        if (existingParticipant) {
          return prev.map(p => 
            p.id === peerId ? { ...p, stream } : p
          )
        } else {
          return [...prev, { 
            id: peerId, 
            name: `User ${peerId.substring(0, 4)}`, 
            isCurrentUser: false,
            stream 
          }]
        }
      })
    })
    
    webRTCService.onPeerDisconnected((peerId) => {
      setParticipants(prev => prev.filter(p => p.id !== peerId))
      toast.info(`A participant has left the meeting`)
    })
    
    const setupMeeting = async () => {
      try {
        const localStream = await webRTCService.getLocalStream(isVideoOn, isMicOn)
        
        setParticipants(prev => 
          prev.map(p => p.isCurrentUser ? { ...p, stream: localStream } : p)
        )
        
        await webRTCService.joinMeeting(meetingId)
        setIsConnected(true)
        
        toast.success('Successfully joined the meeting')
      } catch (error) {
        console.error("Error setting up meeting:", error)
        toast.error('Failed to join the meeting. Please check your camera and microphone permissions.')
      }
    }
    
    setupMeeting()
    
    return () => {
      if (webRTCServiceRef.current) {
        webRTCServiceRef.current.closeAllConnections()
      }
    }
  }, [])

  const toggleMic = () => {
    const newState = !isMicOn
    setIsMicOn(newState)
    if (webRTCServiceRef.current) {
      webRTCServiceRef.current.toggleAudio(newState)
    }
  }
  
  const toggleVideo = () => {
    const newState = !isVideoOn
    setIsVideoOn(newState)
    if (webRTCServiceRef.current) {
      webRTCServiceRef.current.toggleVideo(newState)
    }
  }
  
  const endCall = async () => {
    if (webRTCServiceRef.current) {
      await webRTCServiceRef.current.leaveMeeting()
    }
    router.push('/video-call')
  }
  
  const copyMeetingLink = () => {
    const link = `${window.location.origin}/video-call/meeting/${meetingId}`
    navigator.clipboard.writeText(link)
    toast.success('Meeting link copied to clipboard')
  }

  if (!isConnected) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-xl">Connecting to meeting...</p>
          <p className="text-muted-foreground">Meeting ID: {meetingId}</p>
        </div>
        <Toaster position="top-center" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-black">
      <Toaster position="top-center" />
      
      <div className="bg-background/10 backdrop-blur-sm text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium">Meeting: {meetingId}</span>
          <span className="bg-green-500 rounded-full h-2 w-2"></span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white" 
            onClick={copyMeetingLink}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy link
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-white">
            <Users className="h-5 w-5 mr-2" />
            {participants.length}
          </Button>
          <Button variant="ghost" size="sm" className="text-white">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Video grid */}
      <div className={`flex-1 p-4 grid gap-4 overflow-auto ${
        participants.length === 1 ? 'grid-cols-1' : 
        participants.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
        participants.length <= 4 ? 'grid-cols-1 md:grid-cols-2' :
        'grid-cols-1 md:grid-cols-3'
      }`}>
        {participants.map((participant) => (
          <VideoParticipant 
            key={participant.id} 
            participant={participant} 
            isMicOn={participant.isCurrentUser ? isMicOn : true}
            isVideoOn={participant.isCurrentUser ? isVideoOn : true}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="bg-background/10 backdrop-blur-sm text-white p-4 flex justify-center items-center gap-2 md:gap-4">
        <Button
          variant={isMicOn ? "ghost" : "destructive"}
          size="lg"
          className="rounded-full h-12 w-12 p-0"
          onClick={toggleMic}
        >
          {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        <Button
          variant={isVideoOn ? "ghost" : "destructive"}
          size="lg"
          className="rounded-full h-12 w-12 p-0"
          onClick={toggleVideo}
        >
          {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full h-12 w-12 p-0 bg-red-600 hover:bg-red-700"
          onClick={endCall}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="lg" className="rounded-full h-12 w-12 p-0">
          <LayoutGrid className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="lg" className="rounded-full h-12 w-12 p-0">
          <Share2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

// Video participant component
function VideoParticipant({ 
  participant, 
  isMicOn, 
  isVideoOn 
}: { 
  participant: Participant,
    isMicOn: boolean,
    isVideoOn: boolean
}) {
    return (
        <Card className="bg-background/10 backdrop-blur-sm text-white rounded-lg">
        <div className="relative">
            {participant.stream && (
            <video
                className={`w-full h-full rounded-lg ${isVideoOn ? '' : 'hidden'}`}
                autoPlay
                playsInline
                ref={(video) => {
                if (video) {
                    if (participant.stream) {
                        video.srcObject = participant.stream
                    }
                }
                }}
            />
            )}
            {!isVideoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                <VideoOff className="h-12 w-12 text-white" />
            </div>
            )}
        </div>
        <div className="p-2">
            <span className="font-medium">{participant.name}</span>
            {!isMicOn && (
            <span className="text-red-500 text-sm">Muted</span>
            )}
        </div>
        </Card>
    )
    }
