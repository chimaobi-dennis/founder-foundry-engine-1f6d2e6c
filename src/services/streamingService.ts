// Thinking state sequences per task type
export const thinkingSequences: Record<string, string[]> = {
  mentor_chat: [
    'Reading your brand context...',
    'Thinking...',
    'Considering your question...',
  ],
  mentor_chat_first_message: [
    'Meeting you for the first time...',
    'Understanding your idea...',
    'Forming an initial perspective...',
  ],
  mentor_chat_with_dna: [
    'Reviewing your Brand DNA...',
    'Connecting this to your positioning...',
    'Thinking...',
  ],
  template_generation: [
    'Reading your brand colors...',
    'Reviewing your product image...',
    'Designing the composition...',
    'Applying your brand style...',
    'Rendering the output...',
  ],
  document_generation: [
    'Reading your Brand DNA...',
    'Structuring the document...',
    'Writing in your brand voice...',
    'Refining the content...',
  ],
  campaign_copy: [
    'Analysing your campaign brief...',
    'Reviewing your brand voice...',
    'Writing your headlines...',
    'Adapting for each platform...',
    'Finalising your copy...',
  ],
  reel_script: [
    'Reading your brief...',
    'Mapping the story arc...',
    'Writing your script...',
    'Adding visual directions...',
  ],
  brand_name_generation: [
    'Absorbing your idea...',
    'Exploring name directions...',
    'Checking for resonance...',
    'Selecting the strongest options...',
  ]
};

export interface ThinkingState {
  isThinking: boolean;
  currentMessage: string;
  progress: number; // 0 to 1
}

// Mentor thinking pool — cycled randomly so the wait feels like a real
// person reading and reflecting, not a robot stepping through a script.
const mentorThinkingPool: string[] = [
  "Reading what you shared...",
  "Sitting with that for a moment...",
  "That's interesting — thinking it through...",
  "Connecting the dots...",
  "Let me think about this properly...",
  "Processing what you just said...",
  "There's something here worth unpacking...",
  "Thinking...",
  "Following your thread...",
  "That landed — give me a second...",
  "Turning that over in my mind...",
  "Reading your brand context...",
  "Building on what we know...",
  "Almost there...",
];

const pickRandom = (pool: string[], avoid?: string): string => {
  if (pool.length <= 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)];
  // Avoid repeating the same message twice in a row.
  let guard = 0;
  while (next === avoid && guard < 8) {
    next = pool[Math.floor(Math.random() * pool.length)];
    guard++;
  }
  return next;
};

// Returns a sequence runner that cycles through thinking messages
export const createThinkingSequence = (
  taskType: string,
  hasDNA: boolean,
  isFirstMessage: boolean,
  onUpdate: (state: ThinkingState) => void
): { stop: () => void } => {
  let stopped = false;

  // Mentor uses the random pool with 2.5s cycling.
  const isMentor =
    taskType === 'mentor_chat' ||
    taskType === 'mentor_chat_first_message' ||
    taskType === 'mentor_chat_with_dna';

  if (isMentor) {
    let current = pickRandom(mentorThinkingPool);
    onUpdate({ isThinking: true, currentMessage: current, progress: 0.5 });

    const tick = () => {
      if (stopped) return;
      current = pickRandom(mentorThinkingPool, current);
      onUpdate({ isThinking: true, currentMessage: current, progress: 0.5 });
      timer = setTimeout(tick, 2500);
    };
    let timer = setTimeout(tick, 2500);

    return { stop: () => { stopped = true; clearTimeout(timer); } };
  }

  // Non-mentor task types keep their ordered sequence.
  const sequence = thinkingSequences[taskType] ?? thinkingSequences.mentor_chat;
  let currentIndex = 0;

  onUpdate({
    isThinking: true,
    currentMessage: sequence[0],
    progress: 1 / sequence.length
  });
  currentIndex = 1;

  const advance = () => {
    if (stopped || currentIndex >= sequence.length) return;

    onUpdate({
      isThinking: true,
      currentMessage: sequence[currentIndex],
      progress: (currentIndex + 1) / sequence.length
    });

    currentIndex++;

    if (currentIndex < sequence.length) {
      const delay = 1000 + Math.random() * 500;
      setTimeout(advance, delay);
    }
  };

  if (sequence.length > 1) {
    setTimeout(advance, 1200);
  }

  return {
    stop: () => { stopped = true; }
  };
};
