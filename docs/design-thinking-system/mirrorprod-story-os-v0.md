# MirrorProd Story OS v0

Last refreshed: 2026-07-09

Status: product strategy and first-demo spec. Not deployed. Current live `activemirror.ai/mirrorprod-india/` returns the generic Active Mirror page after `origin/main` reverted the MirrorProd public route.

## Hard Decision

MirrorProd should not become a generic AI video generator.

The valuable product is:

```text
A brief-locked, India-local short-video system for businesses.
It turns one real business offer into a regional microdrama campaign,
then tracks proof, claims, edits, outputs, approvals, and next-episode learning.
```

The market is crowded at the asset-generation layer. The defensible wedge is the production loop around the asset:

```text
business brief
  -> safe claims
  -> regional story angle
  -> episode plan
  -> source asset map
  -> generated or edited clips
  -> platform-specific cuts
  -> disclosure and rights receipt
  -> performance read
  -> next episode
```

## Current Source Truth

### Live Surface

- `https://activemirror.ai/mirrorprod-india/` currently returns the generic Active Mirror page, not MirrorProd.
- `https://activemirror.ai/mirrorprod/` currently returns the generic Active Mirror page, not a MirrorProd redirect.
- `origin/main` contains `cde37d5 Revert "Restore MirrorProd public route"`, which removed the MirrorProd route, videos, sitemap entry, and public deploy-boundary exceptions.

### Reusable Local Assets

The older source pool still exists and is useful for the demo:

- `/Users/mirror-pro/repos/activemirror-site/mirrorprod/index.html`
- `/Users/mirror-pro/repos/activemirror-site/mirrorprod-india/index.html`
- `/Users/mirror-pro/repos/activemirror-site/mirrorprod-site-assets/studio_atmosphere_20260424.mp4`
- `/Users/mirror-pro/repos/activemirror-site/mirrorprod-site-assets/studio_atmosphere_20260424_image.png`
- `/Users/mirror-pro/repos/activemirror-site/mirrorprod-site-assets/forensic_founder_paid_fixed_20260424.mp4`
- `/Users/mirror-pro/repos/activemirror-site/videos/mprod-*.mp4`
- `/Users/mirror-pro/repos/activemirror-site/videos/posters/mprod-*.jpg`

Video stream constraints from the current MirrorStream:

- Generic MirrorProd assets should have no logo, no watermark, and no precise on-screen text.
- Do not rely on Veo for precise text.
- Prefer Veo 3.1, then 3.0, then 3.0-fast. Veo 2.0 is excluded for this lane.
- Extract and inspect poster frames before wiring clips into public pages.

## Market Read

Short-form is not one market. MirrorProd needs to sit between four markets:

| Market | What exists | What MirrorProd should learn | What to avoid |
| --- | --- | --- | --- |
| Microdrama OTT | Kuku TV, Flick TV, Story TV, Chai Shots, ReelShort, DramaBox | Hook, character, serial tension, episode cadence, regional language packaging | Building a consumer OTT library first |
| Short-form distribution | YouTube Shorts, Instagram Reels, Moj, Josh, ShareChat, WhatsApp | Platform-specific cuts, comments, reposts, lead capture, retargeting | Assuming one export fits all |
| AI ad/video tools | Creatify, QuickAds, Predis.ai, InVideo, Canva, Runway, HeyGen, Synthesia | Fast asset generation, templates, avatars, variants | Competing only on "make me a video" |
| Business trust/compliance | ASCI disclosure rules, claim substantiation, influencer/creator agreements | Receipts, disclosures, proof packs, rights tracking | Shipping brand claims with no source or approval |

## Product Position

Public line:

```text
Short business stories for India, built from your real brief and safe to post.
```

Sharper internal line:

```text
MirrorProd Story OS is the production layer that turns business truth into regional short-video campaigns with receipts.
```

First customer:

```text
Owner-led Indian businesses and small teams that need better short videos but do not have a repeatable creative, compliance, or distribution system.
```

Early verticals:

- Restaurants, cafes, bakeries, and cloud kitchens.
- Clinics, wellness practices, gyms, and local health services.
- Coaching, education, training, and service businesses.
- Real estate, interior, retail, and local launches.
- Founder-led B2B or professional services.

