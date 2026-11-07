# Submission packet — drafts for team review

## Project links

- Live application: https://recall-incident-memory.lakshmihasini8.chatgpt.site
- Private source repository: https://github.com/LakshmiHasini/recall-incident-intelligence

Both currently have private access. Arrange judge access before submission.

## Short pitch

Recall is an incident response workspace that remembers what an engineering team has already learned. It connects new symptoms to historical incidents, shows the supporting evidence, and learns from confirmed resolutions—including failed fixes. Hindsight powers persistent memory and grounded investigation, while the original incident records stay in a SQL database.

## Article draft

### Building Recall: helping engineers remember what fixed the last outage

When a production issue returns, the answer often already exists somewhere: an old incident report, a late-night investigation, or a fix another engineer remembers. Finding that answer during an outage can be harder than it should be.

We built Recall around this workflow. An engineer reports an incident, records symptoms and log excerpts, and asks for an investigation grounded in the team's previous experience. The workspace puts historical evidence beside the investigation so the engineer can inspect the source rather than accepting a confident answer without context.

The important part happens after resolution. The engineer records the confirmed cause, successful fix, verification evidence, and actions that did not work. Recall saves the original record in its SQL database and retains the lesson in Hindsight. A later incident can use that experience across sessions.

Hindsight's Retain operation forms memory from the confirmed report. Recall retrieves relevant facts for the memory library. Reflect generates an investigation and returns the facts behind its answer. We request structured output and validate it before rendering the investigation sections.

We also built for the cases where integrations fail. A resolution and its pending memory job are saved together. If Hindsight is unavailable, the resolution remains safe and the sync can be retried. Stable source document IDs support explicit corrections to a previous outcome. Investigations retain the input revision so changed incident context is visible.

During development, the live learning test retained a labelled synthetic resolution, recalled four facts, and produced a subsequent investigation with four supporting facts and structured output. We also checked persistence, revision conflicts, webhook deduplication, and provider failure handling. These checks demonstrate the implemented workflow; they do not establish a measured reduction in real production recovery time.

Recall recommends diagnostic checks. Engineers verify the current cause and record what actually happened. That distinction keeps historical experience useful without treating the last incident's cause as an automatic diagnosis of the next one.

## Social post draft

We built Recall: an incident response workspace that learns from verified resolutions.

It remembers successful fixes and failed attempts, uses Hindsight to investigate related incidents, and shows the memory evidence behind the response.

Our live integration check exercised Retain → Recall → Reflect across incident records. We also added persistent timelines, resolution amendments, retryable memory sync and authenticated alert intake.

The next step is testing it with more realistic incident histories and measuring how useful its suggestions are to engineers.

Add the approved project/video links, team credits and required tags after checking the official content guide. Do not publish this draft automatically.

## Suggested 90-second walkthrough

This duration is a proposal, not an organizer requirement.

- 0–15 seconds: Explain the repeated-outage problem and open the incident workspace.
- 15–30 seconds: Show symptoms, logs and a recorded failed action.
- 30–50 seconds: Investigate a related incident and inspect Hindsight evidence.
- 50–70 seconds: Save a confirmed resolution and show successful memory sync.
- 70–85 seconds: Open a later incident or session and show the learned context being used.
- 85–90 seconds: Show the architecture, repository and live project link.

Use a dedicated development bank for synthetic examples and label them. Never show API keys, private customer logs, or unrelated account screens in the recording.

## Still required from the team

Obtain the official content guide, personalize the article and social post for each member, record the required videos, verify judge access, and submit through the organizers' actual submission process. These drafts do not mean those actions have been completed.
