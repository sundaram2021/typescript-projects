"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Video, LinkIcon, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

export default function VideoCallHome() {
    const [isCreating, setIsCreating] = useState(false)
    const [meetingId, setMeetingId] = useState("")
    const [isValidating, setIsValidating] = useState(false)
    const [isInvalidMeeting, setIsInvalidMeeting] = useState(false)
    const [userId, setUserId] = useState("")
    const router = useRouter()

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedUserId = localStorage.getItem('userId') ||
                `user-${Math.random().toString(36).substring(2, 9)}`

            setUserId(storedUserId)

            if (!localStorage.getItem('userId')) {
                localStorage.setItem('userId', storedUserId)
            }
        }
    }, [])

    const createMeeting = async () => {
        if (!userId) {
            toast({
                title: "Error",
                description: "User ID not available. Please refresh the page.",
                variant: "destructive",
            })
            return
        }

        try {
            setIsCreating(true)

            const response = await fetch("/api/video-call/meetings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ hostId: userId }),
            })

            const data = await response.json()

            if (!response.ok) {
                console.error("Server error:", data)
                throw new Error(data.error || "Failed to create meeting")
            }

            if (!data.meetingId) {
                throw new Error("No meeting ID returned from server")
            }

            router.push(`/video-call/meeting/${data.meetingId}`)
        } catch (error) {
            console.error("Error creating meeting:", error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to create meeting. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsCreating(false)
        }
    }

    const joinMeeting = async () => {
        if (!meetingId.trim()) {
            setIsInvalidMeeting(true)
            return
        }

        try {
            setIsValidating(true)

            if (meetingId.length < 5) {
                setIsInvalidMeeting(true)
                toast({
                    title: "Invalid Meeting ID",
                    description: "Meeting ID is too short.",
                    variant: "destructive",
                })
                return
            }

            router.push(`/video-call/meeting/${meetingId}`)
        } catch (error) {
            console.error("Error joining meeting:", error)
            toast({
                title: "Error",
                description: "Failed to join meeting. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsValidating(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMeetingId(e.target.value)
        setIsInvalidMeeting(false)
    }

    return (
        <div className="container mx-auto py-12 px-4 max-w-5xl">
            <div className="flex items-center mb-8">
                <Link href="/" className="text-muted-foreground hover:text-foreground mr-4">
                    ← Back to Projects
                </Link>
            </div>

            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight mb-4 flex items-center justify-center gap-2">
                    <Video className="h-8 w-8" />
                    Video Calling App
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Create or join video meetings with a simple, intuitive interface
                </p>
            </div>

            <Card className="mx-auto max-w-md">
                <CardHeader>
                    <CardTitle>Start or join a meeting</CardTitle>
                    <CardDescription>Connect with others through high-quality video calls</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="new" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="new">New Meeting</TabsTrigger>
                            <TabsTrigger value="join">Join Meeting</TabsTrigger>
                        </TabsList>
                        <TabsContent value="new" className="space-y-4">
                            <div className="flex flex-col gap-4">
                                <Button
                                    className="w-full h-12 text-md"
                                    size="lg"
                                    onClick={createMeeting}
                                    disabled={isCreating || !userId}
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Creating Meeting...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 h-5 w-5" />
                                            Create New Meeting
                                        </>
                                    )}
                                </Button>
                            </div>
                        </TabsContent>
                        <TabsContent value="join" className="space-y-4">
                            <div className="flex flex-col gap-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter meeting code"
                                        className={`h-12 ${isInvalidMeeting ? 'border-red-500' : ''}`}
                                        value={meetingId}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => e.key === 'Enter' && joinMeeting()}
                                    />
                                    <Button
                                        className="h-12 px-6"
                                        onClick={joinMeeting}
                                        disabled={isValidating || !meetingId.trim() || !userId}
                                    >
                                        {isValidating ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            'Join'
                                        )}
                                    </Button>
                                </div>
                                {isInvalidMeeting && (
                                    <div className="text-sm text-red-500">
                                        Invalid meeting code. Please check and try again.
                                    </div>
                                )}
                                <div className="text-sm text-muted-foreground text-center">
                                    Enter a code provided by the meeting organizer
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
                <CardFooter className="flex justify-between border-t p-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                        <LinkIcon className="h-4 w-4 mr-2" />
                        {userId ? `Your user ID: ${userId.substring(0, 8)}...` : 'Generating user ID...'}
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}