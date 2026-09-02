/* ============================================
   KINETIC AI COACH — App Logic
   ============================================ */

/* ---- Anonymous ID + event tracking (traction/demand signals) ---- */
const ANON_ID_KEY = 'kinetic_anon_id';
function getAnonId() {
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

function track(event, data = {}) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, anonId: getAnonId(), data }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {
    /* never let analytics break the app */
  }
}

/* ---- Real AI calls to Nova's brain (server-side Claude proxy) ---- */
async function askNova(type, ctx, message) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 9000);
    const resp = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ctx, message }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.text || null;
  } catch (e) {
    return null;
  }
}

/* ---- Nova's animated face avatar (idle / thinking / talking / happy) ---- */
function setNovaFace(id, faceState) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('state-idle', 'state-thinking', 'state-talking', 'state-happy');
  el.classList.add('state-' + faceState);
}

function novaFaceTalk(id, ms, settleState) {
  setNovaFace(id, 'talking');
  setTimeout(() => setNovaFace(id, settleState || 'idle'), ms || 2200);
}

function showAiBadge(id, live) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
  el.textContent = live ? '✨ Live AI' : '📋 Offline mode';
  el.classList.toggle('offline', !live);
}

const state = {
  screen: 'welcome',
  onboardingStep: 1,
  selections: {
    goal: null,
    mood: null,
    energy: 50,
    duration: null,
  },
  workout: null,
  currentExerciseIndex: 0,
  timer: null,
  timeLeft: 0,
  isPaused: false,
  isBreak: false,
  breakTimer: null,
  completedExercises: [],
  skippedExercises: [],
  totalCalories: 0,
  activeTime: 0,
  activeTimer: null,
  difficultyAdjustments: 0,
  streak: 1,
  chatOpen: false,
  chatLoading: false,
  feedbackRating: 0,
};

