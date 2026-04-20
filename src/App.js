import { useEffect, useMemo, useState } from "react";
import "./App.css";

const defaultGoals = {
  calories: 2200,
  protein: 160,
  carbs: 250,
  fat: 70,
  water: 2500
};

const defaultDay = {
  workouts: [],
  meals: [],
  water: 0,
  muscleGroup: ""
};

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
    meals: Array.isArray(day.meals) ? day.meals : []
  };
}

function numberValue(value) {
  return Number(value) || 0;
}

function ProgressBar({ label, value, target, unit }) {
  const percent = target > 0 ? Math.min((value / target) * 100, 100) : 0;

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
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState(() => safeJson("gymData", {}));
  const [presets, setPresets] = useState(() => safeJson("presets", {}));
  const [goals, setGoals] = useState(() => ({
    ...defaultGoals,
    ...safeJson("dailyGoals", {})
  }));
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [page, setPage] = useState("dashboard");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [exerciseInputs, setExerciseInputs] = useState({});

  const [mealForm, setMealForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: ""
  });

  const [workoutForm, setWorkoutForm] = useState({
    exercise: "",
    sets: "",
    reps: "",
    weight: ""
  });

  useEffect(() => {
    localStorage.setItem("gymData", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("presets", JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem("dailyGoals", JSON.stringify(goals));
  }, [goals]);

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

  const weeklyStats = useMemo(() => {
    const selected = new Date(`${selectedDate}T12:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(selected);
      date.setDate(selected.getDate() - (6 - index));
      const key = date.toISOString().split("T")[0];
      const day = normaliseDay(data[key]);
      const calories = day.meals.reduce(
        (sum, meal) => sum + numberValue(meal.calories),
        0
      );

      return {
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        calories,
        water: day.water,
        workouts: day.workouts.length
      };
    });
  }, [data, selectedDate]);

  const workoutVolume = today.workouts.reduce(
    (sum, workout) =>
      sum +
      numberValue(workout.sets) *
        numberValue(workout.reps) *
        numberValue(workout.weight),
    0
  );

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

  function handleWorkoutChange(event) {
    setWorkoutForm({
      ...workoutForm,
      [event.target.name]: event.target.value
    });
  }

  function addWater(amount) {
    updateDay(day => ({
      ...day,
      water: Math.max(0, day.water + amount),
      muscleGroup
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

  function deleteMeal(id) {
    updateDay(day => ({
      ...day,
      meals: day.meals.filter((meal, index) => (meal.id || index) !== id)
    }));
  }

  function saveWorkout(event) {
    event.preventDefault();
    if (!workoutForm.exercise.trim()) return;

    const workout = {
      id: crypto.randomUUID(),
      exercise: workoutForm.exercise.trim(),
      sets: numberValue(workoutForm.sets),
      reps: numberValue(workoutForm.reps),
      weight: numberValue(workoutForm.weight),
      muscleGroup
    };

    updateDay(day => ({
      ...day,
      muscleGroup,
      workouts: [...day.workouts, workout]
    }));

    setWorkoutForm({ exercise: "", sets: "", reps: "", weight: "" });
    setPage("dashboard");
  }

  function deleteWorkout(id) {
    updateDay(day => ({
      ...day,
      workouts: day.workouts.filter(
        (workout, index) => (workout.id || index) !== id
      )
    }));
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
  const bestDay = weeklyStats.reduce(
    (best, day) => (day.workouts > best.workouts ? day : best),
    weeklyStats[0]
  );

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
              <strong>{caloriesLeft}</strong>
              <small>{nutritionTotals.calories} eaten</small>
            </article>
            <article className="metric-card">
              <span>Water</span>
              <strong>{today.water}ml</strong>
              <small>{Math.round((today.water / goals.water) * 100) || 0}% goal</small>
            </article>
            <article className="metric-card">
              <span>Workouts</span>
              <strong>{today.workouts.length}</strong>
              <small>{Math.round(workoutVolume)}kg volume</small>
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
          </section>

          <section className="quick-actions">
            <button onClick={() => addWater(250)}>+ 250ml</button>
            <button onClick={() => addWater(500)}>+ 500ml</button>
            <button onClick={() => addWater(-250)}>- 250ml</button>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Last 7 days</h2>
              <span>{bestDay?.label || "Today"} was your busiest lift day</span>
            </div>
            <div className="week-chart" aria-label="Seven day calorie chart">
              {weeklyStats.map(day => (
                <div key={day.key} className="day-bar">
                  <div className="bar-wrap">
                    <div
                      className="bar-fill"
                      style={{
                        height: `${Math.min(
                          (day.calories / goals.calories) * 100,
                          100
                        )}%`
                      }}
                    />
                  </div>
                  <span>{day.label}</span>
                </div>
              ))}
            </div>
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
                  <article className="list-item" key={workout.id || index}>
                    <div>
                      <strong>{workout.exercise}</strong>
                      <span>
                        {workout.sets} x {workout.reps} at {workout.weight}kg
                      </span>
                    </div>
                    <button
                      aria-label={`Delete ${workout.exercise}`}
                      className="icon-button"
                      onClick={() => deleteWorkout(workout.id || index)}
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
            <h2>Add meal</h2>
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
                name="sets"
                inputMode="numeric"
                type="number"
                placeholder="Sets"
                value={workoutForm.sets}
                onChange={handleWorkoutChange}
              />
              <input
                name="reps"
                inputMode="numeric"
                type="number"
                placeholder="Reps"
                value={workoutForm.reps}
                onChange={handleWorkoutChange}
              />
              <input
                name="weight"
                inputMode="decimal"
                type="number"
                placeholder="Weight (kg)"
                value={workoutForm.weight}
                onChange={handleWorkoutChange}
              />
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
