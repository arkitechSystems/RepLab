import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'willfit.json');

// In-memory database
let data = {
  users: [],
  templates: [],
  templateExercises: [],
  scheduleDays: [],
  sessions: [],
  sessionEntries: [],
  personalBests: [],
  _nextId: {
    users: 1,
    templates: 1,
    templateExercises: 1,
    scheduleDays: 1,
    sessions: 1,
    sessionEntries: 1,
    personalBests: 1,
  },
};

// Load from disk if exists
function load() {
  if (existsSync(DB_PATH)) {
    try {
      data = JSON.parse(readFileSync(DB_PATH, 'utf-8'));
      return;
    } catch {
      console.warn('Corrupted DB file, starting fresh');
    }
  }
  seedTemplates();
  save();
}

// Save to disk
function save() {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(table) {
  const id = data._nextId[table];
  data._nextId[table]++;
  return id;
}

// Seed default templates
function seedTemplates() {
  const templates = [
    {
      name: 'Push',
      description: 'Chest, Shoulders, Triceps',
      isRest: false,
      exercises: [
        { name: 'Barbell Bench Press', sets: [{ reps: 10, weight: 135 }, { reps: 8, weight: 155 }, { reps: 6, weight: 175 }, { reps: 6, weight: 175 }] },
        { name: 'Incline Dumbbell Press', sets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 50 }, { reps: 8, weight: 55 }] },
        { name: 'Seated Shoulder Press (DB)', sets: [{ reps: 12, weight: 40 }, { reps: 10, weight: 45 }, { reps: 8, weight: 50 }] },
        { name: 'Lateral Raises', sets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 20 }, { reps: 12, weight: 25 }] },
        { name: 'Cable Tricep Pushdown', sets: [{ reps: 12, weight: 60 }, { reps: 12, weight: 70 }, { reps: 10, weight: 80 }] },
        { name: 'Overhead Tricep Extension (rope)', sets: [{ reps: 12, weight: 50 }, { reps: 10, weight: 60 }, { reps: 10, weight: 60 }] },
      ],
    },
    {
      name: 'Pull',
      description: 'Back, Rear Delts, Biceps',
      isRest: false,
      exercises: [
        { name: 'Lat Pulldown', sets: [{ reps: 12, weight: 120 }, { reps: 10, weight: 140 }, { reps: 8, weight: 160 }] },
        { name: 'Barbell Row', sets: [{ reps: 10, weight: 135 }, { reps: 8, weight: 155 }, { reps: 8, weight: 155 }] },
        { name: 'Seated Cable Row', sets: [{ reps: 12, weight: 120 }, { reps: 12, weight: 130 }, { reps: 10, weight: 140 }] },
        { name: 'Face Pulls', sets: [{ reps: 15, weight: 50 }, { reps: 15, weight: 60 }, { reps: 12, weight: 70 }] },
        { name: 'Barbell Curl', sets: [{ reps: 12, weight: 65 }, { reps: 10, weight: 75 }, { reps: 8, weight: 85 }] },
        { name: 'Hammer Curl (DB)', sets: [{ reps: 12, weight: 30 }, { reps: 10, weight: 35 }, { reps: 10, weight: 35 }] },
      ],
    },
    {
      name: 'Legs',
      description: 'Quads, Hamstrings, Glutes, Calves',
      isRest: false,
      exercises: [
        { name: 'Back Squat', sets: [{ reps: 10, weight: 185 }, { reps: 8, weight: 205 }, { reps: 6, weight: 225 }, { reps: 6, weight: 225 }] },
        { name: 'Romanian Deadlift', sets: [{ reps: 10, weight: 135 }, { reps: 10, weight: 155 }, { reps: 8, weight: 185 }] },
        { name: 'Leg Press', sets: [{ reps: 12, weight: 270 }, { reps: 12, weight: 320 }, { reps: 10, weight: 360 }] },
        { name: 'Leg Curl', sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 100 }, { reps: 10, weight: 110 }] },
        { name: 'Leg Extension', sets: [{ reps: 12, weight: 110 }, { reps: 12, weight: 120 }, { reps: 10, weight: 130 }] },
        { name: 'Standing Calf Raise', sets: [{ reps: 15, weight: 140 }, { reps: 15, weight: 160 }, { reps: 12, weight: 180 }] },
      ],
    },
    {
      name: 'Rest',
      description: 'Recovery Day',
      isRest: true,
      exercises: [],
    },
  ];

  for (const t of templates) {
    const templateId = nextId('templates');
    data.templates.push({
      id: templateId,
      userId: null,
      name: t.name,
      description: t.description,
      isRest: t.isRest,
    });

    let sortOrder = 0;
    for (const ex of t.exercises) {
      for (let i = 0; i < ex.sets.length; i++) {
        const exId = nextId('templateExercises');
        data.templateExercises.push({
          id: exId,
          templateId,
          name: ex.name,
          setNumber: i + 1,
          plannedReps: ex.sets[i].reps,
          suggestedWeight: ex.sets[i].weight,
          sortOrder,
        });
      }
      sortOrder++;
    }
  }

  console.log('Seeded default workout templates');
}