const exerciseDB = {
  'weight-loss': {
    energized: [
      { name: 'Jumping Jacks', emoji: '🤸', desc: 'Full-body warm-up to fire up your engine', duration: 40, reps: 30, sets: 3, rest: 15, cal: 12 },
      { name: 'High Knees', emoji: '🏃', desc: 'Drive those knees up — keep the pace!', duration: 35, reps: 25, sets: 3, rest: 15, cal: 14 },
      { name: 'Mountain Climbers', emoji: '⛰️', desc: 'Core and cardio in one move', duration: 40, reps: 30, sets: 3, rest: 15, cal: 15 },
      { name: 'Burpees', emoji: '🔥', desc: 'The ultimate calorie crusher', duration: 45, reps: 12, sets: 3, rest: 20, cal: 20 },
      { name: 'Jump Squats', emoji: '🦵', desc: 'Explosive power for your lower body', duration: 40, reps: 15, sets: 3, rest: 18, cal: 18 },
      { name: 'Plank Jacks', emoji: '🪵', desc: 'Core stability meets cardio', duration: 35, reps: 20, sets: 3, rest: 15, cal: 14 },
      { name: 'Bicycle Crunches', emoji: '🚴', desc: 'Sculpt your obliques', duration: 40, reps: 25, sets: 3, rest: 15, cal: 12 },
      { name: 'Star Jumps', emoji: '⭐', desc: 'Finish strong with full-body power', duration: 35, reps: 20, sets: 2, rest: 15, cal: 16 },
    ],
    good: [
      { name: 'Jumping Jacks', emoji: '🤸', desc: 'Warm up that body', duration: 35, reps: 25, sets: 3, rest: 15, cal: 10 },
      { name: 'High Knees', emoji: '🏃', desc: 'Steady pace, steady burn', duration: 30, reps: 20, sets: 3, rest: 15, cal: 12 },
      { name: 'Squat to Knee Drive', emoji: '🦵', desc: 'Power through each rep', duration: 40, reps: 15, sets: 3, rest: 18, cal: 14 },
      { name: 'Mountain Climbers', emoji: '⛰️', desc: 'Keep that core tight', duration: 35, reps: 25, sets: 3, rest: 15, cal: 14 },
      { name: 'Skaters', emoji: '⛸️', desc: 'Lateral agility and cardio', duration: 35, reps: 20, sets: 3, rest: 15, cal: 13 },
      { name: 'Plank Jacks', emoji: '🪵', desc: 'Steady core work', duration: 30, reps: 18, sets: 3, rest: 15, cal: 12 },
      { name: 'Bicycle Crunches', emoji: '🚴', desc: 'Twist and tighten', duration: 35, reps: 20, sets: 2, rest: 15, cal: 11 },
    ],
    tired: [
      { name: 'Arm Circles', emoji: '💫', desc: 'Gentle warm-up to wake up', duration: 30, reps: 15, sets: 2, rest: 12, cal: 6 },
      { name: 'Step Jacks', emoji: '🤸', desc: 'Low-impact cardio to start', duration: 35, reps: 20, sets: 2, rest: 15, cal: 8 },
      { name: 'Bodyweight Squats', emoji: '🦵', desc: 'Nice and controlled', duration: 35, reps: 12, sets: 2, rest: 15, cal: 9 },
      { name: 'Standing Marches', emoji: '🚶', desc: 'Keep it moving at your pace', duration: 30, reps: 16, sets: 2, rest: 12, cal: 7 },
      { name: 'Modified Push-ups', emoji: '💪', desc: 'Knee push-ups, perfect for today', duration: 30, reps: 10, sets: 2, rest: 15, cal: 8 },
      { name: 'Seated Twists', emoji: '🪑', desc: 'Gentle core work', duration: 30, reps: 14, sets: 2, rest: 12, cal: 6 },
    ],
    stressed: [
      { name: 'Deep Breathing', emoji: '🌬️', desc: 'Inhale calm, exhale tension', duration: 30, reps: 5, sets: 2, rest: 10, cal: 4 },
      { name: 'Cat-Cow Stretch', emoji: '🐈', desc: 'Release the spine, release the stress', duration: 35, reps: 10, sets: 2, rest: 10, cal: 5 },
      { name: 'Standing Forward Fold', emoji: '🙇', desc: 'Let it all go', duration: 30, reps: 8, sets: 2, rest: 10, cal: 5 },
      { name: 'Gentle Twists', emoji: '🌀', desc: 'Unwind your spine', duration: 30, reps: 10, sets: 2, rest: 10, cal: 5 },
      { name: "Child's Pose", emoji: '🧘', desc: 'Breathe and reset', duration: 40, reps: 5, sets: 2, rest: 10, cal: 4 },
      { name: 'Should Rolls', emoji: '💆', desc: 'Melt away the tension', duration: 30, reps: 12, sets: 2, rest: 10, cal: 5 },
    ],
  },
  'muscle-gain': {
    energized: [
      { name: 'Push-ups', emoji: '💪', desc: 'Chest, shoulders, and triceps', duration: 40, reps: 15, sets: 3, rest: 20, cal: 10 },
      { name: 'Bulgarian Split Squats', emoji: '🦵', desc: 'Unilateral leg power', duration: 45, reps: 12, sets: 3, rest: 20, cal: 12 },
      { name: 'Pike Push-ups', emoji: '🤸', desc: 'Shoulder builder', duration: 40, reps: 10, sets: 3, rest: 20, cal: 11 },
      { name: 'Pull-up Holds', emoji: '🧗', desc: 'Build that back strength', duration: 35, reps: 8, sets: 3, rest: 20, cal: 12 },
      { name: 'Diamond Push-ups', emoji: '💎', desc: 'Triceps on fire', duration: 35, reps: 12, sets: 3, rest: 18, cal: 11 },
      { name: 'Pistol Squat Progression', emoji: '🔫', desc: 'Single-leg strength', duration: 40, reps: 8, sets: 3, rest: 20, cal: 13 },
      { name: 'Superman Holds', emoji: '🦸', desc: 'Lower back strength', duration: 35, reps: 10, sets: 3, rest: 18, cal: 10 },
      { name: 'Decline Push-ups', emoji: '📉', desc: 'Upper chest finisher', duration: 40, reps: 12, sets: 2, rest: 20, cal: 12 },
    ],
    good: [
      { name: 'Push-ups', emoji: '💪', desc: 'Classic chest builder', duration: 40, reps: 12, sets: 3, rest: 20, cal: 9 },
      { name: 'Bodyweight Squats', emoji: '🦵', desc: 'Foundation of leg strength', duration: 40, reps: 15, sets: 3, rest: 20, cal: 10 },
      { name: 'Incline Push-ups', emoji: '📈', desc: 'Build up your push-up', duration: 35, reps: 12, sets: 3, rest: 18, cal: 8 },
      { name: 'Lunges', emoji: '🚶', desc: 'Leg strength and balance', duration: 40, reps: 12, sets: 3, rest: 18, cal: 10 },
      { name: 'Plank to Push-up', emoji: '🪵', desc: 'Core and upper body', duration: 35, reps: 10, sets: 3, rest: 18, cal: 10 },
      { name: 'Glute Bridges', emoji: '🍑', desc: 'Posterior chain power', duration: 35, reps: 15, sets: 3, rest: 15, cal: 9 },
      { name: 'Tricep Dips', emoji: '💪', desc: 'Arm definition', duration: 35, reps: 12, sets: 2, rest: 18, cal: 9 },
    ],
    tired: [
      { name: 'Wall Push-ups', emoji: '🧱', desc: 'Easy on the muscles, still effective', duration: 30, reps: 12, sets: 2, rest: 15, cal: 6 },
      { name: 'Bodyweight Squats', emoji: '🦵', desc: 'Controlled and steady', duration: 35, reps: 10, sets: 2, rest: 15, cal: 8 },
      { name: 'Glute Bridges', emoji: '🍑', desc: 'Activate the posterior chain', duration: 30, reps: 12, sets: 2, rest: 15, cal: 7 },
      { name: 'Knee Push-ups', emoji: '💪', desc: 'Modified but mighty', duration: 30, reps: 10, sets: 2, rest: 15, cal: 7 },
      { name: 'Standing Calf Raises', emoji: '🦶', desc: 'Lower leg strength', duration: 30, reps: 15, sets: 2, rest: 12, cal: 6 },
      { name: 'Bird Dogs', emoji: '🐕', desc: 'Core and balance', duration: 30, reps: 10, sets: 2, rest: 12, cal: 6 },
    ],
    stressed: [
      { name: 'Cat-Cow Stretch', emoji: '🐈', desc: 'Release tension in the spine', duration: 35, reps: 10, sets: 2, rest: 12, cal: 5 },
      { name: 'Thread the Needle', emoji: '🧵', desc: 'Open up the shoulders', duration: 35, reps: 8, sets: 2, rest: 12, cal: 5 },
      { name: "World's Greatest Stretch", emoji: '🌍', desc: 'Full-body mobility', duration: 40, reps: 6, sets: 2, rest: 12, cal: 6 },
      { name: 'Hip Flexor Stretch', emoji: '🦵', desc: 'Release tight hips', duration: 35, reps: 8, sets: 2, rest: 10, cal: 5 },
      { name: 'Cobra Pose', emoji: '🐍', desc: 'Open the chest', duration: 30, reps: 8, sets: 2, rest: 10, cal: 5 },
      { name: 'Foam Roll Emulation', emoji: '💆', desc: 'Self-myofascial release', duration: 40, reps: 5, sets: 2, rest: 10, cal: 4 },
    ],
  },
  'endurance': {
    energized: [
      { name: 'High Knees', emoji: '🏃', desc: 'Fast pace, high heart rate', duration: 45, reps: 30, sets: 3, rest: 15, cal: 14 },
      { name: 'Burpees', emoji: '🔥', desc: 'Full-body conditioning', duration: 45, reps: 15, sets: 3, rest: 20, cal: 18 },
      { name: 'Mountain Climbers', emoji: '⛰️', desc: 'Speed and core', duration: 40, reps: 30, sets: 3, rest: 15, cal: 15 },
      { name: 'Jumping Jacks', emoji: '🤸', desc: 'Keep that heart pumping', duration: 40, reps: 30, sets: 3, rest: 15, cal: 12 },
      { name: 'Skater Jumps', emoji: '⛸️', desc: 'Lateral endurance', duration: 40, reps: 24, sets: 3, rest: 15, cal: 14 },
      { name: 'Squat Jumps', emoji: '🦵', desc: 'Plyometric power', duration: 40, reps: 18, sets: 3, rest: 18, cal: 16 },
      { name: 'Plank to Jack', emoji: '🪵', desc: 'Core and cardio combined', duration: 40, reps: 20, sets: 3, rest: 15, cal: 14 },
      { name: 'Sprint in Place', emoji: '🏃', desc: 'Max effort finisher', duration: 35, reps: 20, sets: 2, rest: 15, cal: 16 },
    ],
    good: [
      { name: 'Jumping Jacks', emoji: '🤸', desc: 'Steady cardio warm-up', duration: 40, reps: 25, sets: 3, rest: 15, cal: 10 },
      { name: 'High Knees', emoji: '🏃', desc: 'Keep a consistent rhythm', duration: 35, reps: 25, sets: 3, rest: 15, cal: 12 },
      { name: 'Mountain Climbers', emoji: '⛰️', desc: 'Core and cardio', duration: 35, reps: 25, sets: 3, rest: 15, cal: 13 },
      { name: 'Skaters', emoji: '⛸️', desc: 'Lateral movement', duration: 35, reps: 20, sets: 3, rest: 15, cal: 12 },
      { name: 'Squat Jumps', emoji: '🦵', desc: 'Plyometric endurance', duration: 35, reps: 15, sets: 3, rest: 18, cal: 14 },
      { name: 'Plank Jacks', emoji: '🪵', desc: 'Core stability', duration: 30, reps: 20, sets: 3, rest: 15, cal: 12 },
      { name: 'Bicycle Crunches', emoji: '🚴', desc: 'Core finisher', duration: 35, reps: 20, sets: 2, rest: 15, cal: 11 },
    ],
    tired: [
      { name: 'Step Jacks', emoji: '🤸', desc: 'Low-impact cardio', duration: 35, reps: 20, sets: 2, rest: 15, cal: 8 },
      { name: 'Marching in Place', emoji: '🚶', desc: 'Steady and gentle', duration: 35, reps: 20, sets: 2, rest: 12, cal: 7 },
      { name: 'Side Steps', emoji: '👉', desc: 'Lateral movement, easy pace', duration: 30, reps: 16, sets: 2, rest: 12, cal: 7 },
      { name: 'Arm Circles', emoji: '💫', desc: 'Shoulder endurance', duration: 30, reps: 15, sets: 2, rest: 12, cal: 6 },
      { name: 'Standing Twists', emoji: '🌀', desc: 'Core mobility', duration: 30, reps: 14, sets: 2, rest: 12, cal: 6 },
      { name: 'Calf Raises', emoji: '🦶', desc: 'Lower leg endurance', duration: 30, reps: 15, sets: 2, rest: 12, cal: 6 },
    ],
    stressed: [
      { name: 'Diaphragmatic Breathing', emoji: '🌬️', desc: 'Build breathing endurance', duration: 40, reps: 8, sets: 2, rest: 12, cal: 4 },
      { name: 'Sun Salutation Flow', emoji: '☀️', desc: 'Flowing movement for calm endurance', duration: 45, reps: 6, sets: 2, rest: 12, cal: 6 },
      { name: 'Standing Forward Fold', emoji: '🙇', desc: 'Release and breathe', duration: 30, reps: 6, sets: 2, rest: 10, cal: 5 },
      { name: 'Gentle Lunges', emoji: '🦵', desc: 'Slow and controlled', duration: 35, reps: 8, sets: 2, rest: 12, cal: 6 },
      { name: 'Seated Spinal Twist', emoji: '🌀', desc: 'Unwind and breathe', duration: 30, reps: 8, sets: 2, rest: 10, cal: 5 },
      { name: 'Legs Up the Wall', emoji: '🧘', desc: 'Restorative inversion', duration: 45, reps: 4, sets: 2, rest: 10, cal: 4 },
    ],
  },
  'flexibility': {
    energized: [
      { name: 'Dynamic Leg Swings', emoji: '🦵', desc: 'Warm up those hips', duration: 35, reps: 12, sets: 2, rest: 12, cal: 7 },
      { name: "World's Greatest Stretch", emoji: '🌍', desc: 'Full-body mobility', duration: 40, reps: 8, sets: 2, rest: 12, cal: 8 },
      { name: 'Deep Lunge with Twist', emoji: '🌀', desc: 'Hip opener with spinal rotation', duration: 40, reps: 8, sets: 2, rest: 12, cal: 7 },
      { name: 'Downward Dog to Cobra', emoji: '🐕', desc: 'Flowing spine and shoulder opener', duration: 40, reps: 10, sets: 2, rest: 12, cal: 8 },
      { name: 'Pigeon Pose', emoji: '🕊️', desc: 'Deep hip stretch', duration: 45, reps: 6, sets: 2, rest: 10, cal: 6 },
      { name: 'Standing Forward Fold', emoji: '🙇', desc: 'Hamstring and spine stretch', duration: 40, reps: 8, sets: 2, rest: 10, cal: 6 },
      { name: 'Seated Straddle Stretch', emoji: '🧘', desc: 'Inner thigh and hamstring mobility', duration: 45, reps: 6, sets: 2, rest: 10, cal: 6 },
      { name: 'Full Body Reach', emoji: '🙆', desc: 'Lengthen everything', duration: 40, reps: 8, sets: 2, rest: 10, cal: 6 },
    ],
    good: [
      { name: 'Cat-Cow Stretch', emoji: '🐈', desc: 'Spinal mobility flow', duration: 35, reps: 10, sets: 2, rest: 10, cal: 6 },
      { name: 'Downward Dog', emoji: '🐕', desc: 'Full posterior chain stretch', duration: 40, reps: 8, sets: 2, rest: 12, cal: 7 },
      { name: 'Lunge with Reach', emoji: '🦵', desc: 'Hip flexor opener', duration: 40, reps: 8, sets: 2, rest: 12, cal: 7 },
      { name: 'Seated Forward Fold', emoji: '🙇', desc: 'Calm hamstring stretch', duration: 40, reps: 8, sets: 2, rest: 10, cal: 6 },
      { name: 'Spinal Twist', emoji: '🌀', desc: 'Release the back', duration: 35, reps: 10, sets: 2, rest: 10, cal: 5 },
      { name: 'Butterfly Stretch', emoji: '🦋', desc: 'Inner thigh opener', duration: 40, reps: 8, sets: 2, rest: 10, cal: 5 },
      { name: "Child's Pose", emoji: '🧘', desc: 'Restorative finish', duration: 45, reps: 5, sets: 2, rest: 10, cal: 4 },
    ],
    tired: [
      { name: 'Neck Rolls', emoji: '💆', desc: 'Gentle neck release', duration: 30, reps: 8, sets: 2, rest: 10, cal: 4 },
      { name: 'Shoulder Shrugs', emoji: '🤷', desc: 'Release shoulder tension', duration: 30, reps: 10, sets: 2, rest: 10, cal: 4 },
      { name: 'Seated Cat-Cow', emoji: '🐈', desc: 'Gentle spinal mobility', duration: 35, reps: 8, sets: 2, rest: 10, cal: 5 },
      { name: 'Gentle Forward Fold', emoji: '🙇', desc: 'Soft hamstring stretch', duration: 35, reps: 6, sets: 2, rest: 10, cal: 5 },
      { name: 'Knee to Chest', emoji: '🦵', desc: 'Easy hip opener', duration: 30, reps: 8, sets: 2, rest: 10, cal: 4 },
      { name: 'Ankle Circles', emoji: '🦶', desc: 'Joint mobility', duration: 30, reps: 10, sets: 2, rest: 10, cal: 3 },
    ],
    stressed: [
      { name: 'Deep Breathing', emoji: '🌬️', desc: 'Breathe in calm, breathe out stress', duration: 40, reps: 6, sets: 2, rest: 10, cal: 3 },
      { name: 'Neck Rolls', emoji: '💆', desc: 'Release neck tension', duration: 35, reps: 8, sets: 2, rest: 10, cal: 4 },
      { name: 'Cat-Cow Stretch', emoji: '🐈', desc: 'Flowing spinal release', duration: 40, reps: 10, sets: 2, rest: 10, cal: 5 },
      { name: "Child's Pose", emoji: '🧘', desc: 'Surrender and breathe', duration: 45, reps: 5, sets: 2, rest: 10, cal: 4 },
      { name: 'Legs Up the Wall', emoji: '🧘', desc: 'Ultimate relaxation pose', duration: 50, reps: 4, sets: 2, rest: 10, cal: 3 },
      { name: 'Supine Twist', emoji: '🌀', desc: 'Gentle spinal release', duration: 40, reps: 6, sets: 2, rest: 10, cal: 4 },
    ],
  },
};

