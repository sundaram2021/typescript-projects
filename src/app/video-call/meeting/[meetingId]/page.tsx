"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Mic, MicOff, Video, VideoOff, PhoneOff,
    Users, LayoutGrid, Settings, Share2, Copy, Loader2
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { WebRTCService } from "@/lib/video-call/webrtc-service"
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
    const userId = useRef(typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || `user-${Math.random().toString(36).substring(2, 9)}` : '').current
    const webRTCServiceRef = useRef<WebRTCService | null>(null)

    const [isMicOn, setIsMicOn] = useState(true)
    const [isVideoOn, setIsVideoOn] = useState(true)
    const [isConnected, setIsConnected] = useState(false)
    const [isLoading, setIsLoading] = useState({
        mic: false,
        video: false,
        end: false,
        share: false,
        layout: false
    })
    const [participants, setParticipants] = useState<Participant[]>([
        { id: userId, name: "You", isCurrentUser: true }
    ])

    useEffect(() => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('userId', userId)
        }

        const webRTCService = new WebRTCService(userId)
        webRTCServiceRef.current = webRTCService

        webRTCService.onTrack((stream, peerId) => {
            console.log(`Received track from peer: ${peerId}`)
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
            console.log(`Peer disconnected: ${peerId}`)
            setParticipants(prev => prev.filter(p => p.id !== peerId))
            toast.info(`A participant has left the meeting`)
        })

        const setupMeeting = async () => {
            try {
                const localStream = await webRTCService.getLocalStream(isVideoOn, isMicOn)

                setParticipants(prev =>
                    prev.map(p => p.isCurrentUser ? { ...p, stream: localStream } : p)
                )

                const existingParticipants = await webRTCService.joinMeeting(meetingId)
                console.log(`Joined meeting with ${existingParticipants.length} existing participants`, existingParticipants)

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

    const toggleMic = async () => {
        try {
            setIsLoading(prev => ({ ...prev, mic: true }))
            const newState = !isMicOn
            setIsMicOn(newState)
            if (webRTCServiceRef.current) {
                webRTCServiceRef.current.toggleAudio(newState)
            }
            toast.success(newState ? 'Microphone unmuted' : 'Microphone muted')
        } catch (error) {
            console.error("Error toggling microphone:", error)
            toast.error('Failed to toggle microphone')
        } finally {
            setIsLoading(prev => ({ ...prev, mic: false }))
        }
    }

    const toggleVideo = async () => {
        try {
            setIsLoading(prev => ({ ...prev, video: true }))
            const newState = !isVideoOn
            setIsVideoOn(newState)
            if (webRTCServiceRef.current) {
                webRTCServiceRef.current.toggleVideo(newState)
            }
            toast.success(newState ? 'Camera turned on' : 'Camera turned off')
        } catch (error) {
            console.error("Error toggling video:", error)
            toast.error('Failed to toggle camera')
        } finally {
            setIsLoading(prev => ({ ...prev, video: false }))
        }
    }

    const endCall = async () => {
        try {
            setIsLoading(prev => ({ ...prev, end: true }))
            if (webRTCServiceRef.current) {
                await webRTCServiceRef.current.leaveMeeting()
            }
            router.push('/video-call')
        } catch (error) {
            console.error("Error ending call:", error)
            toast.error('Failed to end call properly')
            router.push('/video-call')
        }
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

            {/* Video grid with better layout */}
            <div className={`flex-1 p-4 ${participants.length === 1 ? 'flex justify-center items-center' :
                    participants.length === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' :
                        participants.length <= 4 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' :
                            'grid grid-cols-1 md:grid-cols-3 gap-4'
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
                    disabled={isLoading.mic}
                >
                    {isLoading.mic ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isMicOn ? (
                        <Mic className="h-5 w-5" />
                    ) : (
                        <MicOff className="h-5 w-5" />
                    )}
                </Button>

                <Button
                    variant={isVideoOn ? "ghost" : "destructive"}
                    size="lg"
                    className="rounded-full h-12 w-12 p-0"
                    onClick={toggleVideo}
                    disabled={isLoading.video}
                >
                    {isLoading.video ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isVideoOn ? (
                        <Video className="h-5 w-5" />
                    ) : (
                        <VideoOff className="h-5 w-5" />
                    )}
                </Button>

                <Button
                    variant="destructive"
                    size="lg"
                    className="rounded-full h-12 w-12 p-0 bg-red-600 hover:bg-red-700"
                    onClick={endCall}
                    disabled={isLoading.end}
                >
                    {isLoading.end ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <PhoneOff className="h-5 w-5" />
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="lg"
                    className="rounded-full h-12 w-12 p-0"
                    disabled={isLoading.layout}
                >
                    <LayoutGrid className="h-5 w-5" />
                </Button>

                <Button
                    variant="ghost"
                    size="lg"
                    className="rounded-full h-12 w-12 p-0"
                    disabled={isLoading.share}
                >
                    <Share2 className="h-5 w-5" />
                </Button>
            </div>
        </div>
    )
}

function VideoParticipant({
    participant,
    isMicOn,
    isVideoOn
}: {
    participant: Participant,
    isMicOn: boolean,
    isVideoOn: boolean
}) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && participant.stream) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    return (
        <Card className="bg-background/10 backdrop-blur-sm text-white rounded-lg flex flex-col h-full overflow-hidden">
            <div className="relative flex-1">
                {participant.stream && (
                    <video
                        ref={videoRef}
                        className={`w-full h-full object-cover ${isVideoOn ? '' : 'hidden'}`}
                        autoPlay
                        playsInline
                        muted={participant.isCurrentUser}
                    />
                )}
                {!isVideoOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
                        <div className="h-24 w-24 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-2xl font-semibold">
                                {participant.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-2 flex items-center justify-between bg-background/20">
                <span className="font-medium">{participant.name}</span>
                {!isMicOn && (
                    <MicOff className="h-4 w-4 text-red-500" />
                )}
            </div>
        </Card>
    );
}
