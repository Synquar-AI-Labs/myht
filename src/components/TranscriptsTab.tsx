import { useState, useRef } from 'react';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { useTranscripts, Transcript } from '@/hooks/useTranscripts';
import { useRecording } from '@/hooks/RecordingProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Mic, Square, Upload, Trash2, ChevronDown, ChevronRight, Loader2, RotateCcw, Download, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatDuration, describeBytes } from '@/lib/recording';

export function TranscriptsTab() {
  const { transcripts, selectedDate, setSelectedDate, loading, deleteTranscript } = useTranscripts();
  const {
    job, elapsed, isRecording, busy,
    setMetadata, startRecording, stopRecording, processFile, retry, discard, downloadAudio,
  } = useRecording();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = job.status;
  const title = job.metadata.title;
  const recordedBy = job.metadata.recordedBy;

  const metaForNewJob = () => ({ title, recordedBy, date: selectedDate });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file, metaForNewJob());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stageText =
    status === 'uploading' ? 'Uploading audio…' :
    status === 'transcribing' ? 'Transcribing — this can take a minute for long talks…' :
    status === 'saving' ? 'Saving transcript…' : '';

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
            onChange={(e) => setMetadata({ title: e.target.value })}
          />
          <Input
            placeholder="Recorded by"
            value={recordedBy}
            onChange={(e) => setMetadata({ recordedBy: e.target.value })}
          />
          <div className="flex gap-2">
            {isRecording ? (
              <Button variant="destructive" onClick={stopRecording} className="flex-1">
                <Square className="h-4 w-4 mr-1" /> Stop · {formatDuration(elapsed)}
              </Button>
            ) : (
              <Button onClick={() => startRecording(metaForNewJob())} disabled={busy} className="flex-1">
                <Mic className="h-4 w-4 mr-1" /> Record
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
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

          {isRecording && (
            <div className="flex items-center justify-center gap-2 py-1 text-sm font-medium text-destructive">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              Recording — keep the phone unlocked
            </div>
          )}

          {stageText && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {stageText}
            </div>
          )}

          {/* Recoverable failure: the audio is never lost. */}
          {(status === 'upload-failed' || status === 'transcribe-failed' || status === 'too-large' || status === 'captured') && !busy && (
            <div className="space-y-2 rounded-lg border border-[#f0c9ae] bg-[#fdf0e6] p-3">
              <p className="text-sm font-medium text-[#c2740c]">
                {status === 'transcribe-failed' && 'Uploaded, but transcription failed. Your audio is safe.'}
                {status === 'upload-failed' && "Couldn't upload the recording. It's still on this device."}
                {status === 'too-large' && `This recording is ${job.bytes ? describeBytes(job.bytes) : 'too large'} to transcribe (limit ~90 min).`}
                {status === 'captured' && 'Recording captured.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {(status === 'upload-failed' || status === 'transcribe-failed' || status === 'captured') && (
                  <Button size="sm" onClick={retry}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    {status === 'transcribe-failed' ? 'Try transcribing again' : 'Try again'}
                  </Button>
                )}
                {job.blob && (
                  <Button size="sm" variant="outline" onClick={downloadAudio}>
                    <Download className="h-4 w-4 mr-1" /> Download audio
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={discard}>
                  <X className="h-4 w-4 mr-1" /> Discard
                </Button>
              </div>
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
          <ConfirmDeleteButton variant="ghost" size="icon" className="h-7 w-7" title="Delete this conversation?" description={`${transcript.title || format(parseISO(transcript.created_at), 'h:mm a')}. This permanently removes it from the record.`} onConfirm={() => onDelete(transcript.id)}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </ConfirmDeleteButton>
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