const novaMessages = {
  start: [
    "Let's begin! You've got this. 💪",
    "Time to shine! I'm right here with you.",
    "Let's crush this workout together! 🔥",
  ],
  midWorkout: [
    "Halfway there! Keep that form tight. ⚡",
    "You're doing amazing — push through!",
    "Feel that burn? That's progress! 📈",
    "Stay focused, stay strong. You're crushing it!",
  ],
  encouragement: [
    "Beautiful form! Keep it up. ✨",
    "You're stronger than you think!",
    "Every rep counts — proud of you! 💜",
    "That's it! Feel the power in each movement.",
  ],
  tooHard: [
    "No worries! I'm dialing back the intensity. You're still making progress. 💜",
    "Smart call! Let's adjust — sustainable effort beats burnout. I've made the next exercise easier.",
    "Listening to your body is key. I've reduced the reps for you. Let's keep going!",
  ],
  tooEasy: [
    "Love the energy! I'm leveling up your next exercise. Let's push harder! 🔥",
    "You're unstoppable! I've increased the challenge for the next set.",
    "Let's turn it up! I'm adding more intensity to match your power. ⚡",
  ],
  takeBreak: [
    "Great call! Take a breather. I'll be here when you're ready. ☕",
    "Rest is part of the grind. Recharge and come back stronger!",
    "Perfect timing. Hydrate, breathe, and we'll resume shortly. 💧",
  ],
  skipExercise: [
    "No problem! Skipping to the next one. Let's keep the momentum going. ⏭️",
    "That's okay! On to the next exercise. Every bit counts!",
    "Skipped! Let's focus on the next movement. You've got this!",
  ],
  breakResume: [
    "Welcome back! Let's pick up where we left off. 💪",
    "Nice and recharged? Let's get back to it!",
    "Break's over — time to finish strong! 🔥",
  ],
  completion: [
    "Incredible work today! You showed up and gave it your all. 🎉",
    "I'm so proud of you! Every rep brought you closer to your goals. 💜",
    "You did it! That's another step toward a stronger you. ⚡",
  ],
};

