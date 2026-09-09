# NEXMOLD V8-06 Search Provider Configuration

## Purpose

V8-06 connects the validated V8-05 internet acquisition layer to:

Opportunity
-> Research Planner
-> Search Provider
-> Discovery
-> Page Fetcher
-> Evidence

All production research input must originate from the internet.

No static engineering dataset is embedded in V8-06.

## GitHub Actions secrets

Configure these repository secrets:

- `V8_SEARCH_ENDPOINT`
- `V8_SEARCH_API_KEY`

The endpoint must accept:

`GET <endpoint>?q=<URL encoded query>`

with:

`Authorization: Bearer <V8_SEARCH_API_KEY>`

The response must be a JSON array.

Example:

``json
[
  {
    "url": "https://example.com/engineering",
    "title": "Engineering Source",
    "snippet": "Short search-result snippet"
  }
]
``

## Security

Search credentials must be stored only in GitHub Actions repository secrets.

V8-06 must not embed API keys or a static engineering dataset.

SERP results are discovery inputs only. First-party engineering evidence must be fetched from the discovered webpage and remains UNVERIFIED until explicitly audited or verified.