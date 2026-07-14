import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranscripts, Transcript } from '@/hooks/useTranscripts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Mic, Square, Upload, Trash2, ChevronDown, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { pickRecordingMimeType, formatDuration, SPEECH_BITS_PER_SECOND } from '@/lib/recording';

export function TranscriptsTab() {
  const {
    transcripts,
    selectedDate,
    setSelectedDate,
    loading,
    processing,
    processingStage,
    canRetry,
    retryTranscription,
    processAudio,
    deleteTranscript,
  } = useTranscripts();

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setRecording(false);
  }, []);

  // Never leave the mic running if the caregiver navigates away mid-recording.
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stream.getTracks().forEach(t => t.stop());
        try { recorder.stop(); } catch { /* already stopped */ }
      }
      cleanupRecording();
    };
  }, [cleanupRecording]);

  const startRecording = useCallback(async () => {
    let stream: MediaStream;
    try {
      // Mono is all speech needs, and it halves the file size.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch (err) {
      console.error('Microphone access denied:', err);
      toast.error('Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.');
      return;
    }

    // iOS Safari records audio/mp4, Chrome records webm — pick what THIS
    // browser supports instead of assuming webm (which broke every iPhone).
    const mimeType = pickRecordingMimeType();
    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: SPEECH_BITS_PER_SECOND,
      });
    } catch (err) {
      console.error('MediaRecorder init failed:', err);
      stream.getTracks().forEach(t => t.stop());
      toast.error("This browser can't record audio. Use the Upload button with a voice memo instead.");
      return;
    }

    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onerror = () => {
      toast.error('Recording stopped unexpectedly. Anything captured so far will still be processed.');
      try { mediaRecorder.stop(); } catch { /* already stopped */ }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      cleanupRecording();
      const blob = new Blob(chunksRef.current, { type: mimeType ?? mediaRecorder.mimeType ?? 'audio/webm' });
      if (blob.size > 0) {
        await processAudio(blob, title, recordedBy || 'Unknown');
      } else {
        toast.error('No audio was captured. Please try again.');
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    // Collect a chunk every second — a long conversation isn't one fragile
    // giant buffer, and an unexpected stop keeps everything captured so far.
    mediaRecorder.start(1000);
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    // Keep the phone screen awake: on iOS, auto-lock suspends recording and
    // silently kills long conversations.
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      wakeLockRef.current = (await nav.wakeLock?.request('screen')) ?? null;
    } catch { /* unsupported or denied — recording still works while awake */ }
  }, [processAudio, title, recordedBy, cleanupRecording]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else cleanupRecording();
  }, [cleanupRecording]);

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
                <Square className="h-4 w-4 mr-1" /> Stop · {formatDuration(elapsed)}
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
              accept="audio/*,.m4a,.mp3,.wav,.aac,.caf,.mp4,video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          {recording && (
            <div className="flex items-center justify-center gap-2 py-1 text-sm font-medium text-destructive">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              Recording — keep the phone unlocked
            </div>
          )}
          {processing && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {processingStage === 'uploading' && 'Uploading audio…'}
              {processingStage === 'transcribing' && 'Transcribing — this can take a minute for long talks…'}
              {processingStage === 'saving' && 'Saving transcript…'}
            </div>
          )}
          {canRetry && !processing && (
            <Button variant="outline" onClick={retryTranscription} className="w-full">
              <RotateCcw className="h-4 w-4 mr-1" /> Try transcribing again — the audio is already uploaded
            </Button>
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
