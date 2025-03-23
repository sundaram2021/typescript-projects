export class WebRTCService {
    private peerConnections: Map<string, RTCPeerConnection> = new Map()
    private localStream: MediaStream | null = null
    private onTrackCallbacks: ((stream: MediaStream, peerId: string) => void)[] = []
    private onPeerDisconnectedCallbacks: ((peerId: string) => void)[] = []
    private eventSource: EventSource | null = null
    private meetingId: string | null = null
    
    constructor(private userId: string) {
      this.setupEventSource()
    }
    
    private setupEventSource(): void {
      if (this.eventSource) {
        this.eventSource.close()
      }
      
      this.eventSource = new EventSource(`/api/video-call/signal?userId=${this.userId}`)
      
      this.eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)
          
          switch (data.type) {
            case 'user-joined':
              if (data.userId !== this.userId) {
                console.log(`User ${data.userId} joined, initiating connection`)
                const offer = await this.createOffer(data.userId)
                this.sendSignal({
                  type: 'offer',
                  from: this.userId,
                  to: data.userId,
                  offer
                })
              }
              break
              
            case 'user-left':
              if (this.peerConnections.has(data.userId)) {
                this.peerConnections.get(data.userId)?.close()
                this.peerConnections.delete(data.userId)
                this.handlePeerDisconnected(data.userId)
              }
              break
              
            case 'offer':
              if (data.from !== this.userId) {
                console.log(`Received offer from ${data.from}`)
                const answer = await this.handleOffer(data.from, data.offer)
                this.sendSignal({
                  type: 'answer',
                  from: this.userId,
                  to: data.from,
                  answer
                })
              }
              break
              
            case 'answer':
              if (data.from !== this.userId) {
                console.log(`Received answer from ${data.from}`)
                await this.handleAnswer(data.from, data.answer)
              }
              break
              
            case 'ice-candidate':
              if (data.from !== this.userId) {
                console.log(`Received ICE candidate from ${data.from}`)
                await this.handleIceCandidate(data.from, data.candidate)
              }
              break
          }
        } catch (error) {
          console.error('Error handling message:', error)
        }
      }
      
      this.eventSource.onerror = (error) => {
        console.error('EventSource error:', error)
        
        setTimeout(() => {
          this.setupEventSource()
        }, 5000)
      }
    }
    
async joinMeeting(meetingId: string): Promise<string[]> {
    this.meetingId = meetingId
    
    try {
      const response = await fetch(`/api/video-call/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'join-meeting',
          from: this.userId,
          meetingId
        }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join meeting');
      }
      
      if (data.participants && Array.isArray(data.participants)) {
        for (const peerId of data.participants) {
          if (peerId !== this.userId) {
            console.log(`Initiating connection to existing participant: ${peerId}`);
            const offer = await this.createOffer(peerId);
            await this.sendSignal({
              type: 'offer',
              from: this.userId,
              to: peerId,
              offer
            });
          }
        }
        return data.participants;
      }
      return [];
    } catch (error) {
      console.error('Error joining meeting:', error);
      throw error;
    }
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
      try {
        await fetch('/api/video-call/signal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })
      } catch (error) {
        console.error('Error sending signal:', error)
        throw error
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
        return this.peerConnections.get(peerId)!
      }
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
      })
      
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, this.localStream!)
        })
      }
      
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await this.sendSignal({
            type: 'ice-candidate',
            from: this.userId,
            to: peerId,
            candidate: event.candidate
          })
        }
      }
      
      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed'
        ) {
          this.handlePeerDisconnected(peerId)
        }
      }
      
      peerConnection.ontrack = (event) => {
        const remoteStream = new MediaStream()
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track)
        })
        this.notifyTrackAdded(remoteStream, peerId)
      }
      
      this.peerConnections.set(peerId, peerConnection)
      return peerConnection
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
    
    toggleAudio(enabled: boolean): void {
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = enabled
        })
      }
    }
    
    toggleVideo(enabled: boolean): void {
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach((track) => {
          track.enabled = enabled
        })
      }
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