const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.post('/send-notification', async (req, res) => {
  try {
    const {
      title,
      body,
      data,
      token,
      topic,
    } = req.body;

    const message = {
      notification: { title, body },
      data,
      ...(token ? { token } : {}),
      ...(topic ? { topic } : {}),
    };

    const response = await admin.messaging().send(message);
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (_, res) => {
  res.send('Tribes notification server running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
