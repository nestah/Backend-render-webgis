const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // For parsing application/json
const upload = multer({ dest: 'uploads/' });

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Use DATABASE_URL directly
});

// Simple API route to get all health facilities
app.get('/api/facilities', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM health_facilities'); // Adjust the table name accordingly
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// API route to get unique facility types
app.get('/api/facility-types', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT facility_type FROM health_facilities WHERE facility_type IS NOT NULL');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Endpoint to handle CSV uploads
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const data = [];
    let headers = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (headers.length === 0) {
            headers = Object.keys(row).map(header => header.trim());
        }
        data.push(row);
      })
      .on('end', async () => {
        try {
          for (const row of data) {
            const columns = headers.join(', ');
            const placeholders = headers.map((_, index) => `$${index + 1}`).join(', ');
            const queryText = `INSERT INTO temp_upload (${columns}) VALUES (${placeholders}) RETURNING *;`;
            const values = headers.map(header => row[header]);
            await pool.query(queryText, values);
          }
          res.status(200).json({ message: 'CSV data successfully uploaded!' });
        } catch (error) {
          console.error('Error inserting data into database:', error);
          res.status(500).json({ error: 'Error inserting data into database' });
        } finally {
          fs.unlinkSync(filePath); // Clean up the uploaded file
        }
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
        res.status(500).json({ error: 'Error reading CSV file' });
      });
  });

// Endpoint to get uploaded facilities
app.get('/api/uploaded-facilities', async (req, res) => {
    console.log('Received request for uploaded facilities');
    try {
        const result = await pool.query('SELECT * FROM temp_upload');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
