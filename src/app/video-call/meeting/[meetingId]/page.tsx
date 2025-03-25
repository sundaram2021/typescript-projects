"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    Users,
    LayoutGrid,
    Settings,
    Share2,
    Copy,
    Loader2,
    ChevronUp,
    MessageSquare,
    Info,
    Cog,
    Volume2,
    Sliders,
    Keyboard,
    X,
    Coffee,
    Maximize2,
    Minimize2,
    Grid,
    Grid2X2,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { WebRTCService } from "@/lib/video-call/webrtc-service"
import { Toaster, toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface Participant {
    id: string
    name: string
    isCurrentUser: boolean
    stream?: MediaStream
    isSpeaking?: boolean
    avatar?: string
    isVideoOn?: boolean
    isMicOn?: boolean
}

export default function MeetingRoom() {
    const params = useParams()
    const router = useRouter()
    const meetingId = params.meetingId as string
    const userId = useRef(
        typeof localStorage !== "undefined"
            ? localStorage.getItem("userId") || `user-${Math.random().toString(36).substring(2, 9)}`
            : "",
    ).current
    const webRTCServiceRef = useRef<WebRTCService | null>(null)
    const meetingStartTime = useRef(Date.now()).current

    const [isMicOn, setIsMicOn] = useState(true)
    const [isVideoOn, setIsVideoOn] = useState(true)
    const [isConnected, setIsConnected] = useState(false)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [isInfoOpen, setIsInfoOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("participants")
    const [gridLayout, setGridLayout] = useState<"auto" | "equal" | "spotlight">("auto")
    const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
    // const [showControls, setShowControls] = useState(true)
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const mainContainerRef = useRef<HTMLDivElement>(null)
    const [elapsedTime, setElapsedTime] = useState<string>("00:00")

    const [isLoading, setIsLoading] = useState({
        mic: false,
        video: false,
        end: false,
        share: false,
        layout: false,
    })

    const [participants, setParticipants] = useState<Participant[]>([
        {
            id: userId,
            name: "You",
            isCurrentUser: true,
            avatar: getRandomAvatar(),
        },
    ])

    // Settings state
    const [audioInput, setAudioInput] = useState("default")
    const [videoInput, setVideoInput] = useState("default")
    const [audioOutput, setAudioOutput] = useState("default")
    const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([])
    const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([])
    const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([])
    const [noiseReduction, setNoiseReduction] = useState(true)
    const [lowLightEnhancement, setLowLightEnhancement] = useState(true)
    const [bandwidthMode, setBandwidthMode] = useState("auto")
    const [speakerVolume, setSpeakerVolume] = useState(80)
    const [microphoneVolume, setMicrophoneVolume] = useState(75)
    const [backgroundColor, setBackgroundColor] = useState("#000000")
    const [keybindingsEnabled, setKeybindingsEnabled] = useState(true)

    // Get random avatar (just for demonstration)
    function getRandomAvatar() {
        const colors = ["4f46e5", "0891b2", "4338ca", "7c3aed", "be123c", "ea580c", "16a34a"]
        const randomColor = colors[Math.floor(Math.random() * colors.length)]
        return `https://source.boringavatars.com/beam/120/${userId}?colors=${randomColor}`
    }

    // Meeting timer
    useEffect(() => {
        const timer = setInterval(() => {
            const seconds = Math.floor((Date.now() - meetingStartTime) / 1000)
            const minutes = Math.floor(seconds / 60)
            const hours = Math.floor(minutes / 60)

            const formattedHours = hours > 0 ? `${hours.toString().padStart(2, "0")}:` : ""
            const formattedMinutes = minutes % 60
            const formattedSeconds = seconds % 60

            setElapsedTime(
                `${formattedHours}${formattedMinutes.toString().padStart(2, "0")}:${formattedSeconds.toString().padStart(2, "0")}`,
            )
        }, 1000)

        return () => clearInterval(timer)
    }, [meetingStartTime])

    // Full screen handling
    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement)
        }

        document.addEventListener("fullscreenchange", handleFullScreenChange)

        return () => {
            document.removeEventListener("fullscreenchange", handleFullScreenChange)
        }
    }, [])

    const toggleFullScreen = () => {
        if (!isFullScreen && mainContainerRef.current) {
            mainContainerRef.current.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`)
            })
        } else if (document.fullscreenElement) {
            document.exitFullscreen().catch((err) => {
                console.error(`Error attempting to exit full-screen mode: ${err.message}`)
            })
        }
    }

    // Load media devices
    useEffect(() => {
        const loadMediaDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices()

                const audioInputs = devices.filter((device) => device.kind === "audioinput")
                const videoInputs = devices.filter((device) => device.kind === "videoinput")
                const audioOutputs = devices.filter((device) => device.kind === "audiooutput")

                setAudioInputDevices(audioInputs)
                setVideoInputDevices(videoInputs)
                setAudioOutputDevices(audioOutputs)

                // Set defaults if available
                if (audioInputs.length > 0) setAudioInput(audioInputs[0].deviceId)
                if (videoInputs.length > 0) setVideoInput(videoInputs[0].deviceId)
                if (audioOutputs.length > 0) setAudioOutput(audioOutputs[0].deviceId)
            } catch (error) {
                console.error("Error enumerating media devices:", error)
            }
        }

        loadMediaDevices()
    }, [])

    // Setup WebRTC
    useEffect(() => {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("userId", userId);
        }
    
        const webRTCService = new WebRTCService(userId);
        webRTCServiceRef.current = webRTCService;
    
        // Handle incoming tracks
        webRTCService.onTrack((stream, peerId) => {
            console.log(`Received track from peer: ${peerId}`);
            setParticipants((prev) => {
                const existingParticipant = prev.find((p) => p.id === peerId);
                if (existingParticipant) {
                    return prev.map((p) => (p.id === peerId ? { ...p, stream } : p));
                } else {
                    return [
                        ...prev,
                        {
                            id: peerId,
                            name: `User ${peerId.substring(0, 4)}`,
                            isCurrentUser: false,
                            stream,
                            avatar: `https://source.boringavatars.com/beam/120/${peerId}?colors=7c3aed`,
                            isVideoOn: true, // Assume true initially
                            isMicOn: true,   // Assume true initially
                        },
                    ];
                }
            });
        });
    
        // Handle peer disconnection
        webRTCService.onPeerDisconnected((peerId) => {
            console.log(`Peer disconnected: ${peerId}`);
            setParticipants((prev) => prev.filter((p) => p.id !== peerId));
            toast.info(`A participant has left the meeting`);
        });
    
        // Handle video toggle events
        webRTCService.onVideoToggle((peerId, enabled) => {
            setParticipants((prev) =>
                prev.map((p) =>
                    p.id === peerId ? { ...p, isVideoOn: enabled } : p
                )
            );
        });
    
        // Handle audio toggle events
        webRTCService.onAudioToggle((peerId, enabled) => {
            setParticipants((prev) =>
                prev.map((p) =>
                    p.id === peerId ? { ...p, isMicOn: enabled } : p
                )
            );
        });
    
        // Simulate speaking detection (unchanged)
        const speakingInterval = setInterval(() => {
            if (participants.length > 1) {
                const randomIndex = Math.floor(Math.random() * participants.length);
                setParticipants((prev) =>
                    prev.map((p, idx) => ({
                        ...p,
                        isSpeaking: idx === randomIndex && Math.random() > 0.7,
                    }))
                );
            }
        }, 2000);
    
        const setupMeeting = async () => {
            try {
                const localStream = await webRTCService.getLocalStream(isVideoOn, isMicOn);
                setParticipants((prev) =>
                    prev.map((p) => (p.isCurrentUser ? { ...p, stream: localStream, isVideoOn: true, isMicOn: true } : p))
                );
    
                const existingParticipants = await webRTCService.joinMeeting(meetingId);
                console.log(`Joined meeting with ${existingParticipants.length} existing participants`, existingParticipants);
    
                setParticipants((prev) => {
                    const newParticipants = existingParticipants
                        .filter((peerId) => peerId !== userId)
                        .map((peerId) => ({
                            id: peerId,
                            name: `User ${peerId.substring(0, 4)}`,
                            isCurrentUser: false,
                            avatar: `https://source.boringavatars.com/beam/120/${peerId}?colors=7c3aed`,
                            isVideoOn: true, // Assume true initially
                            isMicOn: true,   // Assume true initially
                        }));
                    return [...prev, ...newParticipants];
                });
    
                setIsConnected(true);
                toast.success("Successfully joined the meeting");
            } catch (error) {
                console.error("Error setting up meeting:", error);
                toast.error("Failed to join the meeting. Please check your camera and microphone permissions.");
            }
        };
    
        setupMeeting();
    
        return () => {
            clearInterval(speakingInterval);
            if (webRTCServiceRef.current) {
                webRTCServiceRef.current.closeAllConnections();
            }
        };
    }, []);

    const toggleMic = async () => {
        try {
            setIsLoading((prev) => ({ ...prev, mic: true }))
            const newState = !isMicOn
            setIsMicOn(newState)
            if (webRTCServiceRef.current) {
                webRTCServiceRef.current.toggleAudio(newState)
            }
            toast.success(newState ? "Microphone unmuted" : "Microphone muted")
        } catch (error) {
            console.error("Error toggling microphone:", error)
            toast.error("Failed to toggle microphone")
        } finally {
            setIsLoading((prev) => ({ ...prev, mic: false }))
        }
    }

    const toggleVideo = async () => {
        try {
            setIsLoading((prev) => ({ ...prev, video: true }))
            const newState = !isVideoOn
            setIsVideoOn(newState)
            if (webRTCServiceRef.current) {
                webRTCServiceRef.current.toggleVideo(newState)
            }
            toast.success(newState ? "Camera turned on" : "Camera turned off")
        } catch (error) {
            console.error("Error toggling video:", error)
            toast.error("Failed to toggle camera")
        } finally {
            setIsLoading((prev) => ({ ...prev, video: false }))
        }
    }

    const endCall = async () => {
        try {
            setIsLoading((prev) => ({ ...prev, end: true }))
            if (webRTCServiceRef.current) {
                await webRTCServiceRef.current.leaveMeeting()
            }
            router.push("/video-call")
        } catch (error) {
            console.error("Error ending call:", error)
            toast.error("Failed to end call properly")
            router.push("/video-call")
        }
    }

    const copyMeetingLink = () => {
        const link = `${window.location.origin}/video-call/meeting/${meetingId}`
        navigator.clipboard.writeText(link)
        toast.success("Meeting link copied to clipboard")
    }

    const getGridClassName = () => {
        const count = participants.length

        if (gridLayout === "spotlight" && count > 1) {
            return "grid-cols-1 md:grid-cols-[3fr_1fr] lg:grid-cols-[3fr_1fr] gap-2"
        }

        if (gridLayout === "equal") {
            return count <= 1
                ? "grid-cols-1"
                : count <= 2
                    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
                    : count <= 4
                        ? "grid-cols-2 md:grid-cols-2 lg:grid-cols-2"
                        : count <= 6
                            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
                            : count <= 9
                                ? "grid-cols-3 md:grid-cols-3 lg:grid-cols-3"
                                : "grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
        }

        // Auto layout (default)
        return count <= 1
            ? "grid-cols-1"
            : count === 2
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
                : count === 3
                    ? "grid-cols-1 md:grid-cols-3 lg:grid-cols-3"
                    : count === 4
                        ? "grid-cols-2 md:grid-cols-2 lg:grid-cols-2"
                        : count <= 6
                            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
                            : count <= 9
                                ? "grid-cols-3 md:grid-cols-3 lg:grid-cols-3"
                                : "grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
    }

    if (!isConnected) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
                <div className="text-center px-4 py-8 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-lg max-w-md w-full">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
                        <div className="absolute inset-3 rounded-full bg-primary/40 animate-pulse"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Connecting to meeting</h2>
                    <p className="text-gray-400 mb-4">Setting up your audio and video...</p>
                    <div className="bg-white/5 rounded-lg p-3 mt-6">
                        <p className="text-sm text-gray-300 font-mono">Meeting ID: {meetingId}</p>
                    </div>
                </div>
                <Toaster position="top-center" />
            </div>
        )
    }

    return (
        <div
            ref={mainContainerRef}
            className="h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black overflow-hidden"
            style={{ backgroundColor }}
        >
            <Toaster position="top-center" richColors />

            {/* Top bar - fades in/out based on showControls */}
            <div
                className={`bg-black/40 backdrop-blur-md text-white p-3 flex justify-between items-center z-10 transition-opacity duration-300 opacity-100`}
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-md">
                        <span className="font-medium hidden sm:inline">{meetingId}</span>
                        <span className="animate-pulse bg-green-500 rounded-full h-2 w-2"></span>
                        <span className="text-xs text-gray-300">{elapsedTime}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-white bg-white/5 hover:bg-white/10"
                        onClick={copyMeetingLink}
                    >
                        <Copy className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Copy link</span>
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/10"
                        onClick={() => setIsInfoOpen(true)}
                    >
                        <Info className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Info</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={toggleFullScreen}>
                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Video grid with multiple layout options */}
            <div className="flex-1 p-2 relative overflow-hidden">
                {/* Main content area with videos */}
                <div className="h-full flex">
                    {/* Video grid */}
                    <div className={`grid ${getGridClassName()} gap-2 w-full h-full max-h-full`}>
                        {gridLayout === "spotlight" && participants.length > 1 ? (
                            // Spotlight layout: one big video, others in sidebar
                            <>
                                <div className="col-span-1 h-full">
                                    <VideoParticipant
                                        key={participants[0].id}
                                        participant={participants[0]}
                                        isMicOn={participants[0].isCurrentUser ? isMicOn : true}
                                        isVideoOn={participants[0].isCurrentUser ? isVideoOn : true}
                                        isSpotlight={true}
                                    />
                                </div>
                                <div className="col-span-1 h-full overflow-y-auto grid grid-cols-1 gap-2 auto-rows-min max-h-full">
                                    {participants.slice(1).map((participant) => (
                                        <VideoParticipant
                                            key={participant.id}
                                            participant={participant}
                                            isMicOn={participant.isCurrentUser ? isMicOn : true}
                                            isVideoOn={participant.isCurrentUser ? isVideoOn : true}
                                            isSmall={true}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            // Normal grid layout
                            participants.map((participant, index) => (
                                <VideoParticipant
                                    key={participant.id}
                                    participant={participant}
                                    isMicOn={participant.isCurrentUser ? isMicOn : true}
                                    isVideoOn={participant.isCurrentUser ? isVideoOn : true}
                                />
                            ))
                        )}
                    </div>

                    {/* Right sidebar (conditionally rendered) */}
                    {isChatOpen && (
                        <div className="w-80 bg-black/70 backdrop-blur-md border-l border-white/10 flex flex-col h-full">
                            <div className="p-3 border-b border-white/10 flex justify-between items-center">
                                <h3 className="font-semibold">Chat</h3>
                                <Button variant="ghost" size="sm" onClick={() => setIsChatOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto">
                                <div className="flex flex-col gap-4">
                                    <div className="bg-white/5 p-3 rounded-lg">
                                        <div className="font-semibold text-sm">System</div>
                                        <p className="text-sm text-gray-300">
                                            Welcome to the meeting! You can use this chat to communicate with other participants.
                                        </p>
                                    </div>
                                    <div className="bg-primary/10 p-3 rounded-lg ml-8">
                                        <div className="font-semibold text-sm text-primary-foreground">You</div>
                                        <p className="text-sm text-primary-foreground/80">Hello everyone!</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 border-t border-white/10">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        className="w-full bg-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <Button size="sm" className="absolute right-1 top-1 rounded-full h-6 w-6 p-0">
                                        <ChevronUp className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Participants counter floating bubble */}
                <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2 rounded-full text-amber-200 bg-black/50 backdrop-blur-md border border-white/10 py-1 px-3 shadow-lg z-10"
                >
                    <Users className="h-4 w-4 mr-1" />
                    {participants.length}
                </Button>
            </div>

            {/* Controls bar - fades in/out based on showControls */}
            <div
                className={`bg-black/60 backdrop-blur-md text-white p-4 flex flex-col sm:flex-row justify-center items-center gap-2 transition-opacity duration-300 opacity-100`}
            >
                <div className="flex justify-center items-center gap-2 md:gap-3">
                    <Button
                        variant={isMicOn ? "ghost" : "destructive"}
                        size="lg"
                        className={`rounded-full h-12 w-12 p-0 ${isMicOn ? "bg-white/10 hover:bg-white/20" : ""}`}
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
                        className={`rounded-full h-12 w-12 p-0 ${isVideoOn ? "bg-white/10 hover:bg-white/20" : ""}`}
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
                        {isLoading.end ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
                    </Button>

                    <DropdownMenu open={layoutMenuOpen} onOpenChange={setLayoutMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="lg" className="rounded-full h-12 w-12 p-0 bg-white/10 hover:bg-white/20">
                                {gridLayout === "auto" ? (
                                    <Grid className="h-5 w-5" />
                                ) : gridLayout === "equal" ? (
                                    <Grid2X2 className="h-5 w-5" />
                                ) : (
                                    <LayoutGrid className="h-5 w-5" />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="bg-gray-900/95 backdrop-blur-md border-white/10 text-white">
                            <DropdownMenuItem onClick={() => setGridLayout("auto")} className="cursor-pointer">
                                <Grid className="h-4 w-4 mr-2" />
                                Auto Layout
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setGridLayout("equal")} className="cursor-pointer">
                                <Grid2X2 className="h-4 w-4 mr-2" />
                                Equal Grid
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setGridLayout("spotlight")} className="cursor-pointer">
                                <LayoutGrid className="h-4 w-4 mr-2" />
                                Spotlight
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="ghost"
                        size="lg"
                        className={`rounded-full h-12 w-12 p-0 ${isChatOpen ? "bg-primary/20 text-primary" : "bg-white/10 hover:bg-white/20"}`}
                        onClick={() => setIsChatOpen(!isChatOpen)}
                    >
                        <MessageSquare className="h-5 w-5" />
                    </Button>

                    <Button variant="ghost" size="lg" className="rounded-full h-12 w-12 p-0 bg-white/10 hover:bg-white/20">
                        <Share2 className="h-5 w-5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="lg"
                        className="rounded-full h-12 w-12 p-0 bg-white/10 hover:bg-white/20"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Meeting info drawer */}
            <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                <DialogContent className="bg-gray-900 text-white border-white/10 max-w-md">
                    <DialogHeader>
                        <DialogTitle>Meeting Information</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="text-sm font-medium mb-2">Meeting ID</h3>
                            <div className="flex justify-between items-center">
                                <code className="text-xs bg-black/50 p-1 rounded">{meetingId}</code>
                                <Button size="sm" variant="ghost" onClick={copyMeetingLink}>
                                    <Copy className="h-4 w-4 mr-1" />
                                    Copy
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium">Participants ({participants.length})</h3>
                            <div className="max-h-48 overflow-y-auto pr-2">
                                {participants.map((participant) => (
                                    <div key={participant.id} className="flex items-center gap-2 py-2">
                                        <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/20">
                                            {participant.avatar ? (
                                                <img
                                                    src={participant.avatar || "/placeholder.svg"}
                                                    alt={participant.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center">
                                                    {participant.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">
                                                {participant.name} {participant.isCurrentUser && "(You)"}
                                            </p>
                                        </div>
                                        {participant.isSpeaking && (
                                            <div className="w-5 h-5 flex space-x-0.5">
                                                <div className="w-1 bg-green-500 animate-sound-wave"></div>
                                                <div className="w-1 bg-green-500 animate-sound-wave-delay-1"></div>
                                                <div className="w-1 bg-green-500 animate-sound-wave-delay-2"></div>
                                            </div>
                                        )}
                                        {!participant.isSpeaking && participant.isCurrentUser && !isMicOn && (
                                            <MicOff className="h-4 w-4 text-red-500" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t border-white/10 pt-2">
                        <Button variant="ghost" onClick={() => setIsInfoOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settings dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="bg-gray-900 text-white border-white/10 max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Meeting Settings</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Configure your audio, video, and meeting preferences
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="audio" className="w-full">
                        <TabsList className="bg-black/20 w-full justify-start mb-4">
                            <TabsTrigger value="audio" className="data-[state=active]:bg-primary/20">
                                <Volume2 className="h-4 w-4 mr-2" />
                                Audio
                            </TabsTrigger>
                            <TabsTrigger value="video" className="data-[state=active]:bg-primary/20">
                                <Video className="h-4 w-4 mr-2" />
                                Video
                            </TabsTrigger>
                            <TabsTrigger value="advanced" className="data-[state=active]:bg-primary/20">
                                <Sliders className="h-4 w-4 mr-2" />
                                Advanced
                            </TabsTrigger>
                            <TabsTrigger value="shortcuts" className="data-[state=active]:bg-primary/20">
                                <Keyboard className="h-4 w-4 mr-2" />
                                Shortcuts
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="audio" className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="microphone">Microphone</Label>
                                    <Select value={audioInput} onValueChange={setAudioInput}>
                                        <SelectTrigger id="microphone" className="bg-black/30 border-white/10">
                                            <SelectValue placeholder="Select microphone" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-900 border-white/10">
                                            {audioInputDevices.map((device) => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="speakers">Speakers</Label>
                                    <Select value={audioOutput} onValueChange={setAudioOutput}>
                                        <SelectTrigger id="speakers" className="bg-black/30 border-white/10">
                                            <SelectValue placeholder="Select speakers" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-900 border-white/10">
                                            {audioOutputDevices.map((device) => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label htmlFor="mic-volume">Microphone Volume</Label>
                                        <span className="text-xs text-gray-400">{microphoneVolume}%</span>
                                    </div>
                                    <Slider
                                        id="mic-volume"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[microphoneVolume]}
                                        onValueChange={(values) => setMicrophoneVolume(values[0])}
                                        className="py-2"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label htmlFor="speaker-volume">Speaker Volume</Label>
                                        <span className="text-xs text-gray-400">{speakerVolume}%</span>
                                    </div>
                                    <Slider
                                        id="speaker-volume"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[speakerVolume]}
                                        onValueChange={(values) => setSpeakerVolume(values[0])}
                                        className="py-2"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="noise-reduction">Noise Reduction</Label>
                                        <span className="text-xs text-gray-400">Filter out background noise</span>
                                    </div>
                                    <Switch id="noise-reduction" checked={noiseReduction} onCheckedChange={setNoiseReduction} />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="video" className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="camera">Camera</Label>
                                    <Select value={videoInput} onValueChange={setVideoInput}>
                                        <SelectTrigger id="camera" className="bg-black/30 border-white/10">
                                            <SelectValue placeholder="Select camera" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-900 border-white/10">
                                            {videoInputDevices.map((device) => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="low-light">Low Light Enhancement</Label>
                                        <span className="text-xs text-gray-400">Improve video in low light conditions</span>
                                    </div>
                                    <Switch id="low-light" checked={lowLightEnhancement} onCheckedChange={setLowLightEnhancement} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="background-color">Background Color</Label>
                                    <div className="flex gap-3">
                                        {["#000000", "#0f172a", "#1e293b", "#312e81", "#831843"].map((color) => (
                                            <button
                                                key={color}
                                                className={`h-8 w-8 rounded-full border-2 ${backgroundColor === color ? "border-primary" : "border-transparent"}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setBackgroundColor(color)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bandwidth">Bandwidth Mode</Label>
                                    <Select value={bandwidthMode} onValueChange={setBandwidthMode}>
                                        <SelectTrigger id="bandwidth" className="bg-black/30 border-white/10">
                                            <SelectValue placeholder="Select bandwidth mode" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-900 border-white/10">
                                            <SelectItem value="auto">Auto (Recommended)</SelectItem>
                                            <SelectItem value="low">Low (Data Saver)</SelectItem>
                                            <SelectItem value="high">High Quality</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="hardware-accel">Hardware Acceleration</Label>
                                        <span className="text-xs text-gray-400">Use GPU for video processing</span>
                                    </div>
                                    <Switch id="hardware-accel" defaultChecked />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="echo-cancellation">Echo Cancellation</Label>
                                        <span className="text-xs text-gray-400">Reduce echo during calls</span>
                                    </div>
                                    <Switch id="echo-cancellation" defaultChecked />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="shortcuts" className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col gap-1">
                                    <Label htmlFor="enable-shortcuts">Enable Keyboard Shortcuts</Label>
                                    <span className="text-xs text-gray-400">Use keyboard shortcuts for quick actions</span>
                                </div>
                                <Switch id="enable-shortcuts" checked={keybindingsEnabled} onCheckedChange={setKeybindingsEnabled} />
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between py-1 border-b border-white/10">
                                    <span>Toggle mute</span>
                                    <kbd className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">⌘ + D</kbd>
                                </div>
                                <div className="flex justify-between py-1 border-b border-white/10">
                                    <span>Toggle video</span>
                                    <kbd className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">⌘ + E</kbd>
                                </div>
                                <div className="flex justify-between py-1 border-b border-white/10">
                                    <span>Leave meeting</span>
                                    <kbd className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">⌘ + L</kbd>
                                </div>
                                <div className="flex justify-between py-1 border-b border-white/10">
                                    <span>Toggle fullscreen</span>
                                    <kbd className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">⌘ + F</kbd>
                                </div>
                                <div className="flex justify-between py-1 border-b border-white/10">
                                    <span>Toggle chat</span>
                                    <kbd className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">⌘ + C</kbd>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="border-t border-white/10 pt-4">
                        <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setIsSettingsOpen(false)}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function VideoParticipant({
    participant,
    isMicOn,
    isVideoOn,
    isSmall = false,
    isSpotlight = false,
}: {
    participant: Participant
    isMicOn: boolean
    isVideoOn: boolean
    isSmall?: boolean
    isSpotlight?: boolean
}) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (videoRef.current && participant.stream) {
            videoRef.current.srcObject = participant.stream
        }
    }, [participant.stream])

    // Use participant's own isVideoOn/isMicOn if available, otherwise fall back to props
    const videoEnabled = participant.isVideoOn ?? (participant.isCurrentUser ? isVideoOn : true)
    const micEnabled = participant.isMicOn ?? (participant.isCurrentUser ? isMicOn : true)

    return (
        <Card
            className={`bg-black/40 backdrop-blur-sm text-white rounded-lg flex flex-col overflow-hidden ${isSmall ? "h-28" : "h-full"
                } ${participant.isSpeaking ? "ring-2 ring-primary" : ""}`}
        >
            <div className="relative flex-1 w-full h-full">
                {participant.stream && (
                    <video
                        ref={videoRef}
                        className={`absolute inset-0 w-full h-full object-cover ${videoEnabled ? "" : "hidden"}`}
                        autoPlay
                        playsInline
                        muted={participant.isCurrentUser}
                    />
                )}
                {!videoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
                        <div
                            className={`${isSmall ? "h-12 w-12" : isSpotlight ? "h-28 w-28" : "h-20 w-20"
                                } rounded-full bg-primary/20 flex items-center justify-center overflow-hidden`}
                        >
                            {participant.avatar ? (
                                <img
                                    src={participant.avatar || "/placeholder.svg"}
                                    alt={participant.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className={`text-white font-semibold ${isSmall ? "text-xl" : "text-3xl"}`}>
                                    {participant.name.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* User status indicators */}
                <div className="absolute bottom-3 left-3 flex gap-1 z-10">
                    {!micEnabled && (
                        <div className="bg-black/60 backdrop-blur-sm p-1 rounded-md">
                            <MicOff className="h-4 w-4 text-red-500" />
                        </div>
                    )}
                    {participant.isSpeaking && micEnabled && (
                        <div className="bg-black/60 backdrop-blur-sm p-1 rounded-md flex space-x-0.5">
                            <div className="w-0.5 h-3 bg-green-500 animate-sound-wave"></div>
                            <div className="w-0.5 h-3 bg-green-500 animate-sound-wave-delay-1"></div>
                            <div className="w-0.5 h-3 bg-green-500 animate-sound-wave-delay-2"></div>
                        </div>
                    )}
                </div>
            </div>
            <div
                className={`p-1.5 flex items-center justify-between bg-black/60 backdrop-blur-sm ${isSmall ? "px-2 py-1" : ""}`}
            >
                <span className={`font-medium ${isSmall ? "text-xs" : "text-sm"} truncate`}>
                    {participant.name} {participant.isCurrentUser && "(You)"}
                </span>

                {!isSmall && (
                    <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Coffee className="h-3 w-3" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Cog className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900/95 backdrop-blur-md border-white/10 text-white">
                                <DropdownMenuItem className="cursor-pointer">
                                    <div className="text-xs">Pin video</div>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer">
                                    <div className="text-xs">Hide video</div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>
        </Card>
    )
}

