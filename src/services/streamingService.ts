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

// Returns a sequence runner that cycles through thinking messages
export const createThinkingSequence = (
  taskType: string,
  hasDNA: boolean,
  isFirstMessage: boolean,
  onUpdate: (state: ThinkingState) => void
): { stop: () => void } => {
  let sequence = thinkingSequences[taskType] ?? thinkingSequences.mentor_chat;

  // Pick the right sequence for mentor
  if (taskType === 'mentor_chat') {
    if (isFirstMessage) {
      sequence = thinkingSequences.mentor_chat_first_message;
    } else if (hasDNA) {
      sequence = thinkingSequences.mentor_chat_with_dna;
    }
  }

  let currentIndex = 0;
  let stopped = false;

  // Show first message immediately — no delay
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

  // Advance through remaining messages
  if (sequence.length > 1) {
    setTimeout(advance, 1200);
  }

  return {
    stop: () => { stopped = true; }
  };
};
