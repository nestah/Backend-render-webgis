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
  user: process.env.PG_USER, // PostgreSQL username
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE, // database name
  password: process.env.PG_PASSWORD, // PostgreSQL password
  port: process.env.PG_PORT,
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

// to handle csv 

// Endpoint to handle CSV uploads
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
  
    // Array to hold the parsed CSV data
    const data = [];
    let headers = [];
  
    // Stream the CSV file and parse it
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (headers.length === 0) {
            headers = Object.keys(row).map(header => header.trim());
        }
        data.push(row); // Add each parsed row to the data array
      })
      .on('end', async () => {
        try {
          // Insert each row into the PostgreSQL database
          for (const row of data) {
            // Constructing the column names and placeholders dynamically
            const columns = headers.join(', ');
            const placeholders = headers.map((_, index) => `$${index + 1}`).join(', ');
  
             // Create the SQL query targeting the health_facilities table
            const queryText = `INSERT INTO temp_upload (${columns}) VALUES (${placeholders}) RETURNING *;`;
  
            // Extract values based on the current row's data
            const values = headers.map(header => row[header]);
  
            // Execute the query
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
//   get uploaded facilities
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

// end
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
