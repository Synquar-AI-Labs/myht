import { useState, useRef, useCallback } from 'react';
import { useTranscripts, Transcript, ProcessingStep } from '@/hooks/useTranscripts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Mic, Square, Upload, Trash2, ChevronDown, ChevronRight, Loader2, Download, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';

const STEPS: { key: ProcessingStep; label: string }[] = [
  { key: 'saving', label: 'Saving recording' },
  { key: 'uploading', label: 'Uploading audio' },
  { key: 'transcribing', label: 'Transcribing audio' },
  { key: 'analyzing', label: 'Analyzing conversation' },
  { key: 'summarizing', label: 'Saving summary' },
];

function ProcessingSteps({ currentStep }: { currentStep: ProcessingStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const progress = currentIndex >= 0 ? ((currentIndex + 1) / STEPS.length) * 100 : 0;

  return (
    <div className="space-y-3 py-2">
      <Progress value={progress} className="h-2" />
      <div className="space-y-1.5">
        {STEPS.map((step, i) => {
          const isDone = i < currentIndex;
          const isActive = i === currentIndex;
          return (
            <div key={step.key} className="flex items-center gap-2 text-sm">
              {isDone ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
              )}
              <span className={isDone ? 'text-muted-foreground' : isActive ? 'font-medium' : 'text-muted-foreground/50'}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function saveRecordingLocally(blob: Blob, title: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title || 'recording'}-${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function TranscriptsTab() {
  const {
    transcripts,
    selectedDate,
    setSelectedDate,
    loading,
    processing,
    processingStep,
    processAudio,
    deleteTranscript,
    setProcessingStep,
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

      // Pick a supported mime type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // let browser pick default
          }
        }
      }

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const actualType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });

        if (blob.size === 0) {
          toast({ title: 'Error', description: 'Recording was empty. Please try again.', variant: 'destructive' });
          return;
        }

        // Save locally first so user has a backup
        setProcessingStep('saving');
        saveRecordingLocally(blob, title);
        toast({ title: 'Recording saved', description: 'A backup copy has been downloaded to your device.' });
        await processAudio(blob, title, recordedBy || 'Unknown');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // collect data every second for reliability
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      toast({ title: 'Error', description: 'Microphone access denied', variant: 'destructive' });
    }
  }, [processAudio, title, recordedBy, setProcessingStep]);

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
      <Input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="w-full"
      />

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Recorded by" value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)} />
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
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </div>
          {processing && <ProcessingSteps currentStep={processingStep} />}
        </CardContent>
      </Card>

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
        {transcript.recorded_by && <p className="text-xs text-muted-foreground">by {transcript.recorded_by}</p>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Summary</p>
          <p>{transcript.summary}</p>
        </div>

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
