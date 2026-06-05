<!--
  Standard RIA footer (PRD §18.2). Placeholders are filled at build time from
  intake data + the resolved ruleset:
    {{firm_name}}            — the advisory firm's legal name
    {{registration_status}}  — "SEC-registered" OR "State of XX-registered"
                               (resolved from the SEC/state conditional rule)
    {{adv_2a_url}} {{adv_2b_url}} {{crs_url}} {{privacy_url}} — asset/page links
  The state registration line renders only for state-registered advisers and is
  supplied by the matching state overlay (disclosures/state-overlays/<state>.md).
-->

{{firm_name}} is a {{registration_status}} investment adviser.
Registration does not imply a certain level of skill or training.
Information on this website is for informational purposes only and does not
constitute investment, tax, or legal advice.

{{#if state_registered}}{{state_registration_disclosure}}{{/if}}

[Form ADV Part 2A]({{adv_2a_url}})  ·  [Form ADV Part 2B]({{adv_2b_url}})  ·  [Form CRS]({{crs_url}})  ·  [Privacy Policy]({{privacy_url}})