const nextWorkoutRecs = {
  'weight-loss': { title: 'HIIT Power Burn', desc: "Tomorrow, let's go harder with a high-intensity interval session to maximize fat burn and boost your metabolism.", tags: ['HIIT', 'Cardio', '30 min', 'Advanced'] },
  'muscle-gain': { title: 'Strength Builder', desc: "Tomorrow, let's focus on progressive overload with compound movements to keep building that muscle.", tags: ['Strength', 'Upper Body', '35 min', 'Intermediate'] },
  'endurance': { title: 'Cardio Endurance Flow', desc: "Tomorrow, let's build on today's momentum with a longer steady-state cardio session.", tags: ['Cardio', 'Endurance', '40 min', 'Intermediate'] },
  'flexibility': { title: 'Deep Mobility Flow', desc: "Tomorrow, let's go deeper with an extended mobility and stretching routine for full-body recovery.", tags: ['Mobility', 'Recovery', '25 min', 'All Levels'] },
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function goToScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(`screen-${screenName}`);
  if (screen) {
    screen.classList.add('active');
    state.screen = screenName;
  }
  window.scrollTo(0, 0);
  if (screenName === 'onboarding') track('onboarding_started', {});
}

function selectChoice(btn, field, value) {
  state.selections[field] = value;
  const step = btn.closest('.onboard-step');
  step.querySelectorAll('.choice-card').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('nextBtn').disabled = false;
}

