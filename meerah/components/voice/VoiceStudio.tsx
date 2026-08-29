'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Download, Loader2 } from 'lucide-react';
import { api, ApiError, type ClonedVoice, type SpokenAudio, type VoiceQuote, type VoiceStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { GUIDES } from '@/lib/guides';
import { exampleImage } from '@/lib/tools';

/**
 * MyVoice.
 *
 * The one thing here that no competitor has, and until now the only trace of it
 * in the product was a decorative animation on the landing page linking to an
 * anchor that went nowhere.
 *
 * Two things make this tool different from the rest of the studio, and both
 * shape the interface:
 *
 *   · The vendor bills in Naira per character, not dollars per generation. So
 *     the price is knowable from the text before anything is submitted, and it
 *     is exact rather than an estimate. It updates as you type.
 *
 *   · A cloned voice is a fraud tool in this market. Consent is not a checkbox
 *     to get past — the server refuses without it, and the reason is written
 *     next to it rather than buried in terms.
 */

const MAX_CHARACTERS = 5_000;

export default function VoiceStudio() {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [language, setLanguage] = useState('pcm');
  const [script, setScript] = useState('');
  const [quote, setQuote] = useState<VoiceQuote | null>(null);
  const [useOwnVoice, setUseOwnVoice] = useState(false);
  const [voices, setVoices] = useState<ClonedVoice[]>([]);
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<SpokenAudio | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api.voice.status().then(setStatus).catch(() => setStatus(null));
    void api.brand.list('voice_profile')
      .then((r) => setVoices(r.items.map((a) => ({ id: a.id, name: a.name, language: '' }))))
      .catch(() => { /* the tool works with presets alone */ });
  }, []);

  // The quote is the product's whole positioning — see the price before you
  // spend it — so it follows the text rather than waiting for a button. A short
  // debounce keeps a fast typist from firing a request per keystroke.
  useEffect(() => {
    const text = script.trim();
    if (!text) { setQuote(null); return undefined; }
    const timer = setTimeout(() => {
      void api.voice.quote(text, useOwnVoice).then(setQuote).catch(() => setQuote(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [script, useOwnVoice]);

  const speak = useCallback(async () => {
    setError('');
    setSpeaking(true);
    try {
      setResult(await api.voice.speak(script.trim(), language, useOwnVoice ? voiceId : undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not make that audio. Try again.');
    } finally {
      setSpeaking(false);
    }
  }, [script, language, useOwnVoice, voiceId]);

  const over = script.length > MAX_CHARACTERS;
  const ready = script.trim().length > 0 && !over && !speaking && (!useOwnVoice || Boolean(voiceId));

  if (status && !status.available) return <Unavailable />;

  return (
    <div className="flex h-full w-full flex-col lg:flex-row bg-background">
      {/* ── Settings rail ─────────────────────────────────────────────── */}
      <aside className="w-full shrink-0 bg-[var(--sunk)] lg:w-[370px] flex flex-col">
        <div className="custom-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
          <section>
            <Label className="mb-2.5 block">Language</Label>
            {status ? (
              <div className="grid grid-cols-2 gap-1.5">
                {status.languages.map((entry) => (
                  <button key={entry.code} type="button" onClick={() => setLanguage(entry.code)}
                    aria-pressed={language === entry.code}
                    className={`rounded px-3 py-2.5 text-left text-[13px] transition-colors ${
                      language === entry.code
                        ? 'bg-[var(--slab-hi)] text-[var(--lilac)]-foreground font-semibold'
                        : 'bg-card text-[var(--iron)] hover:bg-secondary hover:text-[var(--chalk)]'
                    }`}>
                    {entry.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2.5 flex items-center gap-3">
              <Label className="mb-0">Whose voice</Label>
              <Switch checked={useOwnVoice} onCheckedChange={setUseOwnVoice}
                aria-label="Use my own voice" className="ml-auto" />
            </div>
            <p className="text-[12.5px] leading-relaxed text-[var(--steel)]">
              {useOwnVoice
                ? 'Your own voice reads the script.'
                : 'A preset voice reads the script. Switch this on to use your own.'}
            </p>

            {useOwnVoice && (
              <div className="mt-3">
                {voices.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {voices.map((voice) => (
                      <button key={voice.id} type="button" onClick={() => setVoiceId(voice.id)}
                        aria-pressed={voiceId === voice.id}
                        className={`rounded px-3 py-2.5 text-left text-[13px] transition-colors ${
                          voiceId === voice.id
                            ? 'bg-secondary font-semibold text-[var(--chalk)]'
                            : 'bg-card text-[var(--iron)] hover:bg-secondary'
                        }`}>
                        {voice.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] leading-relaxed text-[var(--fog)]">
                    You have not registered a voice yet. Record one on the right — it is free.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <Label htmlFor="script" className="mb-2.5 block">Script</Label>
            <Textarea id="script" value={script} onChange={(e) => setScript(e.target.value)}
              placeholder="Abeg come see wetin we get this weekend — price better pass last week" className="min-h-[140px]" />
            <p className={`mt-1.5 text-right text-[11px] tabular-nums ${over ? 'text-destructive' : 'text-[var(--fog)]'}`}>
              {script.length.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
            </p>
          </section>
        </div>

        {/* Pinned foot: the price, then the action. */}
        <div className="px-5 py-4">
          <div className="rounded bg-card px-4 py-3">
            {quote ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-[var(--chalk)]">
                    {quote.credits} credit{quote.credits === 1 ? '' : 's'}
                  </span>
                  <span className="tabular-nums text-[13px] font-semibold text-[var(--chalk)]">
                    ₦{quote.naira.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--fog)]">
                  Exact, not an estimate — this is charged per character.
                </p>
              </>
            ) : (
              <p className="text-[12.5px] text-[var(--fog)]">Type a script to see the price.</p>
            )}
          </div>

          <Button className="mt-3 w-full" size="lg" disabled={!ready} onClick={() => void speak()}>
            {speaking ? <Loader2 className="animate-spin" /> : null}
            {speaking ? 'Speaking…' : quote ? `Speak · ₦${quote.naira.toLocaleString()}` : 'Speak'}
          </Button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--ash)]">
            Nothing is charged until it works. A failed job is refunded automatically.
          </p>
        </div>
      </aside>

      {/* ── Work area ─────────────────────────────────────────────────── */}
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          {error && (
            <div className="mb-6 rounded border-l-[3px] border-l-destructive bg-card px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {result ? (
            <Result result={result} onNew={() => setResult(null)} />
          ) : (
            <CloneVoice
              language={language}
              onCloned={(voice) => {
                setVoices((all) => [...all, voice]);
                setVoiceId(voice.id);
                setUseOwnVoice(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** The finished audio. */
function Result({ result, onNew }: { result: SpokenAudio; onNew: () => void }) {
  return (
    <section>
      <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--lilac)]">Ready</p>
      <h1 className="display text-[28px] leading-tight">Here it is</h1>
      <div className="mt-6 rounded bg-card p-5">
        <audio controls src={result.url} className="w-full" />
        <p className="mt-3 text-[12.5px] text-[var(--fog)]">
          {result.characters.toLocaleString()} characters · {result.credits} credit
          {result.credits === 1 ? '' : 's'} · ₦{result.naira.toLocaleString()}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <a href={result.url} download><Download /> Download</a>
        </Button>
        <Button variant="ghost" onClick={onNew}>Make another</Button>
      </div>
    </section>
  );
}

/**
 * Registering a voice.
 *
 * Recording happens in the browser via MediaRecorder rather than an upload
 * field, because "record five seconds" is the whole promise and asking someone
 * to find an audio file breaks it.
 */
function CloneVoice({ language, onCloned }: { language: string; onCloned: (voice: ClonedVoice) => void }) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    recorder.current?.stop();
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    if (ticker.current) clearInterval(ticker.current);
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => setBlob(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      rec.start();
      recorder.current = rec;
      setSeconds(0);
      setRecording(true);
      ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('Could not reach your microphone. Check the permission and try again.');
    }
  }, []);

  useEffect(() => () => { if (ticker.current) clearInterval(ticker.current); }, []);

  const save = useCallback(async () => {
    if (!blob) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('sample', blob, 'sample.webm');
      form.append('name', name.trim());
      form.append('language', language);
      form.append('consent', 'true');
      onCloned(await api.voice.clone(form));
      setBlob(null);
      setName('');
      setConsent(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register that voice.');
    } finally {
      setSaving(false);
    }
  }, [blob, name, language, onCloned]);

  return (
    <section>
      <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--lilac)]">
        Free, and only once
      </p>
      <h1 className="display text-[28px] leading-tight">Record your voice</h1>
      <p className="mt-2.5 max-w-[46ch] text-[15px] leading-relaxed text-[var(--iron)]">
        Speak for five seconds and MyVoice can read anything you write in your own voice.
        Registering costs nothing — you are only charged for what it says.
      </p>

      <div className="mt-7 rounded bg-card p-5">
        <div className="flex items-center gap-4">
          <Button size="lg" variant={recording ? 'destructive' : 'default'}
            onClick={() => (recording ? stop() : void start())}>
            {recording ? <Square /> : <Mic />}
            {recording ? 'Stop' : blob ? 'Record again' : 'Start recording'}
          </Button>
          {recording && (
            <span className="tabular-nums text-sm text-[var(--fog)]">
              {seconds}s {seconds < 5 ? '— keep going' : '— that is enough'}
            </span>
          )}
          {blob && !recording && (
            <audio controls src={URL.createObjectURL(blob)} className="h-9 flex-1" />
          )}
        </div>

        {blob && !recording && (
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <Label htmlFor="voice-name" className="mb-2 block">Name this voice</Label>
              <input id="voice-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My voice, or Ada reading adverts"
                className="w-full rounded border border-[var(--line-soft)] bg-background px-3 py-2.5 text-sm
                           text-[var(--paper-ink)] placeholder:text-[var(--ash)]
                           focus-visible:border-ring focus-visible:outline-none" />
            </div>

            {/* Not a formality. The server refuses without it, and the reason
                is here rather than in terms nobody reads. */}
            <label className="flex cursor-pointer items-start gap-3 rounded bg-background p-3.5">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--indigo)]" />
              <span className="text-[12.5px] leading-relaxed text-[var(--paper-ink)]">
                This is my own voice, or I have the speaker&rsquo;s permission to use it.
                <span className="mt-1 block text-[var(--fog)]">
                  A cloned voice can be used to impersonate someone. We record this against
                  the voice, and accounts that clone without permission are closed.
                </span>
              </span>
            </label>

            {error && <p className="text-[13px] text-destructive">{error}</p>}

            <Button onClick={() => void save()} disabled={!consent || !name.trim() || saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {saving ? 'Registering…' : 'Register this voice'}
            </Button>
          </div>
        )}

        {!blob && !recording && error && <p className="mt-4 text-[13px] text-destructive">{error}</p>}
      </div>

      <p className="mt-6 max-w-[52ch] text-[12px] leading-relaxed text-[var(--fog)]">
        Prefer not to? Leave &ldquo;Whose voice&rdquo; switched off and a preset voice reads your
        script instead. Everything else works the same.
      </p>

      {/* What people use this for. The record card above is a working
          affordance, so these sit under it as context rather than replacing
          it — the same call as Patch Up's drop zone. */}
      <div className="mt-8">
        <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--fog)]">
          What people make with it
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {(GUIDES.myvoice?.examples ?? []).map((caption, i) => (
            <figure key={caption} className="min-w-0">
              <img src={exampleImage('myvoice', i + 1)} alt={caption}
                width={640} height={360} loading="lazy" decoding="async"
                className="aspect-video w-full rounded object-cover" />
              <figcaption className="mt-1.5 text-[11.5px] leading-snug text-[var(--fog)]">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** MyVoice switched off is a state, not an error — say so, and offer the next best thing. */
function Unavailable() {
  return (
    <div className="grid h-full w-full place-items-center bg-background px-6">
      <div className="max-w-[46ch] text-center">
        <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--lilac)]">
          Not switched on yet
        </p>
        <h1 className="display text-[28px] leading-tight">MyVoice is coming</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--iron)]">
          The Nigerian-language voices are not connected on this account yet. SoundTrack can
          make you a voiceover in the meantime.
        </p>
        <Button asChild className="mt-6"><a href="/create/soundtrack">Open SoundTrack</a></Button>
      </div>
    </div>
  );
}