// Database API
const db = {
  // Users
  findUserByEmail(email) {
    return data.users.find((u) => u.email === email) || null;
  },

  createUser(email, passwordHash) {
    const id = nextId('users');
    const user = { id, email, passwordHash, createdAt: new Date().toISOString() };
    data.users.push(user);
    save();
    return user;
  },

  // Templates
  getTemplates(userId) {
    const templates = data.templates.filter((t) => t.userId === null || t.userId === userId);
    return templates.map((t) => {
      const exercises = data.templateExercises
        .filter((e) => e.templateId === t.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.setNumber - b.setNumber);

      const grouped = [];
      const seen = new Map();
      for (const ex of exercises) {
        if (!seen.has(ex.name)) {
          seen.set(ex.name, grouped.length);
          grouped.push({ name: ex.name, sortOrder: ex.sortOrder, sets: [] });
        }
        grouped[seen.get(ex.name)].sets.push({
          setNumber: ex.setNumber,
          plannedReps: ex.plannedReps,
          suggestedWeight: ex.suggestedWeight,
        });
      }

      return { id: t.id, name: t.name, description: t.description, isRest: t.isRest, exercises: grouped };
    });
  },

  updateTemplate(templateId, name, description, exercises) {
    const template = data.templates.find((t) => t.id === templateId);
    if (!template) return null;

    template.name = name;
    template.description = description;

    // Remove old exercises for this template
    data.templateExercises = data.templateExercises.filter((e) => e.templateId !== templateId);

    // Insert new exercises
    if (exercises) {
      exercises.forEach((ex, sortOrder) => {
        const sets = ex.sets || [{ reps: 10, weight: 0 }];
        sets.forEach((set, i) => {
          const exId = nextId('templateExercises');
          data.templateExercises.push({
            id: exId,
            templateId,
            name: ex.name,
            setNumber: i + 1,
            plannedReps: set.reps || 10,
            suggestedWeight: set.weight || 0,
            sortOrder,
          });
        });
      });
    }

    save();
    return { id: templateId, name, description };
  },

  createTemplate(userId, name, description, exercises) {
    const templateId = nextId('templates');
    data.templates.push({ id: templateId, userId, name, description, isRest: false });

    if (exercises) {
      exercises.forEach((ex, sortOrder) => {
        const sets = ex.sets || [{ reps: 10, weight: 0 }];
        sets.forEach((set, i) => {
          const exId = nextId('templateExercises');
          data.templateExercises.push({
            id: exId,
            templateId,
            name: ex.name,
            setNumber: i + 1,
            plannedReps: set.reps || 10,
            suggestedWeight: set.weight || 0,
            sortOrder,
          });
        });
      });
    }

    save();
    return { id: templateId, name, description };
  },

  // Schedule
  getSchedule(userId) {
    return data.scheduleDays
      .filter((s) => s.userId === userId)
      .map((s) => {
        const t = data.templates.find((t) => t.id === s.templateId);
        return {
          dayOfWeek: s.dayOfWeek,
          templateId: s.templateId,
          templateName: t?.name || 'Unknown',
          isRest: t?.isRest || false,
        };
      })
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  },

  setDefaultSchedule(userId) {
    const templateMap = {};
    for (const t of data.templates.filter((t) => t.userId === null)) {
      templateMap[t.name] = t.id;
    }

    const defaults = [
      { day: 1, template: 'Push' },
      { day: 2, template: 'Pull' },
      { day: 3, template: 'Rest' },
      { day: 4, template: 'Legs' },
      { day: 5, template: 'Push' },
      { day: 6, template: 'Pull' },
      { day: 0, template: 'Rest' },
    ];

    for (const d of defaults) {
      if (templateMap[d.template]) {
        const id = nextId('scheduleDays');
        data.scheduleDays.push({ id, userId, dayOfWeek: d.day, templateId: templateMap[d.template] });
      }
    }
    save();
  },

  updateSchedule(userId, schedule) {
    for (const day of schedule) {
      const existing = data.scheduleDays.find((s) => s.userId === userId && s.dayOfWeek === day.dayOfWeek);
      if (existing) {
        existing.templateId = day.templateId;
      } else {
        const id = nextId('scheduleDays');
        data.scheduleDays.push({ id, userId, dayOfWeek: day.dayOfWeek, templateId: day.templateId });
      }
    }
    save();
  },

  // Sessions
  createSession(userId, templateId, date, entries) {
    const sessionId = nextId('sessions');
    data.sessions.push({ id: sessionId, userId, templateId, date, createdAt: new Date().toISOString() });

    const bestByExercise = new Map();

    for (const entry of entries) {
      const entryId = nextId('sessionEntries');
      data.sessionEntries.push({
        id: entryId,
        sessionId,
        exerciseName: entry.exerciseName,
        setNumber: entry.setNumber,
        weight: entry.weight || 0,
        reps: entry.reps || 0,
      });

      const w = entry.weight || 0;
      const r = entry.reps || 0;
      if (w > 0 && r > 0) {
        const current = bestByExercise.get(entry.exerciseName);
        if (!current || w > current.weight || (w === current.weight && r > current.reps)) {
          bestByExercise.set(entry.exerciseName, { weight: w, reps: r });
        }
      }
    }

    // Update PBs
    for (const [exerciseName, best] of bestByExercise) {
      const existing = data.personalBests.find(
        (pb) => pb.userId === userId && pb.templateId === templateId && pb.exerciseName === exerciseName
      );

      if (existing) {
        if (best.weight > existing.bestWeight || (best.weight === existing.bestWeight && best.reps > existing.bestReps)) {
          existing.bestWeight = best.weight;
          existing.bestReps = best.reps;
          existing.achievedAt = new Date().toISOString();
        }
      } else {
        const pbId = nextId('personalBests');
        data.personalBests.push({
          id: pbId,
          userId,
          templateId,
          exerciseName,
          bestWeight: best.weight,
          bestReps: best.reps,
          achievedAt: new Date().toISOString(),
        });
      }
    }

    save();
    return { id: sessionId };
  },

  getSessions(userId) {
    return data.sessions
      .filter((s) => s.userId === userId)
      .map((s) => {
        const t = data.templates.find((t) => t.id === s.templateId);
        return { id: s.id, date: s.date, templateId: s.templateId, createdAt: s.createdAt, templateName: t?.name || 'Unknown' };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  getSession(userId, sessionId) {
    const session = data.sessions.find((s) => s.id === sessionId && s.userId === userId);
    if (!session) return null;

    const t = data.templates.find((t) => t.id === session.templateId);
    const entries = data.sessionEntries
      .filter((e) => e.sessionId === sessionId)
      .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber);

    return {
      id: session.id,
      date: session.date,
      templateId: session.templateId,
      createdAt: session.createdAt,
      templateName: t?.name || 'Unknown',
      entries,
    };
  },

  // Personal Bests
  getPBs(userId, templateId) {
    let pbs = data.personalBests.filter((pb) => pb.userId === userId);
    if (templateId) {
      pbs = pbs.filter((pb) => pb.templateId === Number(templateId));
    }
    return pbs;
  },
};

// Initialize
load();

export default db;
