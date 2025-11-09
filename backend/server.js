import express from 'express';
import cors from 'cors';
const app = express();
const PORT = process.env.PORT || 8100; // Use environment variable or default to 3000

app.use(cors());

// Define a basic route
app.get('/', (req, res) => {
    res.json({"test": 123123, "test2": "testfield"})
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});