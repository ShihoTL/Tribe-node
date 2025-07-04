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

  console.log("Received notification request:");
  console.log("Token:", token);
  console.log("Title:", title);
  console.log("Body:", body);
  console.log("Data:", data);

  try {
    await admin.messaging().send({
      topic: `tribe_${tribeId}`,
      notification: { title, body },
      data,
    });

    console.log("✅ Notification sent successfully:", response);
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
