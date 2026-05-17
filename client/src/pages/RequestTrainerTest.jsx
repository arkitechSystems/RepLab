import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';

// "Request a Coach" intake test page modeled on the structural patterns of a
// coach-matching SaaS (e.g. Trainerize, Future, Caliber). Two role tracks —
// personal trainer or nutrition coach — branch a shared shell. The intake
// captures enough signal for a human matcher (or eventually a matching
// algorithm) to pair the user with a coach: goals + timeline, specialty,
// coach preferences (gender, comms style, cadence), budget tier, and
// logistics. A short "how it works" panel anchors the bottom so the user
// knows what they're signing up for before submitting.
//
// Test-only. When this gets promoted into the real app, the submit handler
// POSTs the payload server-side and a coach-side dashboard surfaces new
// requests for triage. The business model implied here: clients fill intake
// free; matched coach subscribes monthly to the REPLAB Coach Suite; coach
// bills the client through the platform (Stripe via REPLAB Coach Pay).

const ROLE = {
  trainer: { key: 'trainer', label: 'Personal Trainer', subtitle: 'Programming, form, accountability' },
  nutrition: { key: 'nutrition', label: 'Nutrition Coach', subtitle: 'Macros, meal plans, body comp' },
};

function Panel({ accent = '#ef4444', children, delay = 0 }) {
  return (
    <div
      className="relative overflow-hidden fade-slide-up"
      style={{
        animationDelay: `${delay}ms`,
        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
        borderRadius: '2px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}40, transparent)` }} />
      <div
        className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}1a 0%, transparent 60%)`, filter: 'blur(40px)' }}
      />
      <div className="relative p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.22em' }}>
        {children}
      </p>
      {hint && <p className="text-[11px] text-white/35 mt-0.5">{hint}</p>}
    </div>
  );
}

function TextField({ value, onChange, placeholder, type = 'text', autoComplete }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full text-white placeholder:text-white/30 text-sm bg-transparent focus:outline-none"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '2px',
        padding: '12px 14px',
      }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-white placeholder:text-white/30 text-sm bg-transparent focus:outline-none resize-none"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '2px',
        padding: '12px 14px',
      }}
    />
  );
}

// Segmented selector — used for role, format, gender, experience, etc.
// `cols` controls grid layout; pass 2 for big binary choices, 3+ for tighter
// rows. The active pill is the red gradient used elsewhere in the app.
function Segmented({ options, value, onChange, cols = 2 }) {
  const gridClass = cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={`grid ${gridClass} gap-2`}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="text-[11px] font-bold uppercase py-3 active:scale-[0.97] transition-all"
            style={{
              letterSpacing: '0.18em',
              borderRadius: '2px',
              background: on
                ? 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)'
                : 'rgba(255,255,255,0.04)',
              boxShadow: on
                ? '0 4px 14px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.15)'
                : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
              color: on ? '#fff' : 'rgba(255,255,255,0.65)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Multi-select chip group — same look as Segmented but toggles a Set.
function ChipMulti({ options, values, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = values.has(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className="text-[11px] font-bold uppercase py-2 px-3 active:scale-[0.97] transition-all"
            style={{
              letterSpacing: '0.18em',
              borderRadius: '2px',
              background: on
                ? 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)'
                : 'rgba(255,255,255,0.04)',
              boxShadow: on
                ? '0 3px 10px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.15)'
                : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
              color: on ? '#fff' : 'rgba(255,255,255,0.65)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function RequestTrainerTest() {
  const navigate = useNavigate();

  // Role gate — null until the user picks. Hides everything below until then
  // so the page opens with a single clear decision instead of a long form.
  const [role, setRole] = useState(null);

  // Shared identity
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [bodyWeight, setBodyWeight] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Trainer-only
  const [format, setFormat] = useState(''); // online | in-person
  const [trainerLocation, setTrainerLocation] = useState('');
  const [specialty, setSpecialty] = useState(''); // hypertrophy / strength / powerlifting / athletic / mobility / fatloss / contest
  const [trainerGoal, setTrainerGoal] = useState('');
  const [goalTimeline, setGoalTimeline] = useState(''); // 3mo / 6mo / 12mo / norush
  const [experience, setExperience] = useState('');
  const [priorCoach, setPriorCoach] = useState(''); // yes / no
  const [currentRoutine, setCurrentRoutine] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('');
  const [equipment, setEquipment] = useState(new Set());
  const [biggestObstacle, setBiggestObstacle] = useState('');

  // Nutrition-only
  const [nutritionSpecialty, setNutritionSpecialty] = useState(''); // fatloss / muscle / recomp / perf / health
  const [nutritionGoal, setNutritionGoal] = useState('');
  const [nutritionTimeline, setNutritionTimeline] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [diet, setDiet] = useState(new Set());
  const [allergies, setAllergies] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState('');
  const [cookingAbility, setCookingAbility] = useState(''); // none / basic / confident / love
  const [adherenceStyle, setAdherenceStyle] = useState(''); // mealplan / macros / habits / flexible

  // Lifestyle (shared)
  const [sleep, setSleep] = useState('');
  const [stressLevel, setStressLevel] = useState('');
  const [activityOutsideGym, setActivityOutsideGym] = useState('');

  // Coach-match preferences (shared)
  const [coachGenderPref, setCoachGenderPref] = useState(''); // same / opposite / nopref
  const [commsStyle, setCommsStyle] = useState(''); // handson / weekly / independent
  const [checkInFreq, setCheckInFreq] = useState(''); // daily / weekly / biweekly / monthly
  const [timeZone, setTimeZone] = useState('');
  const [budget, setBudget] = useState(''); // <100 / 100-200 / 200-400 / 400+
  const [startWhen, setStartWhen] = useState(''); // now / 2wks / 1mo / explore

  const [submitted, setSubmitted] = useState(false);

  const toggleSet = (setter) => (val) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  // Minimal gate: role + first name + email + the role's primary branch
  // (format for trainer, goal for nutrition) + budget tier so we can match
  // against coach pricing. Everything else is optional so the form stays
  // low-friction; a human matcher follows up to fill any gaps.
  const canSubmit = useMemo(() => {
    if (!role || !firstName.trim() || !email.trim() || !budget) return false;
    if (role === 'trainer' && !format) return false;
    if (role === 'nutrition' && !nutritionGoal) return false;
    return true;
  }, [role, firstName, email, budget, format, nutritionGoal]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Test-only: no network call. Eventual server route lives at TBD; the
    // shape we'll post matches the local state names above. A coach-side
    // dashboard will surface new requests for triage + match.
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="pb-24">
        <StickyHeader title="REQUEST SENT" titleStyle={{ fontSize: '26.4px' }}>
          <button
            onClick={() => navigate(-1)}
            className="text-[11px] uppercase font-bold text-wf-gray-400 active:text-white"
            style={{ letterSpacing: '0.2em' }}
          >
            Back
          </button>
        </StickyHeader>
        <div className="px-4 pt-1 space-y-4">
          <Panel accent="#22c55e">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(34,197,94,0.85)', letterSpacing: '0.3em' }}>
              Coach Request
            </p>
            <h2 className="text-[24px] font-black text-white tracking-tight mb-3" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              YOU'RE IN<br />THE QUEUE.
            </h2>
            <p className="text-[13px] text-white/55 leading-relaxed">
              We'll match you with a {role === 'trainer' ? 'personal trainer' : 'nutrition coach'} based on your answers and reach out within 48 hours at <span className="text-white font-semibold">{email}</span>. Your matched coach will introduce themselves, share their programming approach, and confirm pricing before you commit to anything.
            </p>
          </Panel>
          <Panel accent="#22c55e" delay={120}>
            <p className="text-[10px] uppercase font-bold mb-3" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.22em' }}>
              What Happens Next
            </p>
            <ol className="space-y-2.5 text-[12px] text-white/65 leading-relaxed list-none">
              <li><span className="text-white font-bold mr-2">01</span>Coach review — we match your answers against our coach roster and propose 1–2 candidates.</li>
              <li><span className="text-white font-bold mr-2">02</span>Intro call (15 min) — meet your matched coach. No charge.</li>
              <li><span className="text-white font-bold mr-2">03</span>Onboarding — assessment, baseline numbers, program build.</li>
              <li><span className="text-white font-bold mr-2">04</span>Train — programs delivered through REPLAB, messaging in-app, weekly check-ins.</li>
            </ol>
          </Panel>
          <button
            onClick={() => navigate(-1)}
            className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all"
            style={{
              letterSpacing: '0.2em', fontSize: '12px', padding: '14px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            Back to Test Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <StickyHeader title="REQUEST A COACH" titleStyle={{ fontSize: '26.4px' }}>
        <button
          onClick={() => navigate(-1)}
          className="text-[11px] uppercase font-bold text-wf-gray-400 active:text-white"
          style={{ letterSpacing: '0.2em' }}
        >
          Back
        </button>
      </StickyHeader>

      <div className="px-4 pt-1 space-y-4">
        {/* Marketing hero — what the user gets out of the coaching tier. */}
        <Panel delay={0}>
          <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
            REPLAB Coaching
          </p>
          <h2 className="text-[24px] font-black text-white tracking-tight mb-3" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
            GET MATCHED.<br />TRAIN SMARTER.
          </h2>
          <p className="text-[12px] text-white/55 leading-relaxed mb-4">
            Custom programming, 1:1 messaging, weekly check-ins, progress tracking — delivered through the app you already use. We match you with a vetted coach based on your goals, schedule, and budget.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold" style={{ letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)' }}>
            <div className="flex items-center gap-2"><span style={{ color: '#ef4444' }}>✓</span> Custom Programs</div>
            <div className="flex items-center gap-2"><span style={{ color: '#ef4444' }}>✓</span> In-App Chat</div>
            <div className="flex items-center gap-2"><span style={{ color: '#ef4444' }}>✓</span> Weekly Check-Ins</div>
            <div className="flex items-center gap-2"><span style={{ color: '#ef4444' }}>✓</span> Progress Photos</div>
            <div className="flex items-center gap-2"><span style={{ color: '#ef4444' }}>✓</span> Habit Tracking</div>
            <div className="flex items-center gap-2"><span style={{ color: '#ef4444' }}>✓</span> Form Reviews</div>
          </div>
        </Panel>

        {/* Role picker — primary decision. Everything below branches on this. */}
        <Panel delay={80}>
          <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
            Step 01
          </p>
          <h2 className="text-[22px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1', letterSpacing: '-0.01em' }}>
            WHO DO YOU<br />NEED?
          </h2>
          <div className="grid grid-cols-1 gap-2.5">
            {Object.values(ROLE).map((r) => {
              const on = role === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className="text-left p-4 active:scale-[0.99] transition-all"
                  style={{
                    borderRadius: '2px',
                    background: on
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0.04) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: on ? '1px solid rgba(239,68,68,0.55)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <p className="text-[14px] font-black text-white tracking-tight">{r.label}</p>
                  <p className="text-[11px] text-white/45 mt-0.5">{r.subtitle}</p>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Trainer-only: online vs in-person — the explicit user-requested question. */}
        {role === 'trainer' && (
          <Panel delay={60}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Step 02 · Format
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-3" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              ONLINE OR IN-PERSON?
            </h2>
            <Segmented
              cols={2}
              value={format}
              onChange={setFormat}
              options={[
                { value: 'online', label: 'Online' },
                { value: 'in-person', label: 'In-Person' },
              ]}
            />
            {format === 'in-person' && (
              <div className="mt-3">
                <FieldLabel hint="City or ZIP code">Location</FieldLabel>
                <TextField value={trainerLocation} onChange={setTrainerLocation} placeholder="e.g. Boston, MA · 02118" />
              </div>
            )}
          </Panel>
        )}

        {/* Trainer specialty — narrows the coach pool to the right skill set. */}
        {role === 'trainer' && (
          <Panel delay={120}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Step 03 · Focus
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              YOUR FOCUS
            </h2>
            <Segmented
              cols={2}
              value={specialty}
              onChange={setSpecialty}
              options={[
                { value: 'hypertrophy', label: 'Hypertrophy' },
                { value: 'strength', label: 'Strength' },
                { value: 'powerlifting', label: 'Powerlifting' },
                { value: 'athletic', label: 'Athletic Perf' },
                { value: 'fatloss', label: 'Fat Loss' },
                { value: 'contest', label: 'Contest Prep' },
                { value: 'mobility', label: 'Mobility' },
                { value: 'general', label: 'General Fitness' },
              ]}
            />
          </Panel>
        )}

        {/* Goals + timeline — shared. */}
        {role && (
          <Panel delay={180}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Goals
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              WHAT YOU'RE AFTER
            </h2>
            <div className="space-y-5">
              {role === 'trainer' && (
                <div>
                  <FieldLabel>Primary Goal</FieldLabel>
                  <Segmented
                    cols={2}
                    value={trainerGoal}
                    onChange={setTrainerGoal}
                    options={[
                      { value: 'build', label: 'Build Muscle' },
                      { value: 'strong', label: 'Get Stronger' },
                      { value: 'lean', label: 'Get Lean' },
                      { value: 'fit', label: 'Feel Fit' },
                    ]}
                  />
                </div>
              )}
              {role === 'nutrition' && (
                <div>
                  <FieldLabel>Primary Goal</FieldLabel>
                  <Segmented
                    cols={2}
                    value={nutritionGoal}
                    onChange={setNutritionGoal}
                    options={[
                      { value: 'fatloss', label: 'Fat Loss' },
                      { value: 'muscle', label: 'Muscle Gain' },
                      { value: 'recomp', label: 'Body Recomp' },
                      { value: 'performance', label: 'Performance' },
                      { value: 'health', label: 'Health' },
                      { value: 'maintain', label: 'Maintain' },
                    ]}
                  />
                </div>
              )}
              <div>
                <FieldLabel hint="When do you want to hit this goal?">Timeline</FieldLabel>
                <Segmented
                  cols={4}
                  value={role === 'trainer' ? goalTimeline : nutritionTimeline}
                  onChange={role === 'trainer' ? setGoalTimeline : setNutritionTimeline}
                  options={[
                    { value: '3mo', label: '3 mo' },
                    { value: '6mo', label: '6 mo' },
                    { value: '12mo', label: '12 mo' },
                    { value: 'open', label: 'Open' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel hint="What's the single biggest thing in your way right now?">Biggest Obstacle</FieldLabel>
                <TextArea value={biggestObstacle} onChange={setBiggestObstacle} placeholder="Optional — but the more your coach knows, the better the match" />
              </div>
            </div>
          </Panel>
        )}

        {/* About You — shared identity block. */}
        {role && (
          <Panel delay={240}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              About You
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              THE BASICS
            </h2>
            <div className="space-y-4">
              <div>
                <FieldLabel>First Name</FieldLabel>
                <TextField value={firstName} onChange={setFirstName} placeholder="Your first name" autoComplete="given-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Age</FieldLabel>
                  <TextField value={age} onChange={setAge} placeholder="—" type="number" />
                </div>
                <div>
                  <FieldLabel>Gender</FieldLabel>
                  <Segmented
                    cols={3}
                    value={gender}
                    onChange={setGender}
                    options={[
                      { value: 'm', label: 'M' },
                      { value: 'f', label: 'F' },
                      { value: 'x', label: '—' },
                    ]}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Height (ft)</FieldLabel>
                  <TextField value={heightFt} onChange={setHeightFt} placeholder="—" type="number" />
                </div>
                <div>
                  <FieldLabel>Height (in)</FieldLabel>
                  <TextField value={heightIn} onChange={setHeightIn} placeholder="—" type="number" />
                </div>
                <div>
                  <FieldLabel>Weight (lbs)</FieldLabel>
                  <TextField value={bodyWeight} onChange={setBodyWeight} placeholder="—" type="number" />
                </div>
              </div>
              {role === 'nutrition' && (
                <div>
                  <FieldLabel hint="Optional">Target Weight (lbs)</FieldLabel>
                  <TextField value={targetWeight} onChange={setTargetWeight} placeholder="—" type="number" />
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Trainer-only history + logistics. */}
        {role === 'trainer' && (
          <Panel delay={300}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Training
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              WHERE YOU'RE AT
            </h2>
            <div className="space-y-5">
              <div>
                <FieldLabel>Experience</FieldLabel>
                <Segmented
                  cols={3}
                  value={experience}
                  onChange={setExperience}
                  options={[
                    { value: 'beginner', label: '< 1 yr' },
                    { value: 'intermediate', label: '1–3 yrs' },
                    { value: 'advanced', label: '3+ yrs' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel>Worked With a Coach Before?</FieldLabel>
                <Segmented
                  cols={2}
                  value={priorCoach}
                  onChange={setPriorCoach}
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No / Not Recently' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel hint="Split, days/week, recent program">Current Routine</FieldLabel>
                <TextArea value={currentRoutine} onChange={setCurrentRoutine} placeholder="Optional — e.g. 'PPL 5x/week, 6 months on Will's Hypertrophy'" />
              </div>
              <div>
                <FieldLabel>Sessions / Week</FieldLabel>
                <Segmented
                  cols={4}
                  value={sessionsPerWeek}
                  onChange={setSessionsPerWeek}
                  options={[
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                    { value: '5+', label: '5+' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel hint="Select all that apply">Equipment Access</FieldLabel>
                <ChipMulti
                  values={equipment}
                  onToggle={toggleSet(setEquipment)}
                  options={[
                    { value: 'gym', label: 'Full Gym' },
                    { value: 'home', label: 'Home Gym' },
                    { value: 'dumbbells', label: 'Dumbbells' },
                    { value: 'bands', label: 'Bands' },
                    { value: 'none', label: 'None' },
                  ]}
                />
              </div>
            </div>
          </Panel>
        )}

        {/* Nutrition-only block. */}
        {role === 'nutrition' && (
          <Panel delay={300}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Nutrition
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              HOW YOU EAT
            </h2>
            <div className="space-y-5">
              <div>
                <FieldLabel>Focus</FieldLabel>
                <Segmented
                  cols={2}
                  value={nutritionSpecialty}
                  onChange={setNutritionSpecialty}
                  options={[
                    { value: 'fatloss', label: 'Fat Loss' },
                    { value: 'muscle', label: 'Muscle Gain' },
                    { value: 'recomp', label: 'Body Recomp' },
                    { value: 'performance', label: 'Sport Nutrition' },
                    { value: 'health', label: 'General Health' },
                    { value: 'medical', label: 'Medical-Based' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel hint="Select all that apply">Dietary Style</FieldLabel>
                <ChipMulti
                  values={diet}
                  onToggle={toggleSet(setDiet)}
                  options={[
                    { value: 'none', label: 'No Restrictions' },
                    { value: 'vegetarian', label: 'Vegetarian' },
                    { value: 'vegan', label: 'Vegan' },
                    { value: 'pescatarian', label: 'Pescatarian' },
                    { value: 'keto', label: 'Keto' },
                    { value: 'paleo', label: 'Paleo' },
                    { value: 'halal', label: 'Halal' },
                    { value: 'kosher', label: 'Kosher' },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Meals / Day</FieldLabel>
                  <Segmented
                    cols={4}
                    value={mealsPerDay}
                    onChange={setMealsPerDay}
                    options={[
                      { value: '2', label: '2' },
                      { value: '3', label: '3' },
                      { value: '4', label: '4' },
                      { value: '5+', label: '5+' },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Cooking Ability</FieldLabel>
                  <Segmented
                    cols={2}
                    value={cookingAbility}
                    onChange={setCookingAbility}
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'basic', label: 'Basic' },
                      { value: 'confident', label: 'Confident' },
                      { value: 'love', label: 'Love It' },
                    ]}
                  />
                </div>
              </div>
              <div>
                <FieldLabel hint="How do you want your coach to deliver the plan?">Adherence Style</FieldLabel>
                <Segmented
                  cols={2}
                  value={adherenceStyle}
                  onChange={setAdherenceStyle}
                  options={[
                    { value: 'mealplan', label: 'Meal Plan' },
                    { value: 'macros', label: 'Macro Targets' },
                    { value: 'habits', label: 'Habit-Based' },
                    { value: 'flexible', label: 'Flexible Mix' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel hint="Foods you can't eat or strongly avoid">Allergies / Avoidances</FieldLabel>
                <TextArea value={allergies} onChange={setAllergies} placeholder="Optional" />
              </div>
            </div>
          </Panel>
        )}

        {/* Lifestyle — shared. */}
        {role && (
          <Panel delay={360}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Lifestyle
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              OUTSIDE THE GYM
            </h2>
            <div className="space-y-5">
              <div>
                <FieldLabel>Sleep (avg / night)</FieldLabel>
                <Segmented
                  cols={4}
                  value={sleep}
                  onChange={setSleep}
                  options={[
                    { value: '<5', label: '< 5h' },
                    { value: '5-6', label: '5–6h' },
                    { value: '7-8', label: '7–8h' },
                    { value: '8+', label: '8+h' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel>Stress Level</FieldLabel>
                <Segmented
                  cols={3}
                  value={stressLevel}
                  onChange={setStressLevel}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel>Activity Outside Training</FieldLabel>
                <Segmented
                  cols={2}
                  value={activityOutsideGym}
                  onChange={setActivityOutsideGym}
                  options={[
                    { value: 'sedentary', label: 'Sedentary' },
                    { value: 'light', label: 'Light' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'very', label: 'Very Active' },
                  ]}
                />
              </div>
            </div>
          </Panel>
        )}

        {/* Coach-match preferences — the matching algorithm's input layer. */}
        {role && (
          <Panel delay={420}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Coach Preferences
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              YOUR IDEAL COACH
            </h2>
            <div className="space-y-5">
              <div>
                <FieldLabel>Coach Gender</FieldLabel>
                <Segmented
                  cols={3}
                  value={coachGenderPref}
                  onChange={setCoachGenderPref}
                  options={[
                    { value: 'same', label: 'Same as Me' },
                    { value: 'opposite', label: 'Opposite' },
                    { value: 'nopref', label: 'No Pref' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel hint="How hands-on should your coach be?">Communication Style</FieldLabel>
                <Segmented
                  cols={2}
                  value={commsStyle}
                  onChange={setCommsStyle}
                  options={[
                    { value: 'handson', label: 'Hands-On' },
                    { value: 'weekly', label: 'Weekly Review' },
                    { value: 'independent', label: 'Mostly Solo' },
                    { value: 'asneeded', label: 'As Needed' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel>Check-In Frequency</FieldLabel>
                <Segmented
                  cols={4}
                  value={checkInFreq}
                  onChange={setCheckInFreq}
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'biweekly', label: '2 wks' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel hint="So your coach can schedule live messaging / calls">Time Zone</FieldLabel>
                <Segmented
                  cols={2}
                  value={timeZone}
                  onChange={setTimeZone}
                  options={[
                    { value: 'et', label: 'Eastern' },
                    { value: 'ct', label: 'Central' },
                    { value: 'mt', label: 'Mountain' },
                    { value: 'pt', label: 'Pacific' },
                    { value: 'intl', label: 'Other / Intl' },
                  ]}
                />
              </div>
            </div>
          </Panel>
        )}

        {/* Budget tier — required so we can match to coaches in the right price band. */}
        {role && (
          <Panel delay={480}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Investment
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              MONTHLY BUDGET
            </h2>
            <p className="text-[11px] text-white/45 mb-3 leading-relaxed">
              Coaches set their own pricing. This helps us match you with someone in your range — most clients spend $150–$400/mo for online coaching.
            </p>
            <Segmented
              cols={2}
              value={budget}
              onChange={setBudget}
              options={[
                { value: '<100', label: 'Under $100' },
                { value: '100-200', label: '$100 – $200' },
                { value: '200-400', label: '$200 – $400' },
                { value: '400+', label: '$400+' },
              ]}
            />
            <div className="mt-4">
              <FieldLabel>When Can You Start?</FieldLabel>
              <Segmented
                cols={2}
                value={startWhen}
                onChange={setStartWhen}
                options={[
                  { value: 'now', label: 'This Week' },
                  { value: '2wks', label: 'Within 2 Weeks' },
                  { value: '1mo', label: 'Within a Month' },
                  { value: 'explore', label: 'Just Exploring' },
                ]}
              />
            </div>
          </Panel>
        )}

        {/* Contact — required so we can actually reach the user. */}
        {role && (
          <Panel delay={540}>
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Contact
            </p>
            <h2 className="text-[20px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              HOW TO REACH YOU
            </h2>
            <div className="space-y-4">
              <div>
                <FieldLabel>Email</FieldLabel>
                <TextField value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
              </div>
              <div>
                <FieldLabel hint="Optional — for faster intro scheduling">Phone</FieldLabel>
                <TextField value={phone} onChange={setPhone} placeholder="—" type="tel" autoComplete="tel" />
              </div>
            </div>
          </Panel>
        )}

        {/* How it works — the business-model reveal. Anchors the bottom so the
            user understands what they're committing to before submitting. */}
        {role && (
          <Panel delay={600} accent="#9ca3af">
            <p className="text-[10px] uppercase font-bold mb-3" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.22em' }}>
              How REPLAB Coaching Works
            </p>
            <ol className="space-y-2.5 text-[12px] text-white/55 leading-relaxed list-none">
              <li><span className="text-white font-bold mr-2">01</span>You submit this request — free, no commitment.</li>
              <li><span className="text-white font-bold mr-2">02</span>We propose a matched coach within 48 hours.</li>
              <li><span className="text-white font-bold mr-2">03</span>15-minute intro call with your coach — also free.</li>
              <li><span className="text-white font-bold mr-2">04</span>If it's a fit: coach builds your program. Monthly billing through REPLAB.</li>
              <li><span className="text-white font-bold mr-2">05</span>Cancel anytime. No long-term contracts.</li>
            </ol>
          </Panel>
        )}

        {/* Submit */}
        {role && (
          <div className="fade-slide-up" style={{ animationDelay: '660ms' }}>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                letterSpacing: '0.25em', fontSize: '13px', padding: '16px',
                borderRadius: '2px',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
                boxShadow: canSubmit
                  ? '0 4px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : 'none',
              }}
            >
              Request Coach
            </button>
            {!canSubmit && (
              <p className="text-[11px] text-white/35 mt-3 text-center">
                Fill in name, email, budget, and your {role === 'trainer' ? 'training format' : 'primary goal'} to submit.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
