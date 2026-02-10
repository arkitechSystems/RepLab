const COLOR_MAP = {
  push:  { border: 'border-l-wf-red',    text: 'text-wf-red',    bg: 'bg-wf-red/20',    dot: 'bg-wf-red',    hex: '#EF4444' },
  pull:  { border: 'border-l-wf-blue',   text: 'text-wf-blue',   bg: 'bg-wf-blue/20',   dot: 'bg-wf-blue',   hex: '#3B82F6' },
  legs:  { border: 'border-l-wf-green',  text: 'text-wf-green',  bg: 'bg-wf-green/20',  dot: 'bg-wf-green',  hex: '#22C55E' },
  rest:  { border: 'border-l-wf-purple', text: 'text-wf-purple', bg: 'bg-wf-purple/20', dot: 'bg-wf-purple', hex: '#A855F7' },
};

const DEFAULT_COLOR = { border: 'border-l-wf-orange', text: 'text-wf-orange', bg: 'bg-wf-orange/20', dot: 'bg-wf-orange', hex: '#F97316' };

export function getWorkoutColor(name) {
  if (!name) return DEFAULT_COLOR;
  const key = name.toLowerCase().trim();
  return COLOR_MAP[key] || DEFAULT_COLOR;
}
