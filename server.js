const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from src
app.use(express.static(path.join(__dirname, 'src')));

// Serve contract artifact JSON files (e.g. MyContract.json, MoneyManagement.json)
app.use(express.static(path.join(__dirname, 'build/contracts')));

app.listen(PORT, () => {
  console.log(`Rental Agreement DApp web server running at http://localhost:${PORT}`);
});
