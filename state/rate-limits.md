# Rate Limits & Fallbacks Log

Append-only. When any external API returns a rate-limit error, log it here and trigger the
documented fallback (see CLAUDE.md → "Rate Limits & Fallbacks").

| Date | Service | Endpoint | Limit hit | Error code | Fallback triggered |
|------|---------|----------|-----------|------------|--------------------|
| _(none observed yet)_ | | | | | |

## Documented fallbacks (reference)

- **Firecrawl** rate limit / insufficient content → docs-upload flow (PRD §4.3)
- **Gemini** rate limit → Inngest backoff + retry; surface "preparing" state
- **Vercel API** rate limit → Inngest backoff + retry; deploy state stays "deploying"
- **GitHub API** rate limit → Inngest backoff + retry; auto-resume, never block
- **SEC IAPD** unavailable → fall back to scrape, then to direct upload (PRD §5.4)
- **Resend** bounce/complaint → log to `email_log`, surface in `/admin/email-log`, no blind retry
