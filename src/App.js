import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const defaultGoals = {
  calories: 2200,
  protein: 160,
  carbs: 250,
  fat: 70,
  water: 2500,
  steps: 10000
};

const defaultDay = {
  workouts: [],
  meals: [],
  cardio: [],
  water: 0,
  steps: 0,
  muscleGroup: ""
};

const WALKING_CALORIES_PER_STEP = 0.04;

function safeJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function normaliseDay(day = {}) {
  return {
    ...defaultDay,
    ...day,
    workouts: Array.isArray(day.workouts) ? day.workouts : [],
    meals: Array.isArray(day.meals) ? day.meals : [],
    cardio: Array.isArray(day.cardio) ? day.cardio : []
  };
}

function numberValue(value) {
  return Number(value) || 0;
}

function getWorkoutSets(workout) {
  if (Array.isArray(workout.setDetails) && workout.setDetails.length > 0) {
    return workout.setDetails.map(set => ({
      reps: numberValue(set.reps),
      weight: numberValue(set.weight)
    }));
  }

  const setCount = Math.max(numberValue(workout.sets), 1);
  return Array.from({ length: setCount }, () => ({
    reps: numberValue(workout.reps),
    weight: numberValue(workout.weight)
  }));
}

function getWorkoutSummary(workout) {
  const sets = getWorkoutSets(workout);
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
  const topWeight = sets.reduce((max, set) => Math.max(max, set.weight), 0);
  const volume = sets.reduce(
    (sum, set) => sum + set.reps * set.weight,
    0
  );

  return {
    setCount: sets.length,
    totalReps,
    topWeight,
    volume
  };
}

function getWeekKey(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatDate(dateText) {
  return new Date(`${dateText}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

const FOOD_LIBRARY = [
  {
    name: "egg",
    aliases: ["egg", "eggs"],
    unitLabel: "egg",
    defaultAmount: 1,
    nutrition: { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 }
  },
  {
    name: "toast",
    aliases: ["toast", "slice of toast", "slices of toast", "bread", "slice of bread", "slices of bread"],
    unitLabel: "slice",
    defaultAmount: 1,
    nutrition: { calories: 80, protein: 3, carbs: 15, fat: 1 }
  },
  {
    name: "banana",
    aliases: ["banana", "bananas"],
    unitLabel: "banana",
    defaultAmount: 1,
    nutrition: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 }
  },
  {
    name: "apple",
    aliases: ["apple", "apples"],
    unitLabel: "apple",
    defaultAmount: 1,
    nutrition: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 }
  },
  {
    name: "oats",
    aliases: ["oats", "porridge oats", "oatmeal"],
    unitLabel: "serving",
    defaultAmount: 1,
    nutrition: { calories: 150, protein: 5, carbs: 27, fat: 3 }
  },
  {
    name: "rice",
    aliases: ["rice", "white rice", "brown rice"],
    unitLabel: "cup",
    defaultAmount: 1,
    nutrition: { calories: 205, protein: 4.3, carbs: 45, fat: 0.4 }
  },
  {
    name: "chicken breast",
    aliases: ["chicken", "chicken breast", "grilled chicken", "chicken breasts"],
    unitLabel: "portion",
    defaultAmount: 1,
    nutrition: { calories: 165, protein: 31, carbs: 0, fat: 3.6 }
  },
  {
    name: "salmon",
    aliases: ["salmon"],
    unitLabel: "portion",
    defaultAmount: 1,
    nutrition: { calories: 208, protein: 20, carbs: 0, fat: 13 }
  },
  {
    name: "beef mince",
    aliases: ["beef", "beef mince", "ground beef", "mince"],
    unitLabel: "portion",
    defaultAmount: 1,
    nutrition: { calories: 250, protein: 26, carbs: 0, fat: 17 }
  },
  {
    name: "greek yogurt",
    aliases: ["greek yogurt", "greek yoghurt", "yogurt", "yoghurt"],
    unitLabel: "pot",
    defaultAmount: 1,
    nutrition: { calories: 130, protein: 15, carbs: 6, fat: 4 }
  },
  {
    name: "milk",
    aliases: ["milk", "whole milk", "semi skimmed milk", "skimmed milk"],
    unitLabel: "cup",
    defaultAmount: 1,
    nutrition: { calories: 122, protein: 8, carbs: 12, fat: 5 }
  },
  {
    name: "protein shake",
    aliases: ["protein shake", "protein shake scoop", "protein powder", "whey protein"],
    unitLabel: "scoop",
    defaultAmount: 1,
    nutrition: { calories: 120, protein: 24, carbs: 3, fat: 1.5 }
  },
  {
    name: "peanut butter",
    aliases: ["peanut butter"],
    unitLabel: "tablespoon",
    defaultAmount: 1,
    nutrition: { calories: 95, protein: 4, carbs: 3.5, fat: 8 }
  },
  {
    name: "avocado",
    aliases: ["avocado"],
    unitLabel: "half",
    defaultAmount: 1,
    nutrition: { calories: 120, protein: 1.5, carbs: 6, fat: 11 }
  },
  {
    name: "potato",
    aliases: ["potato", "potatoes", "baked potato"],
    unitLabel: "potato",
    defaultAmount: 1,
    nutrition: { calories: 160, protein: 4, carbs: 37, fat: 0.2 }
  },
  {
    name: "pasta",
    aliases: ["pasta"],
    unitLabel: "cup",
    defaultAmount: 1,
    nutrition: { calories: 220, protein: 8, carbs: 43, fat: 1.3 }
  },
  {
    name: "cheese",
    aliases: ["cheese", "cheddar", "mozzarella"],
    unitLabel: "slice",
    defaultAmount: 1,
    nutrition: { calories: 113, protein: 7, carbs: 1, fat: 9 }
  },
  {
    name: "coffee with milk",
    aliases: ["coffee", "coffee with milk", "latte", "cappuccino"],
    unitLabel: "cup",
    defaultAmount: 1,
    nutrition: { calories: 60, protein: 3, carbs: 5, fat: 3 }
  }
];

const NUMBER_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

function roundMacro(value) {
  return Math.round(value * 10) / 10;
}

function parseAmount(fragment, food) {
  const numericMatch = fragment.match(/(\d+(?:\.\d+)?)/);
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  const word = fragment.split(" ").find(part => NUMBER_WORDS[part]);
  if (word) {
    return NUMBER_WORDS[word];
  }

  return food.defaultAmount;
}

function estimateMealLocally(description) {
  const cleaned = description
    .toLowerCase()
    .replace(/\bwith\b/g, ",")
    .replace(/\band\b/g, ",")
    .replace(/\+/g, ",");

  const parts = cleaned
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);

  const matchedFoods = [];
  const assumptions = [];

  parts.forEach(part => {
    const food = FOOD_LIBRARY.find(item =>
      item.aliases.some(alias => part.includes(alias))
    );

    if (!food) {
      assumptions.push(`Couldn't match "${part}", so it was left out.`);
      return;
    }

    const amount = parseAmount(part, food);
    matchedFoods.push({ food, amount });

    if (!part.match(/(\d+(?:\.\d+)?)|\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/)) {
      assumptions.push(`Assumed 1 ${food.unitLabel} of ${food.name}.`);
    }
  });

  if (matchedFoods.length === 0) {
    throw new Error("I couldn't match any common foods in that meal yet.");
  }

  const totals = matchedFoods.reduce(
    (sum, entry) => ({
      calories: sum.calories + entry.food.nutrition.calories * entry.amount,
      protein: sum.protein + entry.food.nutrition.protein * entry.amount,
      carbs: sum.carbs + entry.food.nutrition.carbs * entry.amount,
      fat: sum.fat + entry.food.nutrition.fat * entry.amount
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    name: matchedFoods.map(entry => `${entry.amount} ${entry.food.name}`).join(", "),
    calories: Math.round(totals.calories),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat),
    assumptions
  };
}

