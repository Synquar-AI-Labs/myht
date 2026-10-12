import { useEffect, useRef, useState } from 'react';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { accountError } from '@/lib/accountSetup';
import { SetupBrand, SetupField, SetupLayout } from '@/components/setup/SetupLayout';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type Screen = 'main' | 'signup' | 'signin' | 'code' | 'forgot' | 'recovery' | 'password';
export default function Auth() {
  const [screen, setScreen] = useState<Screen>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useUpdateBusy(busy || screen !== 'main');
  const codeInput = useRef<HTMLInputElement>(null);
  const recovering = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !recovering.current) navigate('/', { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !recovering.current) navigate('/', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const go = (next: Screen) => {
    if (next === 'main' || next === 'signin' || next === 'signup') recovering.current = false;
    setError(''); setNotice(''); setCode(''); setScreen(next);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (screen === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
        // Existing accounts may produce either an obfuscated success or an error.
        if (error && error.code !== 'user_already_exists' && !/already registered/i.test(error.message)) throw error;
        go('code');
      } else if (screen === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error?.code === 'email_not_confirmed') {
          const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
          go('code');
          if (resendError) setError(accountError(resendError));
          else setNotice('Confirm your email first. We sent you a new code.');
          return;
        }
        if (error) throw error;
      } else if (screen === 'forgot') {
        recovering.current = true;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        go('recovery');
      } else if (screen === 'code' || screen === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: screen === 'recovery' ? 'recovery' : 'email' });
        if (error) {
          setCode('');
          requestAnimationFrame(() => codeInput.current?.focus());
          throw error;
        }
        if (screen === 'recovery') { setPassword(''); go('password'); }
        else navigate('/', { replace: true });
      } else if (screen === 'password') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        recovering.current = false;
        navigate('/', { replace: true });
      }
    });
  };
  const resend = () => void run(async () => {
    const { error } = screen === 'recovery'
      ? await supabase.auth.resetPasswordForEmail(email.trim())
      : await supabase.auth.resend({ type: 'signup', email: email.trim() });
    if (error) throw error;
    setCode('');
    setNotice('New code sent.');
  });
  if (screen === 'main') return <SetupLayout>
    <SetupBrand />
    <h1 className="setup-hero" style={{ paddingTop: 44 }}>Look after someone, together.</h1>
    <p>One shared place for medicines, feeds and readings. Everyone who helps can see what was given and what is due next.</p>
    <div style={{ flexGrow: 1 }} />
    <p className="setup-card setup-small">Private to your family. Only the people you invite can see it.</p>
    <button className="setup-primary" onClick={() => go('signup')}>Create an account</button>
    <button className="setup-secondary" onClick={() => go('signin')}>I already have an account</button>
  </SetupLayout>;
  const isCode = screen === 'code' || screen === 'recovery';
  const title = screen === 'signup' ? 'Create your account' : screen === 'signin' ? 'Welcome back'
    : screen === 'forgot' ? 'Forgot your password?' : screen === 'password' ? 'Choose a new password' : 'Check your email';
  return <SetupLayout>
    <button className="setup-link" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => go('main')}>‹ Back</button>
    {screen === 'signin' && <SetupBrand />}
    <h1>{title}</h1>
    {isCode && <p>Enter the 6-digit code for <strong>{email}</strong> {screen === 'code' ? 'to finish creating your account.' : 'to reset your password.'}</p>}
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        {screen === 'signup' && <SetupField label="Your name" id="name" required maxLength={40} autoComplete="given-name" placeholder="First name is enough" value={name} onChange={e => setName(e.target.value)} />}
        {!isCode && screen !== 'password' && <SetupField label="Email" id="email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />}
        {(screen === 'signup' || screen === 'signin' || screen === 'password') && <SetupField label="Password" id="password" type="password" required minLength={screen === 'signin' ? undefined : 8} autoComplete={screen === 'signin' ? 'current-password' : 'new-password'} placeholder={screen === 'signin' ? 'Your password' : 'Choose a password'} value={password} onChange={e => setPassword(e.target.value)} />}
        {(screen === 'signup' || screen === 'password') && <p className="setup-small">At least 8 characters.</p>}
        {isCode && <InputOTP ref={codeInput} aria-label="6-digit code" maxLength={6} pattern="[0-9]*" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode}>
          <InputOTPGroup className="w-full gap-2">{Array.from({ length: 6 }, (_, i) => <InputOTPSlot key={i} index={i} className="h-[62px] flex-1 rounded-xl border border-[#b9ae9c] bg-white text-[26px] font-bold first:rounded-xl last:rounded-xl" />)}</InputOTPGroup>
        </InputOTP>}
        <button className="setup-primary" disabled={busy || (isCode && code.length !== 6)}>{busy ? 'Please wait…' : screen === 'signin' ? 'Sign in' : screen === 'password' ? 'Save password' : 'Continue'}</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="setup-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {isCode && <button className="setup-link" disabled={busy} onClick={resend}>Send the code again</button>}
    {(screen === 'signin' || screen === 'code') && <button className="setup-link" disabled={busy} onClick={() => { recovering.current = true; go('forgot'); }}>Forgot your password?</button>}
    {screen === 'code' && <button className="setup-link" disabled={busy} onClick={() => go('signin')}>Sign in instead</button>}
    {screen === 'signup' && <p className="setup-small">Next, we check your email with a 6-digit code. You do that once.</p>}
    {isCode && <p className="setup-small">It can take a minute to arrive. Look in spam too. A phone or tablet stays signed in, so most days nobody does this.</p>}
    {screen === 'signin' && <p className="setup-small">A phone or tablet stays signed in, so most days nobody types this.</p>}
  </SetupLayout>;
}
