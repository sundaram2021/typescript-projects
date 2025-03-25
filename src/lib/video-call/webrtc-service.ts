import { EventSourcePolyfill } from 'event-source-polyfill';

export class WebRTCService {
    private peerConnections: Map<string, RTCPeerConnection> = new Map()
    private onVideoToggleCallbacks: ((peerId: string, enabled: boolean) => void)[] = []
    private onAudioToggleCallbacks: ((peerId: string, enabled: boolean) => void)[] = []
    private onUserJoinedCallbacks: ((userId: string) => void)[] = []
    private onUserLeftCallbacks: ((userId: string) => void)[] = []
    private localStream: MediaStream | null = null
    private onTrackCallbacks: ((stream: MediaStream, peerId: string) => void)[] = []
    private onPeerDisconnectedCallbacks: ((peerId: string) => void)[] = []
    private eventSource: EventSourcePolyfill | null = null
    private meetingId: string | null = null
    
    constructor(private userId: string) {
      this.setupEventSource()
    }

    onVideoToggle(cb: (peerId: string, enabled: boolean) => void): void {
        this.onVideoToggleCallbacks.push(cb)
      }
    
      onAudioToggle(cb: (peerId: string, enabled: boolean) => void): void {
        this.onAudioToggleCallbacks.push(cb)
      }
    
      onUserJoined(cb: (userId: string) => void): void {
        this.onUserJoinedCallbacks.push(cb)
      }
    
      onUserLeft(cb: (userId: string) => void): void {
        this.onUserLeftCallbacks.push(cb)
      }
    
