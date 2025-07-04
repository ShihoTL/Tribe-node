import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { createRequire } from "node:module";

dotenv.config();

const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.get("/", (req, res) => {
  console.log("GET / - Server is up");
  res.send("Tribes Node Server is Running");
});

// POST /send-notification endpoint
app.post("/send-notification", async (req, res) => {
  const { token, title, body, data } = req.body;
  const tribeId = data?.tribeId;
  const topic = tribeId ? `tribe_${tribeId}` : null;

  console.log("Received notification request:");
  if (token) console.log("Token:", token);
  if (topic) console.log("Topic:", topic);
  console.log("Title:", title);
  console.log("Body:", body);
  console.log("Data:", data);

  if (!token && !tribeId) {
    return res.status(400).json({
      success: false,
      error: "Either token or data.tribeId (for topic) is required",
    });
  }

  try {
    const response = await admin.messaging().send({
      notification: { title, body },
      data,
      ...(topic ? { topic } : { token }),
    });

    console.log("✅ Notification sent successfully:", response);
    console.log("Full Payload:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
