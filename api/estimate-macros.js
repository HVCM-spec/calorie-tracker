const OPENAI_URL = "https://api.openai.com/v1/responses";

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap(item => item.content || [])
    .filter(part => part.type === "output_text" && typeof part.text === "string")
    .map(part => part.text)
    .join("");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "AI estimation is not configured yet. Add OPENAI_API_KEY in Vercel."
    });
  }

  const description = req.body?.description?.trim();

  if (!description) {
    return res.status(400).json({ error: "Food description is required." });
  }

  try {
    const openaiResponse = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You estimate nutrition from meal descriptions. Be practical, use common serving sizes, and return only JSON."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Estimate the calories and macros for this meal: ${description}`
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "meal_estimate",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                calories: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
                assumptions: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: [
                "name",
                "calories",
                "protein",
                "carbs",
                "fat",
                "assumptions"
              ]
            }
          }
        }
      })
    });

    const payload = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error:
          payload?.error?.message || "The AI estimate request could not be completed."
      });
    }

    const text = extractOutputText(payload);
    const estimate = JSON.parse(text);

    return res.status(200).json({
      name: estimate.name,
      calories: Math.round(Number(estimate.calories) || 0),
      protein: Math.round(Number(estimate.protein) || 0),
      carbs: Math.round(Number(estimate.carbs) || 0),
      fat: Math.round(Number(estimate.fat) || 0),
      assumptions: Array.isArray(estimate.assumptions)
        ? estimate.assumptions
        : []
    });
  } catch (error) {
    return res.status(500).json({
      error: "The AI estimate failed. Please try again."
    });
  }
};
