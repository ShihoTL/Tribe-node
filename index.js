import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// Basic test route
app.get("/", (req, res) => {
  res.send("Tribes Node Server is Running");
});

// Notification endpoint
app.post("/send-notification", async (req, res) => {
  const { token, title, body, data } = req.body;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