## What We Have Not Been Thinking About Enough

### 1. The Story Arc Is The Product

Most SMBs ask for "one reel" because they do not know how to ask for a campaign. MirrorProd should sell a serial:

```text
Episode 1: the problem
Episode 2: the local character
Episode 3: the proof
Episode 4: the offer
Episode 5: the customer objection
Episode 6: the action
```

### 2. Comments Should Rewrite The Next Episode

Microdrama teams learn from comments, shares, memes, and completion. MirrorProd should make that a business product:

```text
Which hook held?
Which objection appeared?
Which language landed?
Which offer got replies?
What should episode 2 change?
```

### 3. ASCI-Safe Output Can Be A Wedge

Small businesses will accidentally overclaim. MirrorProd should lock:

- claim source;
- disclosure wording;
- forbidden words;
- medical, financial, educational, or performance-risk claims;
- creator usage rights;
- approval state before posting.

### 4. WhatsApp Is A First-Class Output

India SMB distribution is not only Reels and Shorts. Every pack should include:

- vertical public post;
- WhatsApp share cut;
- status cut;
- caption;
- short text for forwarding;
- lead reply starter.

### 5. Regional Does Not Mean Translation

Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, and Hinglish need different story defaults, character signals, humor, pacing, and social proof.

## First Demo: Restaurant Launch Microdrama Pack

Demo name:

```text
Monsoon Dessert Box
```

Customer:

```text
An owner-led cafe or bakery launching a limited weekend dessert box.
```

Input brief:

```text
Goal: Drive weekend preorders.
Audience: Families and young professionals nearby.
Source assets: product photos, cafe exterior clip, owner voice note, menu PDF.
Language: Hinglish first, optional Hindi cut.
Guardrails: no exaggerated health claims, no false scarcity, price only if confirmed.
Offer: preorder by Friday evening for Saturday pickup or delivery.
```

Episode pack:

| Episode | Hook | Story move | Output |
| --- | --- | --- | --- |
| 1 | "Weekend plans changed when this box reached the table." | Family or friend-group reaction to the dessert box | Reel, Short, WhatsApp status |
| 2 | "The owner almost cancelled the monsoon menu." | Founder conflict, rain-day demand, limited prep window | Founder cut |
| 3 | "Three desserts, one reason people reorder." | Product proof and sensory closeups | Product cut |
| 4 | "The customer asks the real question." | Price, pickup, freshness, delivery objection | FAQ cut |
| 5 | "Only safe claims. No magic words." | Ingredient/source/proof without health overclaim | Trust cut |
| 6 | "Order before Friday." | Clear CTA, location, WhatsApp action | Sales cut |

Proof receipt:

```json
{
  "campaign": "Monsoon Dessert Box",
  "claim_sources": ["menu PDF", "owner voice note", "product photos"],
  "forbidden_claims": ["health cure", "guaranteed freshness beyond stated window", "fake scarcity"],
  "disclosure": "Brand video / paid production where applicable",
  "rights": ["owner assets approved", "no unlicensed music", "creator releases required if faces appear"],
  "approval_state": "draft_only_until_owner_approval"
}
```

## Demo Product Flow

### Screen 1: Brief Lock

The user enters:

- business goal;
- audience;
- source assets;
- language;
- offer;
- proof source;
- forbidden claims;
- target platforms.

Output:

- campaign promise;
- risk level;
- required missing proof;
- recommended package.

### Screen 2: Story Angles

MirrorProd returns three options:

1. `Drama`: a customer moment with a cliffhanger.
2. `Founder`: the owner explains the launch and constraint.
3. `Proof`: product closeups, testimonial, FAQ, and CTA.

Each angle shows:

- hook;
- episode list;
- source assets needed;
- claims used;
- claims blocked;
- target platform cuts.

### Screen 3: Episode Board

The board shows six rows:

- episode number;
- hook;
- scene;
- asset;
- caption;
- CTA;
- compliance status.

### Screen 4: Production Pack

The output is not just video files. It is a pack:

- 6 vertical episodes;
- 6 WhatsApp cuts;
- captions;
- thumbnail text recommendations handled outside Veo;
- posting order;
- approval receipt;
- next-episode prompts after performance data.

### Screen 5: Performance Read

After posting, the user enters or imports:

- views;
- hold rate;
- replies;
- saves;
- shares;
- WhatsApp leads;
- comments or objections.

MirrorProd recommends:

- next hook;
- next objection to answer;
- language adjustment;
- whether to scale, revise, or stop.

## Packages

### Starter Story

For one business moment.

- 3 short videos.
- 3 WhatsApp cuts.
- One locked brief.
- One proof receipt.
- Best for: launch, offer, event, service intro.

### Microdrama Sprint

The flagship product.

- 6 episode vertical series.
- 6 WhatsApp cuts.
- 2 language variants.
- Captions and CTA lines.
- Performance read after posting.
- Best for: restaurants, clinics, coaches, real estate, local services.

### Local Campaign OS

For businesses posting every week.

- Monthly brief calendar.
- Recurring story arcs.
- Creator or founder capture guide.
- Proof ledger and approvals.
- Platform performance review.
- Best for: serious SMBs and founder-led brands.

## Product Primitives To Build

| Primitive | Why it matters | v0 scope |
| --- | --- | --- |
| Brief Lock | Prevents random video generation | Form plus structured JSON |
| Claim Gate | Differentiates from generic tools | Blocked claims and required proof |
| Story Angle Generator | Turns offer into campaign | 3 angle options |
| Episode Board | Makes microdrama operational | 6 episode rows |
| Asset Map | Shows what can be made now | Map source assets to shots |
| Output Pack | Business-ready delivery | Files, captions, WhatsApp text |
| Receipt | Active Mirror advantage | Approval and claim record |
| Performance Read | Creates repeat usage | Manual metrics in v0 |

## What Not To Build First

- Do not build a consumer OTT app.
- Do not build a generic prompt-to-video page.
- Do not lead with "AI studio" or "generate any video."
- Do not rely on AI-generated on-screen text.
- Do not auto-post without approval.
- Do not make public claims that generation/upload credentials are ready until the video stack audit passes.
- Do not put the old MirrorProd route back onto `activemirror.ai` without deciding why it was reverted.

## First Build Slice

Build a local prototype for:

```text
MirrorProd Story OS / Monsoon Dessert Box
```

Required UI:

- one brief form;
- three story-angle cards;
- six-episode board;
- proof and claim receipt;
- production pack summary;
- performance read input.

Use existing local assets from:

```text
/Users/mirror-pro/repos/activemirror-site/videos/mprod-food-promo.mp4
/Users/mirror-pro/repos/activemirror-site/videos/mprod-testimonial.mp4
/Users/mirror-pro/repos/activemirror-site/videos/mprod-festival-offer.mp4
/Users/mirror-pro/repos/activemirror-site/videos/mprod-service-intro.mp4
```

No public deploy in this slice.

## Open Questions

1. Why was the MirrorProd public route reverted after deployment?
2. Should MirrorProd live as a separate brand, a route under Active Mirror, or a sales/demo artifact only?
3. Is the first buyer SMB-owner direct, agency/service-provider, or internal Active Mirror demo lead?
4. Which first language pair matters most: English/Hinglish, Hindi, Telugu, Tamil, or Marathi?
5. Is the demo output a prototype UI, an actual generated 6-video pack, or both?

## Source Map

Current market and compliance references used for this direction:

- Lumikai, State of Interactive Media 2025: `https://www.lumikai.com/post/india-s-interactive-media-economy-state-of-interactive-media-report-2025`
- Bitkraft and Redseer India report: `https://investgame.net/wp-content/uploads/2025/10/bitkraft_redseer_india_report_2025.pdf`
- Sensor Tower short drama apps 2025: `https://sensortower.com/blog/state-of-short-drama-apps-2025`
- Google India Brandcast 2025: `https://blog.google/intl/en-in/brandcast-2025-ctv-shorts-and-youtube-as-indias-new-tv/`
- ASCI influencer guidelines: `https://www.ascionline.in/social/wp-content/uploads/2025/04/ASCI-Influencer-Guidelines.pdf`
- Chai Shots: `https://chaishots.in/`
- Flick TV investment note: `https://www.stellarisvp.com/blog/the-future-of-micro-drama-in-india-our-investment-in-flick-tv`
- Audience-in-the-loop microdrama research: `https://arxiv.org/abs/2602.14045`