function updateEnergy(val) {
  state.selections.energy = parseInt(val);
  const pct = val + '%';
  document.getElementById('energyValue').textContent = pct;
  const emojiEl = document.getElementById('energyEmoji');
  if (val < 30) emojiEl.textContent = '🪫';
  else if (val < 60) emojiEl.textContent = '🔋';
  else if (val < 85) emojiEl.textContent = '⚡';
  else emojiEl.textContent = '🚀';
  document.getElementById('nextBtn').disabled = false;
}

function nextStep() {
  if (state.onboardingStep < 4) {
    state.onboardingStep++;
    showOnboardStep(state.onboardingStep);
  } else {
    track('onboarding_completed', { ...state.selections });
    generateWorkout();
    goToScreen('recommendation');
    fetchAiRecommendation();
  }
}

function prevStep() {
  if (state.onboardingStep > 1) {
    state.onboardingStep--;
    showOnboardStep(state.onboardingStep);
  }
}

function showOnboardStep(step) {
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
  document.querySelector(`.onboard-step[data-step="${step}"]`).classList.add('active');
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.classList.toggle('active', i < step);
  });
  const backBtn = document.getElementById('backBtn');
  backBtn.classList.toggle('visible', step > 1);
  const nextBtn = document.getElementById('nextBtn');
  const stepEl = document.querySelector(`.onboard-step[data-step="${step}"]`);
  if (step === 3) {
    nextBtn.disabled = false;
  } else {
    const hasSelection = stepEl.querySelector('.choice-card.selected');
    nextBtn.disabled = !hasSelection;
  }
  nextBtn.textContent = step === 4 ? 'See My Plan' : 'Continue';
}

function generateWorkout() {
  const { goal, mood, energy, duration } = state.selections;
  const pool = exerciseDB[goal][mood] || exerciseDB[goal]['good'];
  
  let numExercises;
  if (duration <= 10) numExercises = 4;
  else if (duration <= 20) numExercises = 6;
  else if (duration <= 30) numExercises = 8;
  else numExercises = 10;

  if (energy < 30) numExercises = Math.max(3, numExercises - 2);
  else if (energy > 80) numExercises = Math.min(pool.length, numExercises + 1);

  const exercises = [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(numExercises, shuffled.length); i++) {
    exercises.push({ ...shuffled[i] });
  }

  let intensity;
  const energyMoodCombo = energy + (mood === 'energized' ? 20 : mood === 'tired' ? -20 : 0);
  if (energyMoodCombo >= 80) intensity = 'High';
  else if (energyMoodCombo >= 50) intensity = 'Medium';
  else intensity = 'Low';

  const totalCal = exercises.reduce((sum, ex) => sum + ex.cal * ex.sets, 0);

  const titles = {
    'weight-loss': 'Fat Burn Express',
    'muscle-gain': 'Strength Sculptor',
    'endurance': 'Endurance Engine',
    'flexibility': 'Mobility Flow',
  };

  const descs = {
    'weight-loss': `A ${intensity.toLowerCase()} intensity cardio circuit designed to torch calories and boost your metabolism.`,
    'muscle-gain': `A ${intensity.toLowerCase()} intensity strength session focused on building lean muscle through compound movements.`,
    'endurance': `A ${intensity.toLowerCase()} intensity conditioning circuit to push your stamina to the next level.`,
    'flexibility': `A ${intensity.toLowerCase()} intensity mobility routine to improve your range of motion and release tension.`,
  };

  state.workout = {
    title: titles[goal],
    desc: descs[goal],
    exercises,
    intensity,
    totalCalories: Math.round(totalCal),
    duration: parseInt(duration),
  };

  renderRecommendation();
}

function renderRecommendation() {
  const w = state.workout;
  document.getElementById('recoTitle').textContent = w.title;
  document.getElementById('recoDesc').textContent = w.desc;
  document.getElementById('recoDuration').textContent = `${w.duration} min`;
  document.getElementById('recoCalories').textContent = `${w.totalCalories} kcal`;
  document.getElementById('recoExercises').textContent = w.exercises.length;
  document.getElementById('recoIntensity').textContent = w.intensity;

  const listEl = document.getElementById('recoExerciseList');
  listEl.innerHTML = w.exercises.map((ex, i) => `
    <div class="reco-exercise-item">
      <div class="num">${i + 1}</div>
      <div class="emoji">${ex.emoji}</div>
      <div class="name">${ex.name}</div>
      <div class="dur">${ex.sets}×${ex.reps}</div>
    </div>
  `).join('');

  document.getElementById('recoNovaText').textContent = pickRandom(novaMessages.start);
  const badge = document.getElementById('recoAiBadge');
  if (badge) badge.hidden = true;
  setNovaFace('novaFaceReco', 'idle');
}

async function fetchAiRecommendation() {
  const w = state.workout;
  const s = state.selections;
  const textEl = document.getElementById('recoNovaText');
  const original = textEl.textContent;
  textEl.textContent = 'Nova is thinking about your plan...';
  setNovaFace('novaFaceReco', 'thinking');
  const text = await askNova('recommendation', {
    goal: s.goal,
    mood: s.mood,
    energy: s.energy,
    duration: s.duration,
    workoutTitle: w.title,
    exerciseCount: w.exercises.length,
    intensity: w.intensity,
    calories: w.totalCalories,
  });
  // Ignore stale responses if the user has already moved past this workout
  if (!state.workout || state.workout !== w) return;
  if (text) {
    textEl.textContent = text;
    showAiBadge('recoAiBadge', true);
    novaFaceTalk('novaFaceReco', 2500, 'idle');
  } else {
    textEl.textContent = original;
    showAiBadge('recoAiBadge', false);
    setNovaFace('novaFaceReco', 'idle');
  }
}

