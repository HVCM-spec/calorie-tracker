import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

function App() {
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [meal, setMeal] = useState("Breakfast");

  const [foods, setFoods] = useState([]);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [editingId, setEditingId] = useState(null);
  const [editCalories, setEditCalories] = useState("");

  // 🔍 Search
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🎯 Goal (WITH LOCAL STORAGE)
  const [calorieGoal, setCalorieGoal] = useState(() => {
    const saved = localStorage.getItem("calorieGoal");
    return saved ? parseInt(saved) : 2000;
  });

  useEffect(() => {
    localStorage.setItem("calorieGoal", calorieGoal);
  }, [calorieGoal]);

  // 🔹 Fetch foods
  const fetchFoods = async () => {
    const snapshot = await getDocs(collection(db, "foods"));
    const data = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
    setFoods(data);
  };

  useEffect(() => {
    fetchFoods();
  }, []);

  // 🔹 Add food
  const addFood = async () => {
    if (!foodName || !calories) return;

    const newFood = {
      name: foodName,
      calories: parseInt(calories) || 0,
      meal,
      date: selectedDate,
    };

    const docRef = await addDoc(collection(db, "foods"), newFood);

    setFoods([...foods, { id: docRef.id, ...newFood }]);

    setFoodName("");
    setCalories("");
  };

  // 🔹 Delete
  const deleteFood = async (id) => {
    await deleteDoc(doc(db, "foods", id));
    setFoods(foods.filter((f) => f.id !== id));
  };

  // 🔹 Edit start
  const startEdit = (food) => {
    setEditingId(food.id);
    setEditCalories(food.calories);
  };

  // 🔹 Save edit
  const saveEdit = async (id) => {
    await updateDoc(doc(db, "foods", id), {
      calories: parseInt(editCalories) || 0,
    });

    setFoods(
      foods.map((f) =>
        f.id === id ? { ...f, calories: parseInt(editCalories) || 0 } : f
      )
    );

    setEditingId(null);
  };

  // 🔍 Search food
  const searchFood = async () => {
    if (!search) return;

    setLoading(true);

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${search}&search_simple=1&action=process&json=1`
      );

      const data = await res.json();
      setResults(data.products.slice(0, 5));
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  };

  const getCalories = (item) => {
    const value =
      item.nutriments?.energy_kcal ||
      item.nutriments?.["energy-kcal_100g"] ||
      0;

    return Math.round(value);
  };

  // 📅 Dates
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString()
    .split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000)
    .toISOString()
    .split("T")[0];

  // 🔹 Filter + group
  const filteredFoods = foods.filter((f) => f.date === selectedDate);

  const meals = ["Breakfast", "Lunch", "Dinner", "Snacks"];

  const getFoodsByMeal = (mealType) =>
    filteredFoods.filter((f) => f.meal === mealType);

  // 🎯 Progress logic
  const totalCalories = filteredFoods.reduce(
    (total, f) => total + (f.calories || 0),
    0
  );

  const progress = calorieGoal
    ? Math.min(totalCalories / calorieGoal, 1)
    : 0;

  const isExact = totalCalories === calorieGoal;

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px" }}>
      <h1>Calorie Tracker</h1>

      {/* 📅 Date selector */}
      <div>
        <button onClick={() => setSelectedDate(yesterday)}>Yesterday</button>
        <button onClick={() => setSelectedDate(today)}>Today</button>
        <button onClick={() => setSelectedDate(tomorrow)}>Tomorrow</button>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* 🎯 Progress */}
      <div style={{ marginTop: "20px" }}>
        <h2>Daily Goal</h2>

        <input
          type="number"
          value={calorieGoal}
          onChange={(e) => setCalorieGoal(parseInt(e.target.value) || 0)}
        />

        <div
          style={{
            width: "150px",
            height: "150px",
            borderRadius: "50%",
            background: `conic-gradient(
              ${isExact ? "green" : isOver ? "red" : "orange"} ${progress * 360}deg,
              #eee ${progress * 360}deg
            )`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "15px",
          }}
        >
          <div
            style={{
              width: "110px",
              height: "110px",
              borderRadius: "50%",
              background: "white",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <strong>
              {calorieGoal - totalCalories > 0
                ? `${calorieGoal - totalCalories} left`
                : `${totalCalories - calorieGoal} over`}
            </strong>
          </div>
        </div>

        <p>
          {totalCalories} / {calorieGoal} kcal
        </p>
      </div>

      {/* 🔍 Search */}
      <h2>Search Food</h2>

      <input
        type="text"
        placeholder="Search food"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <button onClick={searchFood}>Search</button>

      {loading && <p>Loading...</p>}

      <ul>
        {results.map((item, index) => (
          <li key={item.code || index}>
            {item.product_name || "Unknown Food"} - {getCalories(item)} kcal

            <button
              onClick={() => {
                setFoodName(item.product_name || "Unknown Food");
                setCalories(getCalories(item));
              }}
            >
              Use
            </button>
          </li>
        ))}
      </ul>

      {/* ➕ Add food */}
      <h2>Add Food</h2>

      <input
        type="text"
        placeholder="Food name"
        value={foodName}
        onChange={(e) => setFoodName(e.target.value)}
      />

      <input
        type="number"
        placeholder="Calories"
        value={calories}
        onChange={(e) => setCalories(e.target.value)}
      />

      <select value={meal} onChange={(e) => setMeal(e.target.value)}>
        {meals.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>

      <button onClick={addFood}>Add Food</button>

      {/* 🍽️ Meals */}
      {meals.map((mealType) => (
        <div key={mealType} style={{ marginTop: "20px" }}>
          <h3>{mealType}</h3>

          <ul>
            {getFoodsByMeal(mealType).map((food) => (
              <li key={food.id}>
                {food.name} -

                {editingId === food.id ? (
                  <>
                    <input
                      type="number"
                      value={editCalories}
                      onChange={(e) => setEditCalories(e.target.value)}
                    />
                    <button onClick={() => saveEdit(food.id)}>Save</button>
                  </>
                ) : (
                  <>
                    {food.calories} kcal
                    <button onClick={() => startEdit(food)}>Edit</button>
                  </>
                )}

                <button onClick={() => deleteFood(food.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* 🔢 Total */}
      <h2>Total Calories: {totalCalories}</h2>
    </div>
  );
}

export default App;