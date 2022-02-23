const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8000; // must use process.env.PORT when deploy to gcloud

app.use(cors());

const sheetApi = require('./sheetApi');

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Appengine-Cron");
  next();
});

app.set('trust proxy', true);

app.get('/', (req, res) => {
  res.send('Hello World!')
});

app.post('/write-to-sheet', sheetApi.writeValuesToGoogleResponse);

app.get('/cron-send-sms', sheetApi.writeValuesToGoogleResponse);

app.listen(port, () => {
  console.log(`Server listening on port ${port}!`)
});