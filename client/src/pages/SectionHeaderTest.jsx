import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function SectionHeaderCard({ title, notes, onTitleChange, onNotesChange, onDelete }) {
  return (
    <div className="rounded-xl overflow-hidden mb-3 border border-white/10 bg-gradient-to-r from-wf-red/10 via-transparent to-transparent">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-1 h-8 rounded-full bg-wf-red shrink-0" />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[9px] text-wf-red uppercase tracking-widest font-bold shrink-0">Section</span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value.toUpperCase())}
            placeholder="e.g. WARM UP, COOL DOWN..."
            className="flex-1 bg-transparent text-sm font-black text-white uppercase tracking-wide placeholder:text-wf-gray-500 placeholder:normal-case focus:outline-none"
          />
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Notes */}
      <div className="px-4 pb-3 pl-8">
        <div className="ml-0.5 pl-3 border-l border-white/10">
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add notes for this section..."
            rows={2}
            className="w-full bg-transparent text-xs text-wf-gray-400 resize-none focus:outline-none placeholder:text-wf-gray-600 leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

const EXAMPLE_SECTIONS = [
  { id: 1, title: 'WARM UP', notes: '5 min light cardio, dynamic stretches' },
  { id: 2, title: 'WORKING SETS', notes: '' },
  { id: 3, title: 'DROP SETS', notes: 'Reduce weight by 20% each drop, no rest between drops' },
  { id: 4, title: 'COOL DOWN', notes: 'Static stretching, foam rolling' },
];

export default function SectionHeaderTest() {
  const navigate = useNavigate();
  const [sections, setSections] = useState(EXAMPLE_SECTIONS);
  const [nextId, setNextId] = useState(5);

  const addSection = () => {
    setSections(prev => [...prev, { id: nextId, title: '', notes: '' }]);
    setNextId(prev => prev + 1);
  };

  const updateSection = (id, field, value) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const deleteSection = (id) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24">
      <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-black text-white mb-2">Section Header Card</h1>
      <p className="text-wf-gray-400 text-sm mb-6">Title sections of a workout with optional notes</p>

      {sections.map((section) => (
        <SectionHeaderCard
          key={section.id}
          title={section.title}
          notes={section.notes}
          onTitleChange={(val) => updateSection(section.id, 'title', val)}
          onNotesChange={(val) => updateSection(section.id, 'notes', val)}
          onDelete={() => deleteSection(section.id)}
        />
      ))}

      <button
        onClick={addSection}
        className="w-full border border-dashed border-white/15 rounded-xl py-3 text-wf-gray-400 text-sm font-medium active:border-wf-red active:text-wf-red transition-colors"
      >
        + Add Section Header
      </button>
    </div>
  );
}
