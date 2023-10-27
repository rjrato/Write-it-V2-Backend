require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const CORS_URL = process.env.CORS_URL;

const corsOptions = {
  origin: CORS_URL,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}
app.use(cors(corsOptions));

// MongoDB connection
const uri = process.env.MONGODB_URI;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connection successful'))
  .catch(err => console.log('MongoDB connection error:', err));


// Schemas and Models
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  notes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Note"
  }]
});

const noteSchema = new mongoose.Schema({
  title: String,
  content: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
})

const User = mongoose.model("User", userSchema);
const Note = mongoose.model("Note", noteSchema);

// User registration API
app.post("/api/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUser = new User({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hashedPassword,
    });
    
    await newUser.save(); 
    res.status(200).json({
      success: true,
      user: {
        userId: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      },
      message: "User registered"
    });
  
  } catch (err) {
    console.error("Registration failed:", err);
    res.status(400).json({ 
      success: false, 
      message: "Registration failed" 
    });
  }
});

// User login API
app.post("/api/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      const isMatch = await bcrypt.compare(req.body.password, user.password);
      if (isMatch) {
        res.status(200).json({
          success: true,
          user: {
            userId: user._id,
            firstName: user.firstName,
            lastName: user.lastName
          }
        });
      } else {
        res.status(401).send("Incorrect password");
      }
    } else {
      res.status(404).send("User not found");
    }
  } catch (err) {
    res.status(400).json({ success: false, message: "Login failed" });
  }
});

// User add note API
app.post("/api/addNote", async (req, res) => {
  try {

    const {userId, title, content} = req.body;
    
    const newNote = new Note({
      title,
      content,
      user: userId
    })

    await newNote.save();
    const user = await User.findById(userId);
    user.notes.push(newNote);
    await user.save();
    res.status(200).json({ success: true, note: newNote, message: "Note successfully added!" });
  } catch (err) {
    res.status(400).json({ success: false, message: err});
  }
});

// User delete note API
app.post(`/api/deleteNote/:userId/:noteId`, async (req, res) => {

  const {userId, noteId} = req.params;
  await Note.findByIdAndDelete(noteId);
  const user = await User.findById(userId);
  user.notes.pull(noteId);
  await user.save();
  res.status(200).json({ success: true, message: "Note successfully deleted!"})
});

app.get(`/api/getUserNotes/:userId`, async (req, res) => {
  try {
    const {userId} = req.params;
    const user = await User.findById(userId).populate("notes");
    res.json(user.notes);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3001;
app.get("/", (req, res) => {
  res.send(`Server is running on port ${PORT}.`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});