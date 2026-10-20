/**
 * Settings -> Business profile: the operator's contact number and whether it has been
 * SMS-verified. This is where "Verify later" from signup is completed: an unverified number
 * shows a "Verify number" action that runs the same Firebase OTP flow as signup
 * (PhoneVerifyField) and saves via PATCH /api/auth/profile.
 */
import { useEffect, useState } from 'react';
import { BadgeCheck, Phone, ShieldAlert } from 'lucide-react';
import PhoneVerifyField, { type VerifiedPhone } from '../auth/PhoneVerifyField';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import { ApiError } from '../../services/apiError';
import { isFirebaseConfigured } from '../../services/firebase';

interface ContactState {
  contactNumber: string | null;
  phoneVerified: boolean;
}

export default function ContactNumberSection() {
  const { showToast } = useToast();
  const [contact, setContact] = useState<ContactState | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.auth
      .getProfile()
      .then((c) => { if (!cancelled) setContact(c); })
      .catch(() => { /* section simply stays hidden if the profile can't be loaded */ });
    return () => { cancelled = true; };
  }, []);

  async function handleVerified(phone: VerifiedPhone | null) {
    if (!phone?.phoneIdToken || saving) return;
    setSaving(true);
    try {
      await apiClient.auth.completeProfile(phone.contactNumber, { phoneIdToken: phone.phoneIdToken });
      setContact({ contactNumber: phone.contactNumber, phoneVerified: true });
      setVerifying(false);
      showToast('Contact number verified');
    } catch (err) {
      showToast(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : 'Could not save your verified number. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!contact) return null;
  const canVerify = isFirebaseConfigured();

  return (
    <section className="bp-sec" aria-labelledby="bp-contact-title">
      <div className="bp-sec-head">
        <span className="bp-sec-icon" aria-hidden="true"><Phone size={18} /></span>
        <div className="bp-sec-titles">
          <h2 className="bp-sec-title" id="bp-contact-title">Contact number</h2>
          <p className="bp-sec-sub">We use this to reach you about your account.</p>
        </div>
      </div>

      <div className="bp-contact">
        <span className="bp-contact-number">{contact.contactNumber ?? 'No number on file'}</span>
        {contact.phoneVerified ? (
          <span className="bp-badge bp-badge--ok">
            <BadgeCheck size={14} aria-hidden="true" /> Verified
          </span>
        ) : (
          <span className="bp-badge bp-badge--warn">
            <ShieldAlert size={14} aria-hidden="true" /> Not verified
          </span>
        )}
      </div>

      {!contact.phoneVerified && !verifying && (
        canVerify ? (
          <button type="button" className="btn-outline btn-outline--sm" onClick={() => setVerifying(true)}>
            Verify number
          </button>
        ) : (
          <p className="bp-sec-sub">SMS verification isn&apos;t available right now.</p>
        )
      )}

      {!contact.phoneVerified && verifying && (
        <PhoneVerifyField
          id="bp-contact-number"
          variant="card"
          initialNumber={contact.contactNumber ?? ''}
          allowLater={false}
          onChange={handleVerified}
        />
      )}
    </section>
  );
}
