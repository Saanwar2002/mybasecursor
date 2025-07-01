import { useState, useRef } from 'react';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export default function PhoneVerification() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [code, setCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const handleSendCode = async () => {
    setStatus('sending');
    setError(null);
    try {
      const auth = getAuth();
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
          'size': 'invisible',
          'callback': () => {},
        }, auth);
      }
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(result);
      setStatus('sent');
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const handleVerifyCode = async () => {
    setStatus('verifying');
    setError(null);
    try {
      if (confirmationResult) {
        await confirmationResult.confirm(code);
        // Update Firestore profile
        if (user) {
          await updateDoc(doc(db, 'users', user.id), {
            phoneNumber: phone,
            phoneVerified: true,
            phoneVerificationDeadline: null,
          });
        }
        setStatus('verified');
        setEditing(false);
      }
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  if (!user) return null;

  return (
    <div className="mb-6">
      <div className="mb-2">
        <strong>Phone Number:</strong> {user.phoneNumber || 'Not set'}<br />
        <strong>Status:</strong> {user.phoneVerified ? 'Verified' : 'Unverified'}
      </div>
      {(!user.phoneVerified || editing) ? (
        <div>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+14155552671"
            className="border rounded px-2 py-1 mr-2"
            disabled={status === 'sending' || status === 'verifying'}
          />
          <Button onClick={handleSendCode} disabled={status === 'sending' || !phone}>
            {status === 'sending' ? 'Sending...' : 'Send Code'}
          </Button>
          <div id="recaptcha-container" ref={recaptchaRef}></div>
          {status === 'sent' && (
            <div className="mt-2">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Verification code"
                className="border rounded px-2 py-1 mr-2"
              />
              <Button onClick={handleVerifyCode} disabled={status === 'verifying' || !code}>
                {status === 'verifying' ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          )}
          {error && <div className="text-red-600 mt-2">{error}</div>}
        </div>
      ) : (
        <Button variant="outline" onClick={() => setEditing(true)}>
          Change Phone Number
        </Button>
      )}
      {status === 'verified' && <div className="text-green-600 mt-2">Phone number verified!</div>}
    </div>
  );
} 