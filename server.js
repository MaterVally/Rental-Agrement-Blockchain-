const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from src (index.html, app.js, style.css)
app.use(express.static(path.join(__dirname, 'src')));

// Serve contract artifact JSON files (RentalAgreement.json, MyContract.json, etc.)
app.use(express.static(path.join(__dirname, 'build/contracts')));

app.listen(PORT, () => {
  console.log(`RentChain DApp running at http://localhost:${PORT}`);
});
