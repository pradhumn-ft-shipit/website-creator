"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Field } from "@/components/auth/field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { postJson } from "@/lib/api/client";
import {
  LEAD_FREQUENCIES,
  type AccountSettings,
  type LeadFrequency,
} from "@/lib/account/settings";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/validation";

/**
 * The interactive body of the Settings tab (PRD §12.9): profile, login email,
 * password, notification preferences, and the account-deletion danger zone.
 * One client component so the whole tab hydrates once; each section owns its own
 * submit state and inline result message. Read-only domain status is rendered
 * server-side by the page, not here.
 */
export function SettingsForm({ settings }: { settings: AccountSettings }) {
  return (
    <div className="flex flex-col gap-8">
      <ProfileSection fullName={settings.fullName} firmName={settings.firmName} />
      <EmailSection email={settings.email} />
      <PasswordSection />
      <NotificationsSection prefs={settings.notifications} />
      <DangerZone deletion={settings.deletion} />
    </div>
  );
}

// ---- shared section chrome --------------------------------------------------

function Section({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <Card tone={tone}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function SaveButton({
  submitting,
  idle,
  busy,
  disabled,
}: {
  submitting: boolean;
  idle: string;
  busy: string;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" disabled={submitting || disabled}>
      {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {submitting ? busy : idle}
    </Button>
  );
}

// ---- profile ----------------------------------------------------------------

function ProfileSection({
  fullName,
  firmName,
}: {
  fullName: string;
  firmName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [firm, setFirm] = useState(firmName);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const { error } = await postJson("/api/account/profile", {
      fullName: name,
      firmName: firm,
    });
    setSubmitting(false);
    if (error) {
      setMessage({ tone: "error", text: error.message });
      return;
    }
    setMessage({ tone: "success", text: "Profile saved." });
    router.refresh();
  }

  return (
    <Section title="Profile" description="Your name and firm, as you'd like them shown.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
        <Field
          id="full-name"
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Jane Advisor"
        />
        <Field
          id="firm-name"
          label="Firm name"
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          autoComplete="organization"
          placeholder="Cedar Ridge Wealth"
        />
        <SaveButton submitting={submitting} idle="Save profile" busy="Saving…" />
      </form>
    </Section>
  );
}

// ---- email ------------------------------------------------------------------

function EmailSection({ email }: { email: string }) {
  const [value, setValue] = useState(email);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const unchanged = value.trim().toLowerCase() === email.trim().toLowerCase();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const { error } = await postJson("/api/auth/change-email", { email: value });
    setSubmitting(false);
    if (error) {
      setMessage({ tone: "error", text: error.message });
      return;
    }
    setMessage({
      tone: "success",
      text: `We sent a confirmation link to ${value.trim()}. Your email changes once you click it — your current address stays active until then.`,
    });
  }

  return (
    <Section
      title="Login email"
      description="The address you sign in with. Changing it needs confirmation from the new inbox."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
        <Field
          id="email"
          label="Email address"
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="email"
          required
        />
        <SaveButton
          submitting={submitting}
          idle="Update email"
          busy="Sending…"
          disabled={unchanged}
        />
      </form>
    </Section>
  );
}

// ---- password ---------------------------------------------------------------

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const err = validatePassword(password);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    const { error } = await postJson("/api/auth/update-password", { password });
    setSubmitting(false);
    if (error) {
      setMessage({ tone: "error", text: error.message });
      return;
    }
    setPassword("");
    setMessage({ tone: "success", text: "Password updated." });
  }

  return (
    <Section title="Password" description="Set a new password for your account.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
        <Field
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setFieldError(validatePassword(password))}
          error={fieldError}
          aria-describedby="new-password-hint"
        />
        {!fieldError ? (
          <p id="new-password-hint" className="text-muted-foreground -mt-2 text-xs">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        ) : null}
        <SaveButton
          submitting={submitting}
          idle="Update password"
          busy="Saving…"
          disabled={!password}
        />
      </form>
    </Section>
  );
}

// ---- notifications ----------------------------------------------------------

const FREQUENCY_LABELS: Record<LeadFrequency, string> = {
  instant: "Email me for every new lead",
  daily: "One daily digest of new leads",
  off: "Don't email me about leads",
};

function NotificationsSection({
  prefs,
}: {
  prefs: AccountSettings["notifications"];
}) {
  const [leadFrequency, setLeadFrequency] = useState<LeadFrequency>(
    prefs.leadFrequency,
  );
  const [systemAlerts, setSystemAlerts] = useState(prefs.systemAlerts);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const { error } = await postJson("/api/account/notifications", {
      leadFrequency,
      systemAlerts,
    });
    setSubmitting(false);
    setMessage(
      error
        ? { tone: "error", text: error.message }
        : { tone: "success", text: "Notification preferences saved." },
    );
  }

  return (
    <Section
      title="Notifications"
      description="How we reach you about new leads and account activity."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">New-lead emails</legend>
          {LEAD_FREQUENCIES.map((freq) => (
            <label
              key={freq}
              className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="lead-frequency"
                value={freq}
                checked={leadFrequency === freq}
                onChange={() => setLeadFrequency(freq)}
                className="size-4 accent-primary"
              />
              {FREQUENCY_LABELS[freq]}
            </label>
          ))}
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={systemAlerts}
            onChange={(e) => setSystemAlerts(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="font-medium">System alerts</span>
            <span className="text-muted-foreground block text-xs">
              Important account, billing, and site-status notifications.
            </span>
          </span>
        </label>

        <SaveButton
          submitting={submitting}
          idle="Save preferences"
          busy="Saving…"
        />
      </form>
    </Section>
  );
}

// ---- danger zone: account deletion -----------------------------------------

function DangerZone({ deletion }: { deletion: AccountSettings["deletion"] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function schedule() {
    setError(null);
    setSubmitting(true);
    const { error } = await postJson("/api/account/deletion", {});
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  async function cancel() {
    setError(null);
    setSubmitting(true);
    let failed = false;
    try {
      const res = await fetch("/api/account/deletion", { method: "DELETE" });
      const body = (await res.json()) as { error: { message: string } | null };
      if (body.error) {
        setError(body.error.message);
        failed = true;
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      failed = true;
    }
    setSubmitting(false);
    if (!failed) router.refresh();
  }

  if (deletion.pending) {
    const ends = deletion.graceEndsAt
      ? new Date(deletion.graceEndsAt).toLocaleDateString("en-US", {
          dateStyle: "long",
        })
      : "";
    return (
      <Section
        title="Account deletion"
        tone="danger"
        description="Your account is scheduled for deletion."
      >
        <FormMessage tone="error">
          Your account and all its data will be permanently deleted on{" "}
          <strong>{ends}</strong> ({deletion.daysRemaining} day
          {deletion.daysRemaining === 1 ? "" : "s"} left). You can still cancel.
        </FormMessage>
        {error ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={cancel}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Keep my account
        </Button>
      </Section>
    );
  }

  return (
    <Section
      title="Account deletion"
      tone="danger"
      description="Permanently delete your account and all data. This is separate from cancelling your subscription."
    >
      <p className="text-muted-foreground text-sm">
        We keep your data for a 30-day grace period after you request deletion, so
        you can change your mind. After that, everything is permanently removed.
      </p>
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Delete your account?</span>
          <Button
            type="button"
            variant="destructive"
            onClick={schedule}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Yes, schedule deletion
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirming(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => setConfirming(true)}
        >
          Delete account
        </Button>
      )}
    </Section>
  );
}
