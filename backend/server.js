require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const promClient = require('prom-client');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const User = require('./models/User');
const Article = require('./models/Article');

const app = express();
app.use(express.json());
app.use(cors());

// --- Observability (Prometheus & Logstash/Winston) ---
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  registers: [register]
});

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' }) 
  ],
});

// --- Database & Redis ---
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  dbName: 'reading-list' // <--- THIS IS THE KEY FIX
})

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// --- Middleware ---
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(400).json({ msg: 'Token is not valid' });
  }
};

// --- Routes ---

// Metrics Endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Register (Updated with Email)
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if Username OR Email already exists
    let user = await User.findOne({ $or: [{ username }, { email }] });
    if (user) {
      if (user.email === email) return res.status(400).json({ msg: 'Email already registered' });
      return res.status(400).json({ msg: 'Username already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Login (Updated: Username OR Email + Specific Errors)
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body; // identifier = username OR email
  try {
    // Search by Username OR Email
    const user = await User.findOne({ 
      $or: [{ username: identifier }, { email: identifier }] 
    });

    // Error 1: User not found
    if (!user) return res.status(400).json({ msg: 'User not registered' });

    // Error 2: Wrong Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Wrong credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Submit URL (Trigger Worker) - FIXED FOR CELERY 5+
app.post('/api/articles', auth, async (req, res) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  const { url } = req.body;

  try {
    // 1. Create DB Entry
    const newArticle = new Article({ userId: req.user.id, url });
    const savedArticle = await newArticle.save();

    // 2. Push task to Redis with Valid Celery Format
    // ... inside app.post('/api/articles') ...

    const taskId = uuidv4();
    
    // CELERY PROTOCOL 2 FORMAT: [args, kwargs, embed]
    const args = [savedArticle._id.toString(), url];
    const kwargs = {};
    const embed = {};
    const bodyContent = [args, kwargs, embed];

    const taskPayload = {
      "body": Buffer.from(JSON.stringify(bodyContent)).toString('base64'),
      "content-encoding": "utf-8",
      "content-type": "application/json",
      "headers": {
        "task": "tasks.process_article",
        "id": taskId,
        "lang": "py"
      },
      "properties": {
        "body_encoding": "base64",
        "correlation_id": taskId,
        "delivery_info": {
          "exchange": "",
          "routing_key": "celery"
        },
        "delivery_mode": 2,
        "delivery_tag": uuidv4(),
        "priority": 0,
        "reply_to": uuidv4()
      }
    };
    
    await redis.lpush('celery', JSON.stringify(taskPayload));
    
    logger.info({ message: 'Task queued', articleId: savedArticle._id });
    res.json(savedArticle);
    end({ method: 'POST', route: '/api/articles', code: 200 });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server Error');
    end({ method: 'POST', route: '/api/articles', code: 500 });
  }
});

// Get Articles
app.get('/api/articles', auth, async (req, res) => {
  try {
    const articles = await Article.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(articles);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Delete Article
app.delete('/api/articles/:id', auth, async (req, res) => {
  try {
    await Article.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Article deleted' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));