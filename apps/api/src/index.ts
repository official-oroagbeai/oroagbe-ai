import express from 'express';
import cors from 'cors';
import routes from './routes/index.js'; // NodeNext requires the .js extension in imports!

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount your typed routes
app.use('/api', routes);

// Boot the server
app.listen(PORT, () => {
  console.log(`[Express] OroAgbeAI API is running at http://localhost:${PORT}`);
});