function startWorkout() {
  state.currentExerciseIndex = 0;
  state.completedExercises = [];
  state.skippedExercises = [];
  state.totalCalories = 0;
  state.activeTime = 0;
  state.difficultyAdjustments = 0;
  goToScreen('workout');
  loadExercise(0);
  startActiveTimer();
  track('workout_started', {
    goal: state.selections.goal,
    mood: state.selections.mood,
    energy: state.selections.energy,
    duration: state.workout.duration,
    exerciseCount: state.workout.exercises.length,
  });
}

function startActiveTimer() {
  if (state.activeTimer) clearInterval(state.activeTimer);
  state.activeTimer = setInterval(() => {
    if (!state.isPaused && !state.isBreak) {
      state.activeTime++;
    }
  }, 1000);
}

function loadExercise(index) {
  if (index >= state.workout.exercises.length) {
    completeWorkout();
    return;
  }

  state.currentExerciseIndex = index;
  const ex = state.workout.exercises[index];

  document.getElementById('exerciseEmoji').textContent = ex.emoji;
  document.getElementById('exerciseName').textContent = ex.name;
  document.getElementById('exerciseDesc').textContent = ex.desc;
  document.getElementById('metaSet').textContent = ex.sets;
  document.getElementById('metaReps').textContent = ex.reps;
  document.getElementById('metaRest').textContent = ex.rest + 's';

  const progress = (index / state.workout.exercises.length) * 100;
  document.getElementById('workoutProgressFill').style.width = progress + '%';
  document.getElementById('workoutExerciseNum').textContent = `Exercise ${index + 1} of ${state.workout.exercises.length}`;

  state.timeLeft = ex.duration;
  updateTimerDisplay();
  startExerciseTimer();

  if (index === 0) {
    setNovaMessage(pickRandom(novaMessages.start));
  } else if (index === Math.floor(state.workout.exercises.length / 2)) {
    setNovaMessage(pickRandom(novaMessages.midWorkout));
  } else {
    setNovaMessage(pickRandom(novaMessages.encouragement));
  }

  const card = document.getElementById('exerciseCard');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'cardIn 0.5s ease';
}

