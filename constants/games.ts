export type GameId = 'jumprun' | 'gemmatch' | 'tapstack' | 'brikbreak' | 'zigzag' | 'snake';

export interface GameInfo {
  id: GameId;
  title: string;
  tagline: string;
}

export const GAMES: GameInfo[] = [
  { id: 'jumprun', title: 'JUMP RUN', tagline: 'Tap to jump. Dodge everything.' },
  { id: 'gemmatch', title: 'GEM MATCH', tagline: 'Swap shapes. Match three.' },
  { id: 'tapstack', title: 'TAP STACK', tagline: 'Time the drop. Stack it high.' },
  { id: 'brikbreak', title: 'BRIK BREAK', tagline: 'Bounce. Break. Clear the board.' },
  { id: 'zigzag', title: 'ZIG ZAG', tagline: 'Tap to turn. Stay on the path.' },
  { id: 'snake', title: 'SNAKE', tagline: 'Swipe to steer. Eat to grow.' },
];
