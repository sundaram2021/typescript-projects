import { createClient } from '@supabase/supabase-js'

export type Participant = {
  id: string
  name?: string
  joined_at: string
}

export type Meeting = {
  id: string
  host_id: string
  created_at: string
  participants?: Participant[]
}

export class DatabaseService {
  private supabase

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }
  
  async createMeeting(hostId: string): Promise<string> {
    try {
      const meetingId = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const exists = await this.meetingExists(meetingId);
      if (exists) {
        return this.createMeeting(hostId);
      }
      
      const { error } = await this.supabase
        .from('meetings')
        .insert({
          id: meetingId,
          host_id: hostId,
        });
      
      if (error) {
        console.error('Supabase error creating meeting:', error);
        throw error;
      }
      
      await this.joinMeeting(meetingId, hostId);
      
      return meetingId;
    } catch (error) {
      console.error('Error creating meeting:', error);
      throw error;
    }
  }
  
  async joinMeeting(meetingId: string, participantId: string): Promise<Participant> {
    try {
        if (!meetingId || !participantId) {
            throw new Error('Meeting ID and Participant ID are required');
        }

        const { data: meeting, error: meetingError } = await this.supabase
            .from('meetings')
            .select('id')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            console.error('Supabase error checking meeting:', meetingError);
            throw new Error('Meeting not found');
        }

        const { data: existingParticipant, error: participantError } = await this.supabase
            .from('participants')
            .select('id, meeting_id, participant_id, joined_at')
            .eq('meeting_id', meetingId)
            .eq('participant_id', participantId)
            .single();

        if (existingParticipant) {
            console.log(`Participant ${participantId} already in meeting ${meetingId}`);
            return {
                id: existingParticipant.id,
                joined_at: existingParticipant.joined_at,
            };
        }

        if (participantError && participantError.code !== 'PGRST116') {
            console.error('Supabase error checking participant:', participantError);
            throw participantError;
        }

        const joinedAt = new Date().toISOString();
        const { data: newParticipant, error: insertError } = await this.supabase
            .from('participants')
            .insert({
                meeting_id: meetingId,
                participant_id: participantId,
                joined_at: joinedAt,
            })
            .select('id, meeting_id, participant_id, joined_at')
            .single();

        if (insertError) {
            if (insertError.code === '23505') {
                console.warn(`Participant ${participantId} already exists in meeting ${meetingId}`);
                const { data: retryParticipant, error: retryError } = await this.supabase
                    .from('participants')
                    .select('id, meeting_id, participant_id, joined_at')
                    .eq('meeting_id', meetingId)
                    .eq('participant_id', participantId)
                    .single();

                if (retryError || !retryParticipant) {
                    console.error('Supabase error retrying participant fetch:', retryError);
                    throw new Error('Failed to fetch participant after duplicate error');
                }

                return {
                    id: retryParticipant.id,
                    joined_at: retryParticipant.joined_at,
                };
            }

            console.error('Supabase error adding participant:', insertError);
            throw insertError;
        }

        console.log(`Participant ${participantId} successfully joined meeting ${meetingId}`);
        return {
            id: newParticipant.id,
            joined_at: newParticipant.joined_at,
        };
    } catch (error) {
        console.error('Error joining meeting:', error);
        throw error;
    }
}
  async leaveMeeting(meetingId: string, participantId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('participants')
        .delete()
        .eq('meeting_id', meetingId)
        .eq('participant_id', participantId)
      
      if (error) {
        console.error('Supabase error removing participant:', error)
        throw error
      }
      
      const { data: participants, error: checkError } = await this.supabase
        .from('participants')
        .select('participant_id')
        .eq('meeting_id', meetingId)
      
      if (checkError) {
        console.error('Supabase error checking participants:', checkError)
        throw checkError
      }
      
      if (!participants || participants.length === 0) {
        const { error: deleteError } = await this.supabase
          .from('meetings')
          .delete()
          .eq('id', meetingId)
          
        if (deleteError) {
          console.error('Supabase error deleting meeting:', deleteError)
          throw deleteError
        }
      }
    } catch (error) {
      console.error('Error leaving meeting:', error)
      throw error
    }
  }
  
  async getMeetingParticipants(meetingId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('participants')
        .select('participant_id')
        .eq('meeting_id', meetingId)
      
      if (error) {
        console.error('Supabase error getting participants:', error)
        throw error
      }
      
      return data ? data.map(p => p.participant_id) : []
    } catch (error) {
      console.error('Error getting meeting participants:', error)
      throw error
    }
  }

  async isMeetingActive(meetingId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('meetings')
        .select('id')
        .eq('id', meetingId)
        .single()
      
      if (error) {
        console.error('Supabase error checking meeting status:', error)
        return false
      }
      
      return !!data
    } catch (error) {
      console.error('Error checking meeting status:', error)
      return false
    }
  }
  
  async meetingExists(meetingId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('meetings')
        .select('id')
        .eq('id', meetingId)
        .single()
      
      if (error) {
        console.error('Supabase error checking meeting exists:', error)
        return false
      }
      
      return !!data
    } catch (error) {
      console.error('Error checking if meeting exists:', error)
      return false
    }
  }
}