function ProgressBar({ label, value, target, unit }) {
  const percent = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const progressRatio = target > 0 ? value / target : 0;
  const isOverTarget = progressRatio > 1;
  const cappedRatio = Math.min(progressRatio, 1);
  const hue = Math.round(cappedRatio * 120);
  const overRatio = Math.min(progressRatio - 1, 1);
  const startColor = isOverTarget
    ? `hsl(0 72% ${Math.max(58 - overRatio * 10, 48)}%)`
    : `hsl(${Math.max(hue - 18, 0)} 70% 68%)`;
  const endColor = isOverTarget
    ? `hsl(0 68% ${Math.max(48 - overRatio * 12, 34)}%)`
    : `hsl(${hue} 62% 56%)`;

  return (
    <div className="progress-line">
      <div className="progress-label">
        <span>{label}</span>
        <strong>
          {Math.round(value)}
          {unit} / {target}
          {unit}
        </strong>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${startColor}, ${endColor})`
          }}
        />
      </div>
    </div>
  );
}

function getPastelMetricColor(value, target, { penalizeOverage = false } = {}) {
  if (!target) return "#fbfcfe";

  const progressRatio = value / target;
  if (penalizeOverage && progressRatio > 1) {
    const overRatio = Math.min(progressRatio - 1, 1);
    return `hsl(0 68% ${Math.max(46 - overRatio * 12, 32)}%)`;
  }

  const cappedRatio = Math.min(progressRatio, 1);
  const hue = Math.round(cappedRatio * 120);
  return `hsl(${hue} 58% 74%)`;
}

function ProgressionChart({ points }) {
  if (points.length === 0) {
    return (
      <p className="empty-state">
        Log this exercise on different dates to see a weight trend here.
      </p>
    );
  }

  const chartWidth = Math.max(340, points.length * 96);
  const chartHeight = 220;
  const padding = 32;
  const maxWeight = Math.max(...points.map(point => point.weight), 1);
  const minWeight = Math.min(...points.map(point => point.weight), 0);
  const range = Math.max(maxWeight - minWeight, 1);
  const plotWidth = chartWidth - padding * 2;
  const plotHeight = 128;

  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : padding + (plotWidth / (points.length - 1)) * index;
    const y = padding + ((maxWeight - point.weight) / range) * plotHeight;
    return { ...point, x, y };
  });

  const line = coordinates.map(point => `${point.x},${point.y}`).join(" ");

  return (
    <div className="chart-scroll" aria-label="Exercise progression line chart">
      <svg
        className="line-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ width: chartWidth }}
        role="img"
      >
        <line
          className="chart-axis"
          x1={padding}
          y1={padding + plotHeight}
          x2={chartWidth - padding}
          y2={padding + plotHeight}
        />
        <polyline className="chart-line" points={line} />
        {coordinates.map(point => (
          <g key={point.weekKey}>
            <circle className="chart-point" cx={point.x} cy={point.y} r="5" />
            <text className="chart-value" x={point.x} y={point.y - 12}>
              {point.weight}kg
            </text>
            <text className="chart-label" x={point.x} y={padding + plotHeight + 24}>
              {point.label}
            </text>
            <text className="chart-date" x={point.x} y={padding + plotHeight + 42}>
              {point.dateLabel}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function App() {
  const [data, setData] = useState(() => safeJson("gymData", {}));
  const [presets, setPresets] = useState(() => safeJson("presets", {}));
  const [savedFoods, setSavedFoods] = useState(() => safeJson("savedFoods", []));
  const [goals, setGoals] = useState(() => ({
    ...defaultGoals,
    ...safeJson("dailyGoals", {})
  }));
  const [syncState, setSyncState] = useState("Checking backup...");
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [page, setPage] = useState("dashboard");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [exerciseInputs, setExerciseInputs] = useState({});
  const [expandedWorkoutId, setExpandedWorkoutId] = useState(null);

  const [mealForm, setMealForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: ""
  });

  const [cardioForm, setCardioForm] = useState({
    activity: "",
    minutes: "",
    calories: ""
  });
  const [aiFoodPrompt, setAiFoodPrompt] = useState("");
  const [aiEstimate, setAiEstimate] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [workoutForm, setWorkoutForm] = useState({
    exercise: "",
    setCount: "1",
    setDetails: [{ reps: "", weight: "" }]
  });
  const [progressExercise, setProgressExercise] = useState("");
  const hasLoadedCloudRef = useRef(false);
  const skipCloudSaveRef = useRef(false);
  const initialSnapshotRef = useRef({
    data,
    presets,
    savedFoods,
    goals
  });

  function persistLocalSnapshot(
    nextData,
    nextPresets,
    nextSavedFoods,
    nextGoals,
    updatedAt
  ) {
    localStorage.setItem("gymData", JSON.stringify(nextData));
    localStorage.setItem("presets", JSON.stringify(nextPresets));
    localStorage.setItem("savedFoods", JSON.stringify(nextSavedFoods));
    localStorage.setItem("dailyGoals", JSON.stringify(nextGoals));
    localStorage.setItem("fitnessUpdatedAt", String(updatedAt));
  }

  useEffect(() => {
    let isActive = true;

    async function loadCloudBackup() {
      try {
        const remoteDoc = await getDoc(doc(db, "fitnessBackups", "primary"));
        if (!isActive) return;

        const localUpdatedAt = numberValue(
          localStorage.getItem("fitnessUpdatedAt")
        );

        if (remoteDoc.exists()) {
          const remoteData = remoteDoc.data();
          const remoteUpdatedAt = numberValue(remoteData.updatedAt);

          if (remoteUpdatedAt > localUpdatedAt) {
            const remoteGoals = {
              ...defaultGoals,
              ...(remoteData.goals || {})
            };

            skipCloudSaveRef.current = true;
            persistLocalSnapshot(
              remoteData.data || {},
              remoteData.presets || {},
              remoteData.savedFoods || [],
              remoteGoals,
              remoteUpdatedAt
            );
            setData(remoteData.data || {});
            setPresets(remoteData.presets || {});
            setSavedFoods(
              Array.isArray(remoteData.savedFoods) ? remoteData.savedFoods : []
            );
            setGoals(remoteGoals);
            setSyncState("Cloud backup restored");
            hasLoadedCloudRef.current = true;
            return;
          }
        }

        if (localUpdatedAt > 0) {
          await setDoc(
            doc(db, "fitnessBackups", "primary"),
            {
              data: initialSnapshotRef.current.data,
              presets: initialSnapshotRef.current.presets,
              savedFoods: initialSnapshotRef.current.savedFoods,
              goals: initialSnapshotRef.current.goals,
              updatedAt: localUpdatedAt
            },
            { merge: true }
          );
        }

        if (isActive) {
          setSyncState("Cloud backup on");
        }
      } catch {
        if (isActive) {
          setSyncState("Saved on this browser only");
        }
      } finally {
        hasLoadedCloudRef.current = true;
      }
    }

    loadCloudBackup();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedCloudRef.current) return;

    if (skipCloudSaveRef.current) {
      skipCloudSaveRef.current = false;
      return;
    }

    const updatedAt = Date.now();
    persistLocalSnapshot(data, presets, savedFoods, goals, updatedAt);

    let isActive = true;

    async function saveCloudBackup() {
      try {
        setSyncState("Saving backup...");
        await setDoc(
          doc(db, "fitnessBackups", "primary"),
          {
            data,
            presets,
            savedFoods,
            goals,
            updatedAt
          },
          { merge: true }
        );
        if (isActive) {
          setSyncState("Cloud backup on");
        }
      } catch {
        if (isActive) {
          setSyncState("Saved on this browser only");
        }
      }
    }

    saveCloudBackup();

    return () => {
      isActive = false;
    };
  }, [data, presets, savedFoods, goals]);

  const today = normaliseDay(data[selectedDate]);

  const nutritionTotals = useMemo(
    () =>
      today.meals.reduce(
        (totals, meal) => ({
          calories: totals.calories + numberValue(meal.calories),
          protein: totals.protein + numberValue(meal.protein),
          carbs: totals.carbs + numberValue(meal.carbs),
          fat: totals.fat + numberValue(meal.fat)
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [today.meals]
  );

  const cardioSessionTotals = useMemo(
    () =>
      today.cardio.reduce(
        (totals, entry) => ({
          minutes: totals.minutes + numberValue(entry.minutes),
          calories: totals.calories + numberValue(entry.calories)
        }),
        { minutes: 0, calories: 0 }
      ),
    [today.cardio]
  );

  const walkingCalories = Math.round(today.steps * WALKING_CALORIES_PER_STEP);
  const totalCardioCalories = cardioSessionTotals.calories + walkingCalories;

  const workoutVolume = today.workouts.reduce(
    (sum, workout) => sum + getWorkoutSummary(workout).volume,
    0
  );

  const exerciseOptions = useMemo(() => {
    const presetExercises = Object.values(presets).flat();
    const loggedExercises = Object.values(data).flatMap(day =>
      normaliseDay(day).workouts.map(workout => workout.exercise)
    );
    return [...new Set([...presetExercises, ...loggedExercises].filter(Boolean))];
  }, [data, presets]);

  const selectedProgressExercise = progressExercise || exerciseOptions[0] || "";

  const progressionPoints = useMemo(() => {
    if (!selectedProgressExercise) return [];

    const weeklyBest = {};
    Object.entries(data).forEach(([date, dayData]) => {
      const day = normaliseDay(dayData);
      day.workouts
        .filter(workout => workout.exercise === selectedProgressExercise)
        .forEach(workout => {
          const summary = getWorkoutSummary(workout);
          const weekKey = getWeekKey(date);
          const current = weeklyBest[weekKey];
          if (!current || summary.topWeight > current.weight) {
            weeklyBest[weekKey] = {
              weekKey,
              date,
              weight: summary.topWeight
            };
          }
        });
    });

    return Object.values(weeklyBest)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point, index) => ({
        ...point,
        label: `Week ${index + 1}`,
        dateLabel: formatDate(point.date)
      }));
  }, [data, selectedProgressExercise]);

  function updateDay(updater) {
    setData(prev => {
      const currentDay = normaliseDay(prev[selectedDate]);
      return {
        ...prev,
        [selectedDate]: updater(currentDay)
      };
    });
  }

  function handleMealChange(event) {
    setMealForm({
      ...mealForm,
      [event.target.name]: event.target.value
    });
  }

  function handleCardioChange(event) {
    setCardioForm({
      ...cardioForm,
      [event.target.name]: event.target.value
    });
  }

  function applyAiEstimateToMeal() {
    if (!aiEstimate) return;

    setMealForm({
      name: aiEstimate.name || "Estimated meal",
      calories: String(numberValue(aiEstimate.calories)),
      protein: String(numberValue(aiEstimate.protein)),
      carbs: String(numberValue(aiEstimate.carbs)),
      fat: String(numberValue(aiEstimate.fat))
    });
    setPage("nutrition");
  }

  function applySavedFoodToMeal(savedFood) {
    setMealForm({
      name: savedFood.name || "Saved food",
      calories: String(numberValue(savedFood.calories)),
      protein: String(numberValue(savedFood.protein)),
      carbs: String(numberValue(savedFood.carbs)),
      fat: String(numberValue(savedFood.fat))
    });
    setPage("nutrition");
  }

  async function estimateMacros(event) {
    event.preventDefault();
    const description = aiFoodPrompt.trim();
    if (!description) return;

    setAiLoading(true);
    setAiError("");

    try {
      const result = estimateMealLocally(description);
      setAiEstimate(result);
    } catch (error) {
      setAiEstimate(null);
      setAiError(error.message || "Could not estimate that meal.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleWorkoutChange(event) {
    setWorkoutForm({
      ...workoutForm,
      [event.target.name]: event.target.value
    });
  }

  function changeSetCount(event) {
    const setCount = Math.max(1, numberValue(event.target.value));
    setWorkoutForm(prev => {
      const nextDetails = Array.from({ length: setCount }, (_, index) => (
        prev.setDetails[index] || { reps: "", weight: "" }
      ));

      return {
        ...prev,
        setCount: event.target.value,
        setDetails: nextDetails
      };
    });
  }

  function updateWorkoutSet(index, field, value) {
    setWorkoutForm(prev => ({
      ...prev,
      setDetails: prev.setDetails.map((set, setIndex) =>
        setIndex === index ? { ...set, [field]: value } : set
      )
    }));
  }

  function addWater(amount) {
    updateDay(day => ({
      ...day,
      water: Math.max(0, day.water + amount),
      muscleGroup
    }));
  }

  function addSteps(amount) {
    updateDay(day => ({
      ...day,
      steps: Math.max(0, numberValue(day.steps) + amount)
    }));
  }

  function setSteps(value) {
    updateDay(day => ({
      ...day,
      steps: Math.max(0, numberValue(value))
    }));
  }

  function saveCardio(event) {
    event.preventDefault();
    if (!cardioForm.activity.trim() && !cardioForm.minutes) return;

    const entry = {
      id: crypto.randomUUID(),
      activity: cardioForm.activity.trim() || "Cardio",
      minutes: numberValue(cardioForm.minutes),
      calories: numberValue(cardioForm.calories)
    };

    updateDay(day => ({
      ...day,
      cardio: [...day.cardio, entry]
    }));

    setCardioForm({ activity: "", minutes: "", calories: "" });
  }

  function deleteCardio(id) {
    updateDay(day => ({
      ...day,
      cardio: day.cardio.filter((entry, index) => (entry.id || index) !== id)
    }));
  }

  function saveMeal(event) {
    event.preventDefault();
    if (!mealForm.name.trim() && !mealForm.calories) return;

    const meal = {
      id: crypto.randomUUID(),
      name: mealForm.name.trim() || "Meal",
      calories: numberValue(mealForm.calories),
      protein: numberValue(mealForm.protein),
      carbs: numberValue(mealForm.carbs),
      fat: numberValue(mealForm.fat)
    };

    updateDay(day => ({
      ...day,
      meals: [...day.meals, meal]
    }));

    setMealForm({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  }

  function saveFoodPreset() {
    if (!mealForm.name.trim() && !mealForm.calories) return;

    const savedFood = {
      id: crypto.randomUUID(),
      name: mealForm.name.trim() || "Saved food",
      calories: numberValue(mealForm.calories),
      protein: numberValue(mealForm.protein),
      carbs: numberValue(mealForm.carbs),
      fat: numberValue(mealForm.fat)
    };

    setSavedFoods(prev => {
      const withoutSameName = prev.filter(
        entry => entry.name.toLowerCase() !== savedFood.name.toLowerCase()
      );
      return [savedFood, ...withoutSameName];
    });
  }

  function addSavedFoodToDay(savedFood) {
    const meal = {
      id: crypto.randomUUID(),
      name: savedFood.name,
      calories: numberValue(savedFood.calories),
      protein: numberValue(savedFood.protein),
      carbs: numberValue(savedFood.carbs),
      fat: numberValue(savedFood.fat)
    };

    updateDay(day => ({
      ...day,
      meals: [...day.meals, meal]
    }));
  }

  function deleteMeal(id) {
    updateDay(day => ({
      ...day,
      meals: day.meals.filter((meal, index) => (meal.id || index) !== id)
    }));
  }

  function deleteSavedFood(id) {
    setSavedFoods(prev => prev.filter((food, index) => (food.id || index) !== id));
  }

  function saveWorkout(event) {
    event.preventDefault();
    if (!workoutForm.exercise.trim()) return;

    const workout = {
      id: crypto.randomUUID(),
      exercise: workoutForm.exercise.trim(),
      sets: workoutForm.setDetails.length,
      setDetails: workoutForm.setDetails.map(set => ({
        reps: numberValue(set.reps),
        weight: numberValue(set.weight)
      })),
      muscleGroup
    };

    updateDay(day => ({
      ...day,
      muscleGroup,
      workouts: [...day.workouts, workout]
    }));

    setWorkoutForm({
      exercise: "",
      setCount: "1",
      setDetails: [{ reps: "", weight: "" }]
    });
    setPage("dashboard");
  }

  function deleteWorkout(id) {
    updateDay(day => ({
      ...day,
      workouts: day.workouts.filter(
        (workout, index) => (workout.id || index) !== id
      )
    }));
    setExpandedWorkoutId(prev => (prev === id ? null : prev));
  }

  function addMuscleGroup(event) {
    event.preventDefault();
    const group = newGroup.trim();
    if (!group) return;

    setPresets(prev => ({
      ...prev,
      [group]: prev[group] || []
    }));
    setNewGroup("");
    setMuscleGroup(group);
  }

  function addPresetExercise(group) {
    const exercise = (exerciseInputs[group] || "").trim();
    if (!exercise) return;

    setPresets(prev => ({
      ...prev,
      [group]: [...(prev[group] || []), exercise]
    }));
    setExerciseInputs(prev => ({ ...prev, [group]: "" }));
  }

  function deletePresetExercise(group, exerciseIndex) {
    setPresets(prev => ({
      ...prev,
      [group]: prev[group].filter((_, index) => index !== exerciseIndex)
    }));
  }

  function deletePresetGroup(group) {
    setPresets(prev => {
      const next = { ...prev };
      delete next[group];
      return next;
    });

    if (muscleGroup === group) setMuscleGroup("");
  }

  const caloriesLeft = Math.max(goals.calories - nutritionTotals.calories, 0);
  const caloriesMetricColor = getPastelMetricColor(
    nutritionTotals.calories,
    goals.calories,
    { penalizeOverage: true }
  );
  const waterMetricColor = getPastelMetricColor(today.water, goals.water);
  const stepsMetricColor = getPastelMetricColor(today.steps, goals.steps);
  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Daily Tracker</p>
          <h1>Fitness dashboard</h1>
        </div>
        <input
          aria-label="Selected date"
          className="date-input"
          type="date"
          value={selectedDate}
          onChange={event => setSelectedDate(event.target.value)}
        />
      </header>

      <nav className="tab-bar" aria-label="Main sections">
        {[
          ["dashboard", "Home"],
          ["nutrition", "Food"],
          ["cardio", "Cardio"],
          ["workout", "Lift"],
          ["presets", "Plans"],
          ["settings", "Goals"]
        ].map(([key, label]) => (
          <button
            key={key}
            className={page === key ? "tab is-active" : "tab"}
            onClick={() => setPage(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {page === "dashboard" && (
        <section className="stack">
          <div className="summary-grid">
            <article className="metric-card">
              <span>Calories left</span>
              <strong style={{ color: caloriesMetricColor }}>{caloriesLeft}</strong>
              <small>{nutritionTotals.calories} eaten</small>
            </article>
            <article className="metric-card">
              <span>Water</span>
              <strong style={{ color: waterMetricColor }}>{today.water}ml</strong>
              <small>{Math.round((today.water / goals.water) * 100) || 0}% goal</small>
            </article>
            <article className="metric-card">
              <span>Workouts</span>
              <strong>{today.workouts.length}</strong>
              <small>{Math.round(workoutVolume)}kg volume</small>
            </article>
            <article className="metric-card">
              <span>Steps</span>
              <strong style={{ color: stepsMetricColor }}>{today.steps}</strong>
              <small>{Math.round((today.steps / goals.steps) * 100) || 0}% goal</small>
            </article>
            <article className="metric-card">
              <span>Cardio</span>
              <strong>{cardioSessionTotals.minutes} min</strong>
              <small>{totalCardioCalories} cal incl. walking</small>
            </article>
          </div>

          <section className="panel">
            <div className="section-heading">
              <h2>Today</h2>
              <button className="ghost-button" onClick={() => setPage("nutrition")}>
                + Meal
              </button>
            </div>
            <ProgressBar
              label="Calories"
              value={nutritionTotals.calories}
              target={goals.calories}
              unit=""
            />
            <ProgressBar
              label="Protein"
              value={nutritionTotals.protein}
              target={goals.protein}
              unit="g"
            />
            <ProgressBar
              label="Water"
              value={today.water}
              target={goals.water}
              unit="ml"
            />
            <ProgressBar
              label="Steps"
              value={today.steps}
              target={goals.steps}
              unit=""
            />
          </section>

          <section className="quick-actions">
            <button onClick={() => addWater(250)}>+ 250ml</button>
            <button onClick={() => addWater(500)}>+ 500ml</button>
            <button onClick={() => addWater(-250)}>- 250ml</button>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Steps</h2>
              <span>Daily walking total</span>
            </div>
            <div className="inline-form">
              <input
                aria-label="Steps walked today"
                inputMode="numeric"
                type="number"
                value={today.steps}
                onChange={event => setSteps(event.target.value)}
              />
              <button className="primary-button" onClick={() => addSteps(1000)}>
                +1000
              </button>
            </div>
            <section className="quick-actions split-actions">
              <button onClick={() => addSteps(500)}>+ 500</button>
              <button onClick={() => addSteps(2000)}>+ 2000</button>
              <button onClick={() => addSteps(-500)}>- 500</button>
            </section>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Exercise progress</h2>
              <span>Top weight by week</span>
            </div>
            <select
              value={selectedProgressExercise}
              onChange={event => setProgressExercise(event.target.value)}
            >
              {exerciseOptions.length === 0 ? (
                <option value="">Add preset exercises first</option>
              ) : (
                exerciseOptions.map(exercise => (
                  <option key={exercise} value={exercise}>
                    {exercise}
                  </option>
                ))
              )}
            </select>
            <ProgressionChart points={progressionPoints} />
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Workout log</h2>
              <button className="ghost-button" onClick={() => setPage("workout")}>
                + Lift
              </button>
            </div>
            {today.workouts.length === 0 ? (
              <p className="empty-state">No workouts saved for this date yet.</p>
            ) : (
              <div className="item-list">
                {today.workouts.map((workout, index) => (
                  <article className="list-item workout-log-item" key={workout.id || index}>
                    <button
                      className="workout-log-button"
                      type="button"
                      onClick={() =>
                        setExpandedWorkoutId(current =>
                          current === (workout.id || index) ? null : workout.id || index
                        )
                      }
                    >
                      <div>
                        <strong>{workout.exercise}</strong>
                        {(() => {
                          const summary = getWorkoutSummary(workout);
                          const isExpanded = expandedWorkoutId === (workout.id || index);
                          return (
                            <>
                              <span>
                                {summary.setCount} sets, {summary.totalReps} reps,
                                top {summary.topWeight}kg
                              </span>
                              <span className="workout-log-toggle">
                                {isExpanded ? "Hide set details" : "Show set details"}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </button>
                    <button
                      aria-label={`Delete ${workout.exercise}`}
                      className="icon-button"
                      type="button"
                      onClick={() => deleteWorkout(workout.id || index)}
                    >
                      x
                    </button>
                    {expandedWorkoutId === (workout.id || index) ? (
                      <div className="workout-set-breakdown">
                        {getWorkoutSets(workout).map((set, setIndex) => (
                          <div className="workout-set-row" key={`${workout.id || index}-${setIndex}`}>
                            <span>Set {setIndex + 1}</span>
                            <strong>
                              {set.reps} reps
                              <em>{set.weight}kg</em>
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {page === "cardio" && (
        <section className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2>Cardio sessions</h2>
              <span>Use steps for normal walking</span>
            </div>
            <p className="helper-text">
              Log deliberate sessions here like rowing, stair climber, runs, bike, or
              treadmill. Your steps already add an estimated walking calorie burn below.
            </p>
            <form className="form-grid" onSubmit={saveCardio}>
              <input
                name="activity"
                placeholder="Activity, e.g. row, stair climber, bike"
                value={cardioForm.activity}
                onChange={handleCardioChange}
              />
              <input
                name="minutes"
                inputMode="numeric"
                type="number"
                placeholder="Minutes"
                value={cardioForm.minutes}
                onChange={handleCardioChange}
              />
              <input
                name="calories"
                inputMode="numeric"
                type="number"
                placeholder="Calories burned (optional)"
                value={cardioForm.calories}
                onChange={handleCardioChange}
              />
              <button className="primary-button" type="submit">
                Save session
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Cardio today</h2>
              <span>
                {cardioSessionTotals.minutes} min, {totalCardioCalories} cal est
              </span>
            </div>
            <div className="split-stat">
              <div>
                <span>From cardio sessions</span>
                <strong>{cardioSessionTotals.calories} cal</strong>
              </div>
              <div>
                <span>From {today.steps} steps</span>
                <strong>{walkingCalories} cal est</strong>
              </div>
            </div>
            {today.cardio.length === 0 ? (
              <p className="empty-state">
                No cardio sessions logged yet. Walking calories are still estimated from
                your steps.
              </p>
            ) : (
              <div className="item-list">
                {today.cardio.map((entry, index) => (
                  <article className="list-item" key={entry.id || index}>
                    <div>
                      <strong>{entry.activity}</strong>
                      <span>
                        {entry.minutes} min
                        {entry.calories ? `, ${entry.calories} cal burned` : ""}
                      </span>
                    </div>
                    <button
                      aria-label={`Delete ${entry.activity}`}
                      className="icon-button"
                      onClick={() => deleteCardio(entry.id || index)}
                    >
                      x
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {page === "nutrition" && (
        <section className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2>Saved foods</h2>
              <span>{savedFoods.length} ready to add</span>
            </div>
            {savedFoods.length === 0 ? (
              <p className="empty-state">
                Save foods you eat often so you can add them in one tap.
              </p>
            ) : (
              <div className="item-list">
                {savedFoods.map((food, index) => (
                  <article className="list-item" key={food.id || index}>
                    <div>
                      <strong>{food.name}</strong>
                      <span>
                        {food.calories} cal, P {food.protein}g, C {food.carbs}g, F{" "}
                        {food.fat}g
                      </span>
                    </div>
                    <div className="list-actions">
                      <button
                        className="ghost-button compact-button"
                        type="button"
                        onClick={() => applySavedFoodToMeal(food)}
                      >
                        Fill
                      </button>
                      <button
                        className="primary-button compact-button"
                        type="button"
                        onClick={() => addSavedFoodToDay(food)}
                      >
                        Add
                      </button>
                      <button
                        aria-label={`Delete ${food.name}`}
                        className="icon-button"
                        type="button"
                        onClick={() => deleteSavedFood(food.id || index)}
                      >
                        x
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>AI estimate</h2>
              <span>Fast built-in food estimate</span>
            </div>
            <form className="form-grid" onSubmit={estimateMacros}>
              <textarea
                className="app-textarea"
                placeholder="Example: 3 eggs, 2 slices of toast, and a coffee with milk"
                value={aiFoodPrompt}
                onChange={event => setAiFoodPrompt(event.target.value)}
                rows="4"
              />
              <button className="primary-button" type="submit" disabled={aiLoading}>
                {aiLoading ? "Estimating..." : "Estimate meal"}
              </button>
            </form>
            {aiError ? <p className="error-text">{aiError}</p> : null}
            {aiEstimate ? (
              <div className="ai-result">
                <div className="ai-result-header">
                  <strong>{aiEstimate.name}</strong>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={applyAiEstimateToMeal}
                  >
                    Use in meal form
                  </button>
                </div>
                <div className="ai-macro-grid">
                  <div>
                    <span>Calories</span>
                    <strong>{aiEstimate.calories}</strong>
                  </div>
                  <div>
                    <span>Protein</span>
                    <strong>{aiEstimate.protein}g</strong>
                  </div>
                  <div>
                    <span>Carbs</span>
                    <strong>{aiEstimate.carbs}g</strong>
                  </div>
                  <div>
                    <span>Fat</span>
                    <strong>{aiEstimate.fat}g</strong>
                  </div>
                </div>
                {Array.isArray(aiEstimate.assumptions) &&
                aiEstimate.assumptions.length > 0 ? (
                  <div className="ai-assumptions">
                    <span>Assumptions</span>
                    <ul>
                      {aiEstimate.assumptions.map((assumption, index) => (
                        <li key={`${assumption}-${index}`}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Add meal</h2>
              <button
                className="ghost-button compact-button"
                type="button"
                onClick={saveFoodPreset}
              >
                Save as food
              </button>
            </div>
            <form className="form-grid" onSubmit={saveMeal}>
              <input
                name="name"
                placeholder="Meal name"
                value={mealForm.name}
                onChange={handleMealChange}
              />
              <input
                name="calories"
                inputMode="numeric"
                type="number"
                placeholder="Calories"
                value={mealForm.calories}
                onChange={handleMealChange}
              />
              <input
                name="protein"
                inputMode="numeric"
                type="number"
                placeholder="Protein (g)"
                value={mealForm.protein}
                onChange={handleMealChange}
              />
              <input
                name="carbs"
                inputMode="numeric"
                type="number"
                placeholder="Carbs (g)"
                value={mealForm.carbs}
                onChange={handleMealChange}
              />
              <input
                name="fat"
                inputMode="numeric"
                type="number"
                placeholder="Fat (g)"
                value={mealForm.fat}
                onChange={handleMealChange}
              />
              <button className="primary-button" type="submit">
                Save meal
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Macros</h2>
            <ProgressBar
              label="Calories"
              value={nutritionTotals.calories}
              target={goals.calories}
              unit=""
            />
            <ProgressBar
              label="Protein"
              value={nutritionTotals.protein}
              target={goals.protein}
              unit="g"
            />
            <ProgressBar
              label="Carbs"
              value={nutritionTotals.carbs}
              target={goals.carbs}
              unit="g"
            />
            <ProgressBar
              label="Fat"
              value={nutritionTotals.fat}
              target={goals.fat}
              unit="g"
            />
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Meals</h2>
              <span>{today.meals.length} logged</span>
            </div>
            {today.meals.length === 0 ? (
              <p className="empty-state">Meals you add will appear here.</p>
            ) : (
              <div className="item-list">
                {today.meals.map((meal, index) => (
                  <article className="list-item" key={meal.id || index}>
                    <div>
                      <strong>{meal.name}</strong>
                      <span>
                        {meal.calories} cal, P {meal.protein}g, C {meal.carbs}g,
                        F {meal.fat}g
                      </span>
                    </div>
                    <button
                      aria-label={`Delete ${meal.name}`}
                      className="icon-button"
                      onClick={() => deleteMeal(meal.id || index)}
                    >
                      x
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {page === "workout" && (
        <section className="stack">
          <section className="panel">
            <h2>Add workout</h2>
            <form className="form-grid" onSubmit={saveWorkout}>
              <select
                value={muscleGroup}
                onChange={event => setMuscleGroup(event.target.value)}
              >
                <option value="">Muscle group</option>
                {Object.keys(presets).map(group => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>

              <select
                value={workoutForm.exercise}
                onChange={event =>
                  setWorkoutForm({
                    ...workoutForm,
                    exercise: event.target.value
                  })
                }
                disabled={!muscleGroup}
              >
                <option value="">Exercise preset</option>
                {muscleGroup &&
                  presets[muscleGroup]?.map(exercise => (
                    <option key={exercise} value={exercise}>
                      {exercise}
                    </option>
                  ))}
              </select>

              <input
                name="exercise"
                placeholder="Or type exercise"
                value={workoutForm.exercise}
                onChange={handleWorkoutChange}
              />
              <input
                name="setCount"
                inputMode="numeric"
                type="number"
                placeholder="Sets"
                min="1"
                value={workoutForm.setCount}
                onChange={changeSetCount}
              />
              <div className="set-list">
                {workoutForm.setDetails.map((set, index) => (
                  <div className="set-row" key={index}>
                    <span>Set {index + 1}</span>
                    <input
                      aria-label={`Set ${index + 1} reps`}
                      inputMode="numeric"
                      type="number"
                      placeholder="Reps"
                      value={set.reps}
                      onChange={event =>
                        updateWorkoutSet(index, "reps", event.target.value)
                      }
                    />
                    <input
                      aria-label={`Set ${index + 1} weight`}
                      inputMode="decimal"
                      type="number"
                      placeholder="Kg"
                      value={set.weight}
                      onChange={event =>
                        updateWorkoutSet(index, "weight", event.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
              <button className="primary-button" type="submit">
                Save workout
              </button>
            </form>
          </section>
        </section>
      )}

      {page === "presets" && (
        <section className="stack">
          <section className="panel">
            <h2>Training plans</h2>
            <form className="inline-form" onSubmit={addMuscleGroup}>
              <input
                placeholder="New muscle group"
                value={newGroup}
                onChange={event => setNewGroup(event.target.value)}
              />
              <button className="primary-button" type="submit">
                Add
              </button>
            </form>
          </section>

          {Object.keys(presets).length === 0 ? (
            <p className="empty-state">Add a muscle group to start building presets.</p>
          ) : (
            Object.keys(presets).map(group => (
              <section className="panel" key={group}>
                <div className="section-heading">
                  <h2>{group}</h2>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${group}`}
                    onClick={() => deletePresetGroup(group)}
                  >
                    x
                  </button>
                </div>
                <div className="inline-form">
                  <input
                    placeholder="Exercise name"
                    value={exerciseInputs[group] || ""}
                    onChange={event =>
                      setExerciseInputs(prev => ({
                        ...prev,
                        [group]: event.target.value
                      }))
                    }
                  />
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => addPresetExercise(group)}
                  >
                    Add
                  </button>
                </div>
                <div className="chip-list">
                  {presets[group].map((exercise, index) => (
                    <button
                      className="chip"
                      key={`${exercise}-${index}`}
                      onClick={() => deletePresetExercise(group, index)}
                    >
                      {exercise} x
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </section>
      )}

      {page === "settings" && (
        <section className="panel">
          <h2>Daily goals</h2>
          <p className="sync-status">{syncState}</p>
          <p className="helper-text">
            Walking calories use a simple estimate of about 40 calories per 1,000 steps,
            so treat that number as a guide rather than an exact burn.
          </p>
          <div className="form-grid">
            {Object.keys(defaultGoals).map(goal => (
              <label className="field-label" key={goal}>
                <span>{goal}</span>
                <input
                  type="number"
                  value={goals[goal]}
                  onChange={event =>
                    setGoals(prev => ({
                      ...prev,
                      [goal]: numberValue(event.target.value)
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