function startExerciseTimer() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (!state.isPaused && !state.isBreak) {
      state.timeLeft--;
      updateTimerDisplay();
      if (state.timeLeft <= 0) {
        clearInterval(state.timer);
        completeExercise();
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const ex = state.workout.exercises[state.currentExerciseIndex];
  if (!ex) return;
  const total = ex.duration;
  const progress = ((total - state.timeLeft) / total);
  const circumference = 552.92;
  const offset = circumference * progress;
  document.getElementById('timerCircle').style.strokeDashoffset = offset;
  document.getElementById('timerText').textContent = state.timeLeft;

  let remaining = state.timeLeft;
  for (let i = state.currentExerciseIndex + 1; i < state.workout.exercises.length; i++) {
    remaining += state.workout.exercises[i].duration + (state.workout.exercises[i].rest || 0);
  }
  document.getElementById('workoutTimeRemaining').textContent = formatTime(remaining);
}

function completeExercise() {
  const ex = state.workout.exercises[state.currentExerciseIndex];
  state.completedExercises.push({ ...ex, status: 'completed' });
  state.totalCalories += ex.cal * ex.sets;
  track('exercise_completed', { name: ex.name, goal: state.selections.goal });
  setTimeout(() => {
    loadExercise(state.currentExerciseIndex + 1);
  }, 800);
}

function setNovaMessage(msg) {
  const el = document.getElementById('novaLiveText');
  const wrap = document.getElementById('novaLiveMsg');
  el.textContent = msg;
  wrap.style.animation = 'none';
  wrap.offsetHeight;
  wrap.style.animation = 'msgIn 5s ease';
  novaFaceTalk('novaFaceLive', 2000, 'idle');
}

function adjustDifficulty(direction) {
  state.difficultyAdjustments++;
  track('difficulty_adjusted', { direction, goal: state.selections.goal });
  const nextEx = state.workout.exercises[state.currentExerciseIndex + 1];
  if (direction === 'harder') {
    setNovaMessage(pickRandom(novaMessages.tooEasy));
    if (nextEx) {
      nextEx.reps = Math.round(nextEx.reps * 1.25);
      nextEx.duration = Math.round(nextEx.duration * 1.15);
      nextEx.cal = Math.round(nextEx.cal * 1.2);
    }
  } else {
    setNovaMessage(pickRandom(novaMessages.tooHard));
    if (nextEx) {
      nextEx.reps = Math.max(5, Math.round(nextEx.reps * 0.75));
      nextEx.duration = Math.max(15, Math.round(nextEx.duration * 0.85));
      nextEx.cal = Math.round(nextEx.cal * 0.8);
    }
  }
}

function takeBreak() {
  if (state.isBreak) return;
  state.isBreak = true;
  track('break_taken', { goal: state.selections.goal });
  setNovaMessage(pickRandom(novaMessages.takeBreak));
  document.getElementById('breakOverlay').classList.add('active');
  let breakTime = 15;
  document.getElementById('breakCountdown').textContent = breakTime;
  document.getElementById('breakBarFill').style.width = '100%';
  if (state.breakTimer) clearInterval(state.breakTimer);
  state.breakTimer = setInterval(() => {
    breakTime--;
    document.getElementById('breakCountdown').textContent = breakTime;
    document.getElementById('breakBarFill').style.width = (breakTime / 15) * 100 + '%';
    if (breakTime <= 0) {
      endBreak();
    }
  }, 1000);
}

function endBreak() {
  state.isBreak = false;
  if (state.breakTimer) clearInterval(state.breakTimer);
  document.getElementById('breakOverlay').classList.remove('active');
  setNovaMessage(pickRandom(novaMessages.breakResume));
}

function skipExercise() {
  const ex = state.workout.exercises[state.currentExerciseIndex];
  state.skippedExercises.push({ ...ex, status: 'skipped' });
  track('exercise_skipped', { name: ex.name, goal: state.selections.goal });
  setNovaMessage(pickRandom(novaMessages.skipExercise));
  if (state.timer) clearInterval(state.timer);
  setTimeout(() => {
    loadExercise(state.currentExerciseIndex + 1);
  }, 600);
}

function confirmExit() {
  if (confirm('Leave this workout? Your progress will be lost.')) {
    if (state.timer) clearInterval(state.timer);
    if (state.activeTimer) clearInterval(state.activeTimer);
    if (state.breakTimer) clearInterval(state.breakTimer);
    goToScreen('welcome');
  }
}

function completeWorkout() {
  if (state.timer) clearInterval(state.timer);
  if (state.activeTimer) clearInterval(state.activeTimer);

  const lastWorkout = localStorage.getItem('kinetic_last_workout');
  const today = new Date().toDateString();
  let streak = 1;
  if (lastWorkout) {
    const lastDate = new Date(lastWorkout);
    const diffDays = Math.floor((new Date(today) - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak = (parseInt(localStorage.getItem('kinetic_streak') || '0') || 0) + 1;
    } else if (diffDays === 0) {
      streak = parseInt(localStorage.getItem('kinetic_streak') || '1') || 1;
    }
  }
  localStorage.setItem('kinetic_streak', streak);
  localStorage.setItem('kinetic_last_workout', today);
  state.streak = streak;

  document.getElementById('compCalories').textContent = state.totalCalories;
  const durStr = state.activeTime >= 60 ? Math.floor(state.activeTime / 60) + 'm' : state.activeTime + 's';
  document.getElementById('compDuration').textContent = durStr;
  document.getElementById('compStreak').textContent = streak;
  document.getElementById('compCompleted').textContent = state.completedExercises.length;

  const summaryItems = [];
  state.workout.exercises.forEach((ex) => {
    const completed = state.completedExercises.find(e => e.name === ex.name);
    const skipped = state.skippedExercises.find(e => e.name === ex.name);
    if (completed) {
      summaryItems.push({ emoji: ex.emoji, name: ex.name, status: 'done' });
    } else if (skipped) {
      summaryItems.push({ emoji: ex.emoji, name: ex.name, status: 'skipped' });
    } else {
      summaryItems.push({ emoji: ex.emoji, name: ex.name, status: 'done' });
    }
  });
  document.getElementById('summaryList').innerHTML = summaryItems.map(item => `
    <div class="summary-item">
      <span class="emoji">${item.emoji}</span>
      <span class="name">${item.name}</span>
      ${item.status === 'done' ? '<span class="check">✅</span>' : '<span class="skip">Skipped</span>'}
    </div>
  `).join('');

  const nextRec = nextWorkoutRecs[state.selections.goal];
  document.getElementById('nextRecoTitle').textContent = nextRec.title;
  document.getElementById('nextRecoDesc').textContent = nextRec.desc;
  document.getElementById('nextRecoTags').innerHTML = nextRec.tags.map(t => `<span class="next-tag">${t}</span>`).join('');

  document.getElementById('reflectionText').textContent = pickRandom(novaMessages.completion);
  const reflBadge = document.getElementById('reflectionAiBadge');
  if (reflBadge) reflBadge.hidden = true;
  setNovaFace('novaFaceReflection', 'thinking');
  resetFeedbackForm();

  track('workout_completed', {
    goal: state.selections.goal,
    mood: state.selections.mood,
    duration: state.workout.duration,
    completed: state.completedExercises.length,
    skipped: state.skippedExercises.length,
    calories: state.totalCalories,
    activeSeconds: state.activeTime,
    difficultyAdjustments: state.difficultyAdjustments,
    streak,
  });

  goToScreen('completion');
  fetchAiReflection(streak);
}

async function fetchAiReflection(streak) {
  const s = state.selections;
  const text = await askNova('reflection', {
    goal: s.goal,
    mood: s.mood,
    completed: state.completedExercises.length,
    skipped: state.skippedExercises.length,
    calories: state.totalCalories,
    activeMinutes: Math.round(state.activeTime / 60),
    difficultyAdjustments: state.difficultyAdjustments,
    streak,
  });
  const el = document.getElementById('reflectionText');
  if (state.screen !== 'completion' || !el) return;
  if (text) {
    el.textContent = text;
    showAiBadge('reflectionAiBadge', true);
    novaFaceTalk('novaFaceReflection', 2500, 'happy');
  } else {
    showAiBadge('reflectionAiBadge', false);
    setNovaFace('novaFaceReflection', 'happy');
  }
}

function restartApp() {
  state.onboardingStep = 1;
  state.selections = { goal: null, mood: null, energy: 50, duration: null };
  state.workout = null;
  state.currentExerciseIndex = 0;
  state.completedExercises = [];
  state.skippedExercises = [];
  state.totalCalories = 0;
  state.activeTime = 0;
  document.querySelectorAll('.choice-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.step-dot').forEach((d, i) => d.classList.toggle('active', i < 1));
  document.querySelectorAll('.onboard-step').forEach((s, i) => s.classList.toggle('active', i === 0));
  document.getElementById('energySlider').value = 50;
  document.getElementById('energyValue').textContent = '50%';
  document.getElementById('energyEmoji').textContent = '🔋';
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('nextBtn').textContent = 'Continue';
  document.getElementById('backBtn').classList.remove('visible');

  state.chatOpen = false;
  const chatPanel = document.getElementById('novaChat');
  if (chatPanel) chatPanel.classList.remove('active');
  const chatLog = document.getElementById('novaChatLog');
  if (chatLog) chatLog.innerHTML = '<div class="chat-msg chat-msg-nova">Hey! Ask me about form, pacing, or how you\'re feeling — I\'m listening. 🎧</div>';
  ['recoAiBadge', 'liveAiBadge', 'reflectionAiBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  ['novaFaceReco', 'novaFaceLive', 'novaFaceReflection', 'novaFaceChat'].forEach(id => {
    setNovaFace(id, 'idle');
  });
  const shareLabel = document.getElementById('shareBtnLabel');
  if (shareLabel) shareLabel.textContent = 'Share Nova with a friend';

  goToScreen('welcome');
}

/* ============================================
   ASK NOVA — live in-workout AI chat
   ============================================ */
function toggleNovaChat() {
  state.chatOpen = !state.chatOpen;
  document.getElementById('novaChat').classList.toggle('active', state.chatOpen);
  if (state.chatOpen) document.getElementById('novaChatInput').focus();
}

async function sendNovaChat() {
  if (state.chatLoading) return;
  const input = document.getElementById('novaChatInput');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';

  const log = document.getElementById('novaChatLog');
  appendChatBubble(log, message, 'user');
  const thinkingEl = appendChatBubble(log, 'Nova is typing...', 'thinking');

  track('chat_message_sent', { goal: state.selections.goal, exercise: currentExerciseName() });

  state.chatLoading = true;
  document.getElementById('novaChatSend').disabled = true;
  setNovaFace('novaFaceChat', 'thinking');
  const reply = await askNova('chat', {
    goal: state.selections.goal,
    mood: state.selections.mood,
    energy: state.selections.energy,
    exerciseName: currentExerciseName(),
    exerciseDesc: currentExerciseDesc(),
  }, message);
  state.chatLoading = false;
  document.getElementById('novaChatSend').disabled = false;

  thinkingEl.remove();
  if (reply) {
    appendChatBubble(log, reply, 'nova');
    showAiBadge('liveAiBadge', true);
    novaFaceTalk('novaFaceChat', 2000, 'idle');
  } else {
    appendChatBubble(log, "I'm having trouble connecting right now — but keep going, you're doing great! Try again in a moment.", 'nova');
    showAiBadge('liveAiBadge', false);
    setNovaFace('novaFaceChat', 'idle');
  }
  log.scrollTop = log.scrollHeight;
}

function appendChatBubble(log, text, kind) {
  const div = document.createElement('div');
  div.className = kind === 'user' ? 'chat-msg chat-msg-user'
    : kind === 'thinking' ? 'chat-msg chat-msg-thinking'
    : 'chat-msg chat-msg-nova';
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function currentExerciseName() {
  const ex = state.workout && state.workout.exercises[state.currentExerciseIndex];
  return ex ? ex.name : null;
}

function currentExerciseDesc() {
  const ex = state.workout && state.workout.exercises[state.currentExerciseIndex];
  return ex ? ex.desc : null;
}

/* ============================================
   FEEDBACK (traction / value signal)
   ============================================ */
function setRating(val) {
  state.feedbackRating = val;
  document.querySelectorAll('#starRating .star').forEach(s => {
    s.classList.toggle('filled', parseInt(s.dataset.val, 10) <= val);
  });
}

function resetFeedbackForm() {
  state.feedbackRating = 0;
  document.querySelectorAll('#starRating .star').forEach(s => s.classList.remove('filled'));
  const comment = document.getElementById('feedbackComment');
  if (comment) comment.value = '';
  const thanks = document.getElementById('feedbackThanks');
  if (thanks) thanks.hidden = true;
  const card = document.getElementById('feedbackCard');
  if (card) card.style.display = '';
  const submitBtn = document.getElementById('submitFeedbackBtn');
  if (submitBtn) submitBtn.disabled = false;

  const waitlistThanks = document.getElementById('waitlistThanks');
  if (waitlistThanks) waitlistThanks.hidden = true;
  const waitlistEmail = document.getElementById('waitlistEmail');
  if (waitlistEmail) waitlistEmail.value = '';
}

function submitFeedback() {
  if (state.feedbackRating === 0) {
    const stars = document.getElementById('starRating');
    stars.classList.add('shake');
    setTimeout(() => stars.classList.remove('shake'), 500);
    return;
  }
  const comment = document.getElementById('feedbackComment').value.trim();
  track('feedback_submitted', {
    rating: state.feedbackRating,
    comment: comment.slice(0, 500),
    goal: state.selections.goal,
    mood: state.selections.mood,
  });
  document.getElementById('feedbackThanks').hidden = false;
  document.getElementById('submitFeedbackBtn').disabled = true;
}

/* ============================================
   WAITLIST (demand signal)
   ============================================ */
function joinWaitlist() {
  const emailEl = document.getElementById('waitlistEmail');
  const email = emailEl.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    emailEl.classList.add('input-error', 'shake');
    setTimeout(() => emailEl.classList.remove('shake'), 500);
    emailEl.focus();
    return;
  }
  emailEl.classList.remove('input-error');
  track('waitlist_joined', { email, goal: state.selections.goal });
  document.getElementById('waitlistThanks').hidden = false;
  document.getElementById('waitlistBtn').disabled = true;
  emailEl.disabled = true;
}

/* ============================================
   SHARE (virality / GTM lever)
   ============================================ */
async function shareApp() {
  const shareData = {
    title: 'Kinetic AI Coach',
    text: "I just finished a workout with Nova, an AI fitness coach that actually talks back mid-set. Try it:",
    url: window.location.origin + window.location.pathname,
  };
  const label = document.getElementById('shareBtnLabel');
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      track('share_clicked', { method: 'native' });
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      track('share_clicked', { method: 'clipboard' });
      label.textContent = 'Link copied!';
      setTimeout(() => { label.textContent = 'Share Nova with a friend'; }, 2000);
    }
  } catch (e) {
    /* user cancelled the native share sheet - not an error */
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateEnergy(50);
  document.getElementById('nextBtn').disabled = true;
  track('app_opened', { ref: document.referrer || 'direct' });
});
