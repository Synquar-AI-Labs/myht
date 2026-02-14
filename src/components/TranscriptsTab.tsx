import { useState, useRef, useCallback } from 'react';
import { useTranscripts, Transcript } from '@/hooks/useTranscripts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Mic, Square, Upload, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function TranscriptsTab() {
  const {
    transcripts,
    selectedDate,
    setSelectedDate,
    loading,
    processing,
    processAudio,
    deleteTranscript,
  } = useTranscripts();

  const [recording, setRecording] = useState(false);
  const [title, setTitle] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) {
          await processAudio(blob, title, recordedBy || 'Unknown');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [processAudio, title, recordedBy]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await processAudio(file, title, recordedBy || 'Unknown');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processAudio, title, recordedBy]
  );

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <Input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="w-full"
      />

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="Recorded by"
            value={recordedBy}
            onChange={(e) => setRecordedBy(e.target.value)}
          />
          <div className="flex gap-2">
            {recording ? (
              <Button variant="destructive" onClick={stopRecording} className="flex-1">
                <Square className="h-4 w-4 mr-1" /> Stop
              </Button>
            ) : (
              <Button onClick={startRecording} disabled={processing} className="flex-1">
                <Mic className="h-4 w-4 mr-1" /> Record
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing || recording}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-1" /> Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          {processing && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Transcribing & analyzing...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : transcripts.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No transcripts for {format(parseISO(selectedDate), 'MMM d, yyyy')}
        </p>
      ) : (
        transcripts.map((t) => <TranscriptCard key={t.id} transcript={t} onDelete={deleteTranscript} />)
      )}
    </div>
  );
}

function TranscriptCard({ transcript, onDelete }: { transcript: Transcript; onDelete: (id: string) => void }) {
  const [showTodo, setShowTodo] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showFull, setShowFull] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium">
            {transcript.title || format(parseISO(transcript.created_at), 'h:mm a')}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(transcript.id)}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
        {transcript.recorded_by && (
          <p className="text-xs text-muted-foreground">by {transcript.recorded_by}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {/* Summary always visible */}
        <div>
          <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Summary</p>
          <p>{transcript.summary}</p>
        </div>

        {/* Things to do */}
        {transcript.action_items.length > 0 && (
          <Collapsible open={showTodo} onOpenChange={setShowTodo}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary">
              {showTodo ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Things To Do ({transcript.action_items.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 space-y-1 pl-4">
                {transcript.action_items.map((item, i) => (
                  <li key={i} className="list-disc text-sm">{item}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Follow ups */}
        {transcript.follow_ups.length > 0 && (
          <Collapsible open={showFollowUp} onOpenChange={setShowFollowUp}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary">
              {showFollowUp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Things To Follow Up ({transcript.follow_ups.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 space-y-1 pl-4">
                {transcript.follow_ups.map((item, i) => (
                  <li key={i} className="list-disc text-sm">{item}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Full transcript */}
        <Collapsible open={showFull} onOpenChange={setShowFull}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary">
            {showFull ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Full Transcript
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{transcript.transcript}</p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
