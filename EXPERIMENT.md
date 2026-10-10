# Duelio: seven-day experiment

## Hypothesis

People will share a specific everyday disagreement, invite other people to weigh in, and take part in a public discussion about the result.

## Audience

People who argue about small social questions: roommate etiquette, relationship etiquette, friendship etiquette, internet etiquette, food, harmless workplace etiquette. Not politics, medical, legal, or high-stakes topics.

## The seven days

1. Day 0: deploy with Supabase, confirm the Threadline thread is separate on two different dilemmas, and cast a test vote from a phone. Delete test votes or note them.
2. Days 1 to 7: send individual dilemma links (not the homepage) to people in the target audience, one dilemma per conversation, with a sentence like "We disagree about this. Pick a side." Do not post to broad audiences on day 1, so you can see what the first small group does unprompted.
3. Each day: open `/admin`, record the 7-day counts, read new submissions and reports, and read the Threadline dashboard for comments.
4. Day 7: compare against the targets below.

## Targets (hypotheses, not promises)

| Signal | Target |
| --- | --- |
| External participants who voted | 20 |
| Genuine comments in discussions | 5 |
| Voluntary dilemma shares | 3 |
| User-submitted dilemmas | 2 |
| People coming back for a second dilemma | some |

Count only people you did not personally ask to take part, where you can tell.

## Success signals

- Voters who read or write in the discussion, not just vote.
- Shares you did not request, visible as new visitors arriving on `/d/...` links with no prompt from you.
- Submissions that are actually specific and playful.
- A visitor voting on a second dilemma in the same visit or on a later day.
- The share of voters who return for a second distinct dilemma, using the cookie-based `/admin` event as a directional signal.
- Whether people submit or endorse an opposite-side defense, and whether they read the crowd prediction after voting.
- Whether dead-heat dilemmas draw more votes or discussion than other prompts. The badge requires 10 votes to avoid overreacting to tiny samples.

## Failure signals

- Votes happen but nobody comments: the discussion layer or the framing is not pulling people in.
- Plenty of views, almost no votes: the dilemma is not clear in five seconds.
- Votes and comments only from people you personally asked.
- Submissions that are low-effort or break the guidelines.

## Where the numbers come from

- `/admin`, last 7 days: page views, dilemma views, votes started and completed, share clicks, shares completed, submissions, reports, discussion loads.
- `/admin`, last 7 days: "Returned for a second dilemma" counts a browser's first vote on its second distinct dilemma. It is cookie-based, not a count of verified people; clearing cookies can inflate it.
- Threadline dashboard: comments, replies, reactions. Duelio cannot see these.
- `/admin` dilemma list: vote totals per side.

## What not to conclude

- Twenty votes from friends do not prove public demand. Check who came from where.
- "Share clicked" is intent. "Share completed" only covers the native share sheet and copy link. Neither proves anyone received the link.
- One cookie is one voter, roughly. Counts include people who cleared cookies and exclude people who share a device.
- Optional voter nicknames are public and self-selected, not verified identities.
- A lopsided result says nothing about which side is right.
- A failure on this week's dilemmas may be a failure of the prompts, not of the concept. Change one thing at a time.
- Seven days and a small sample cannot say whether this works at scale.
