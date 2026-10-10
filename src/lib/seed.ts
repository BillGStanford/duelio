export interface SeedDilemma {
  slug: string;
  question: string;
  context: string;
  sideALabel: string;
  sideADescription: string;
  sideBLabel: string;
  sideBDescription: string;
}

export const LEGACY_SEED_COUNT = 5;

// Editorial prompts shown on first launch. Edit or delete freely:
// the first five are the original lineup; the final two extend existing installs to a full week.
export const SEED_DILEMMAS: SeedDilemma[] = [
  {
    slug: 'roommate-electricity',
    question: 'Your roommate works from home. Should they pay more for electricity?',
    context: 'Remote work means someone is home all day. The bill still splits as if nobody is.',
    sideALabel: 'Yes',
    sideADescription: 'They use electricity throughout the day while working from home.',
    sideBLabel: 'No',
    sideBDescription: 'Household utilities should be shared equally unless usage is extreme.',
  },
  {
    slug: 'next-episode',
    question: 'Is watching the next episode without your partner betrayal?',
    context: 'A show starts as entertainment and turns into a shared ritual, usually without anyone saying so.',
    sideALabel: 'Yes',
    sideADescription: 'You agreed to watch it together. You broke the pact.',
    sideBLabel: 'No',
    sideBDescription: "It's a TV show, not a relationship contract.",
  },
  {
    slug: 'album-vs-streaming',
    question: 'Would you rather permanently own your favorite album or have unlimited streaming?',
    context: 'One album forever, or the whole catalogue on loan.',
    sideALabel: 'Own it',
    sideADescription: 'You actually possess something you love forever.',
    sideBLabel: 'Stream',
    sideBDescription: 'Unlimited access to basically everything wins.',
  },
  {
    slug: 'group-chat-lurker',
    question: 'If you read every message in a group chat but rarely reply, are you still participating?',
    context: 'Some people send forty messages a day. Some people read all forty and send a thumbs up.',
    sideALabel: 'Yes',
    sideADescription: 'Reading is participation. Not everyone needs to speak constantly.',
    sideBLabel: 'No',
    sideBDescription: "If you never contribute, you're basically an audience member.",
  },
  {
    slug: 'restaurant-check',
    question: 'If one person orders significantly more than everyone else, should the group still split the bill evenly?',
    context: "The server asks 'together or separate?' and everyone suddenly studies the table.",
    sideALabel: 'Split evenly',
    sideADescription: 'Groups are simpler when everyone shares the cost.',
    sideBLabel: 'Pay your share',
    sideBDescription: "You shouldn't subsidize someone else's expensive order.",
  },
  {
    slug: 'shoes-at-the-door',
    question: 'Should guests take their shoes off when they come over?',
    context: 'One host sees a clean floor. One guest sees a very awkward sock situation.',
    sideALabel: 'Yes',
    sideADescription: 'It keeps the floors clean, and guests can bring slippers.',
    sideBLabel: 'No',
    sideBDescription: 'Let guests decide what is comfortable unless the host asks.',
  },
  {
    slug: 'long-voice-note',
    question: 'Is a voice note longer than a minute acceptable?',
    context: 'You open one message and find a tiny podcast waiting for you.',
    sideALabel: 'Absolutely',
    sideADescription: 'Some stories are easier to say than type.',
    sideBLabel: 'Keep it short',
    sideBDescription: 'If it takes over a minute, send a text or make a call.',
  },
];
