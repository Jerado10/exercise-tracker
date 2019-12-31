const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const cors = require("cors");

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/exercise-track");

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Set up db

var subSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: String
}, {_id: false});

var schema = new mongoose.Schema({
  username: String,
  exercises: [subSchema]
});

var ExerciseTracker = mongoose.model('ExerciseTracker', schema);

// Post new user

app.post("/api/exercise/new-user", function(req, res) {
  ExerciseTracker.count({username: req.body.username}, function (err, count){ 
    if (count>0) {
      res.send('Username already taken')
    } else {
      var exerciseTracker = new ExerciseTracker({username: req.body.username});
      exerciseTracker.save(function(err, data) {
        if (err) return console.error(err);
        res.json({username: data.username, _id: data.id});
      });
    }; 
  });
});

// Function for date formatting

const months = ["Jan", "Feb", "Mar","Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function appendLeadingZeroes(n){
  if (n <= 9) {
    return "0" + n;
  };
  return n;
}

function formatDate(d){
  return days[d.getDay()] + ' ' +  months[d.getMonth()] + ' ' + appendLeadingZeroes(d.getDate()) + ' ' + d.getFullYear()
}

// Post exercise

app.post("/api/exercise/add", function(req, res) {
  ExerciseTracker.findById(req.body.userId, function (err, tracker) {
    if (tracker === null) { 
      res.send('unknown _id') // Catch unknown ids
    } else {
      if (err) console.log(err);
      
      // Push exercise to exercises array and save
      
      tracker.exercises.push({
        description: req.body.description,
        duration: Number(req.body.duration),
        date: formatDate(new Date(req.body.date))
      });
      tracker.save(function(err, data) {
        if (err) return console.error(err);
      });
      
      // Send response json
      
      res.json({
        username: tracker.username,
        description: req.body.description,
        duration: Number(req.body.duration),
        _id: req.body.userId,
        date: formatDate(new Date(req.body.date))
      });
    };
  });
});

// Get exercise log

app.get("/api/exercise/log", function(req, res) {
  ExerciseTracker.findById(req.query.userId, function (err, tracker) {
    if (tracker === null) {
      res.send('unknown _id') // Catch unknown ids
    } else {
      
      // Set base objects for inclusion on json
      
      var response = {_id: req.query.userId, username: tracker.username};
      var log = tracker.exercises;
      
      // Filter exercise log & add objects based on optional queries
      // From
      
      if (req.query.from) {
        log = log.filter(function(elem) {
          return new Date(elem.date) >= new Date(req.query.from)
        })
        response.from = formatDate(new Date(req.query.from))
      }
      
      // To
      
      if (req.query.to) {
        log = log.filter(function(elem) {
          return new Date(elem.date) <= new Date(req.query.to)
        })
        response.to = formatDate(new Date(req.query.to))
      };
      
      //Limit
      
      if (req.query.limit) {
        if (log.length > req.query.limit) {
          log = log.slice(0, req.query.limit)
        }; 
      };
      response.count = log.length;
      response.log = log;
      res.json(response)
    };
  }); 
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