    private setupEventSource(): void {
        if (this.eventSource) {
            this.eventSource.close();
        }
    
        this.eventSource = new EventSourcePolyfill(`/api/video-call/signal?userId=${this.userId}`, {
            withCredentials: true,
            heartbeatTimeout: 300000,
        });
    
        this.eventSource.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('EventSource message received:', data);
    
                switch (data.type) {
                    case 'user-joined':
                        if (data.userId !== this.userId) {
                        console.log(`User ${data.userId} joined`);
                        this.onUserJoinedCallbacks.forEach(cb => cb(data.userId))
                        }
                        break;

                    case 'user-left':
                        if (this.peerConnections.has(data.userId)) {
                        const peerConnection = this.peerConnections.get(data.userId);
                        if (peerConnection) {
                            peerConnection.close();
                        }
                        this.peerConnections.delete(data.userId);
                        this.handlePeerDisconnected(data.userId);
                        this.onUserLeftCallbacks.forEach(cb => cb(data.userId))
                        console.log(`User ${data.userId} left, connection closed`);
                        }
                        break;

                    case 'video-toggle':
                        if (data.from !== this.userId) {
                        console.log(`Received video toggle from ${data.from}: ${data.enabled}`);
                        this.notifyVideoToggle(data.from, data.enabled);
                        }
                        break;

                    case 'audio-toggle':
                        if (data.from !== this.userId) {
                        console.log(`Received audio toggle from ${data.from}: ${data.enabled}`);
                        this.notifyAudioToggle(data.from, data.enabled);
                        }
                        break;
    
                    case 'offer':
                        if (data.from !== this.userId) {
                            console.log(`Received offer from ${data.from}:`, data.offer);
                            const answer = await this.handleOffer(data.from, data.offer);
                            await this.sendSignal({
                                type: 'answer',
                                from: this.userId,
                                to: data.from,
                                answer,
                            });
                            console.log(`Answer sent to ${data.from}`);
                        }
                        break;
    
                    case 'answer':
                        if (data.from !== this.userId) {
                            console.log(`Received answer from ${data.from}:`, data.answer);
                            await this.handleAnswer(data.from, data.answer);
                            console.log(`Answer processed for ${data.from}`);
                        }
                        break;
    
                    case 'ice-candidate':
                        if (data.from !== this.userId) {
                            console.log(`Received ICE candidate from ${data.from}:`, data.candidate);
                            await this.handleIceCandidate(data.from, data.candidate);
                            console.log(`ICE candidate processed for ${data.from}`);
                        }
                        break;
    
                    case 'video-toggle':
                        if (data.from !== this.userId) {
                            console.log(`Received video toggle from ${data.from}: ${data.enabled}`);
                            this.notifyVideoToggle(data.from, data.enabled);
                        }
                        break;
    
                    case 'audio-toggle':
                        if (data.from !== this.userId) {
                            console.log(`Received audio toggle from ${data.from}: ${data.enabled}`);
                            this.notifyAudioToggle(data.from, data.enabled);
                        }
                        break;
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        };
    
        this.eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            setTimeout(() => {
                this.setupEventSource();
            }, 5000);
        };
    }
    
    
  async joinMeeting(meetingId: string): Promise<string[]> {
    if (!meetingId) {
        throw new Error('Meeting ID is required');
    }

    this.meetingId = meetingId;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    const maxRetries = 3;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
        try {
            const response = await fetch(`/api/video-call/signal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'join-meeting',
                    from: this.userId,
                    meetingId,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId); 

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `Failed to join meeting: ${response.status}`);
            }

            const data = await response.json();
            console.log('Join meeting response:', data); 

            if (!data.participants || !Array.isArray(data.participants)) {
                console.warn('Invalid participants list in response:', data.participants);
                return [];
            }

            const participants = data.participants as string[];
            for (const peerId of participants) {
                if (peerId !== this.userId) {
                    try {
                        console.log(`Initiating connection to existing participant: ${peerId}`);
                        const offer = await this.createOffer(peerId);
                        await this.sendSignal({
                            type: 'offer',
                            from: this.userId,
                            to: peerId,
                            offer,
                        });
                        console.log(`Successfully sent offer to ${peerId}`);
                    } catch (error) {
                        console.error(`Failed to initiate connection with ${peerId}:`, error);
                    }
                }
            }

            console.log(`Successfully joined meeting ${meetingId} with participants:`, participants);
            return participants;
        } catch (error) {
            clearTimeout(timeoutId); 
            attempt++;
            lastError = error as Error;

            if (error instanceof Error && error.name === 'AbortError') {
                console.error('Fetch request timed out:', error);
                throw new Error('Failed to join meeting: Request timed out');
            }

            console.error(`Attempt ${attempt}/${maxRetries} failed to join meeting:`, error);

            if (attempt === maxRetries) {
                console.error('Max retries reached. Failing to join meeting.');
                throw lastError;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
    }

    throw lastError || new Error('Failed to join meeting after retries');
}
    
    async leaveMeeting(): Promise<void> {
      if (!this.meetingId) return
      
      await this.sendSignal({
        type: 'leave-meeting',
        from: this.userId,
        meetingId: this.meetingId
      })
      
      this.closeAllConnections()
      this.meetingId = null
    }
    
    private async sendSignal(data: any): Promise<void> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
    
        try {
            const response = await fetch('/api/video-call/signal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                signal: controller.signal,
            });
    
            clearTimeout(timeoutId);
    
            if (!response.ok) {
                const responseData = await response.json();
                throw new Error(responseData.error || 'Failed to send signal');
            }
    
            console.log('Signal sent successfully:', data);
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Error sending signal:', error);
            throw error;
        }
    }
    
    async getLocalStream(video = true, audio = true): Promise<MediaStream> {
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach((track) => {
          track.enabled = video
        })
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = audio
        })
        return this.localStream
      }
      
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video,
          audio,
        })
        return this.localStream
      } catch (error) {
        console.error('Error accessing media devices:', error)
        throw error
      }
    }
    
    async createPeerConnection(peerId: string): Promise<RTCPeerConnection> {
        if (this.peerConnections.has(peerId)) {
            return this.peerConnections.get(peerId)!;
        }
    
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });
    
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, this.localStream!);
            });
        }
    
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.log(`Sending ICE candidate to ${peerId}`);
                await this.sendSignal({
                    type: 'ice-candidate',
                    from: this.userId,
                    to: peerId,
                    candidate: event.candidate,
                });
            }
        };
    
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}: ${peerConnection.connectionState}`);
            if (
                peerConnection.connectionState === 'disconnected' ||
                peerConnection.connectionState === 'failed' ||
                peerConnection.connectionState === 'closed'
            ) {
                this.handlePeerDisconnected(peerId);
            }
        };
    
        peerConnection.ontrack = (event) => {
            console.log(`Received track from ${peerId}`);
            const remoteStream = new MediaStream();
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
            this.notifyTrackAdded(remoteStream, peerId);
        };
    
        this.peerConnections.set(peerId, peerConnection);
        return peerConnection;
    }
    
    async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
      const peerConnection = await this.createPeerConnection(peerId)
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      return offer
    }
    
    async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
      const peerConnection = await this.createPeerConnection(peerId)
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      return answer
    }
    
    async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
      const peerConnection = this.peerConnections.get(peerId)
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      }
    }
    
    async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
      const peerConnection = this.peerConnections.get(peerId)
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      }
    }
    
    onTrack(callback: (stream: MediaStream, peerId: string) => void): void {
      this.onTrackCallbacks.push(callback)
    }
    
    onPeerDisconnected(callback: (peerId: string) => void): void {
      this.onPeerDisconnectedCallbacks.push(callback)
    }
    
    private notifyTrackAdded(stream: MediaStream, peerId: string): void {
      this.onTrackCallbacks.forEach((callback) => callback(stream, peerId))
    }
    
    private handlePeerDisconnected(peerId: string): void {
      this.peerConnections.delete(peerId)
      this.onPeerDisconnectedCallbacks.forEach((callback) => callback(peerId))
    }
    
    toggleVideo(enabled: boolean): void {
        if (this.localStream) {
          this.localStream.getVideoTracks().forEach((track) => {
            track.enabled = enabled;
          });
          // Notify other peers with meetingId
          this.sendSignal({
            type: 'video-toggle',
            from: this.userId,
            meetingId: this.meetingId,
            enabled,
          });
        }
      }
    
      toggleAudio(enabled: boolean): void {
        if (this.localStream) {
          this.localStream.getAudioTracks().forEach((track) => {
            track.enabled = enabled;
          });
          // Notify other peers with meetingId
          this.sendSignal({
            type: 'audio-toggle',
            from: this.userId,
            meetingId: this.meetingId,
            enabled,
          });
        }
      }


    private notifyVideoToggle(peerId: string, enabled: boolean): void {
    this.onVideoToggleCallbacks.forEach((callback) => callback(peerId, enabled))
    }

    private notifyAudioToggle(peerId: string, enabled: boolean): void {
        this.onAudioToggleCallbacks.forEach((callback) => callback(peerId, enabled))
    }
    
    closeAllConnections(): void {
      if (this.eventSource) {
        this.eventSource.close()
        this.eventSource = null
      }
      
      this.peerConnections.forEach((connection) => {
        connection.close()
      })
      this.peerConnections.clear()
      
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          track.stop()
        })
        this.localStream = null
      }
    }
  }