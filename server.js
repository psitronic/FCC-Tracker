const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGODB)

// create MongoDB schema and model
var exerciseSchema = new mongoose.Schema ({
  username: String,
  log: [{
    description: String,
    duration: Number,
    date: Date
  }]
});

var Exercise = mongoose.model("Exercise", exerciseSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.get("/api/exercise/users", (req, res, next) =>{
  Exercise.find({},{_id:1, username:1}, (error, data)=>{
    if (error){
      return next({message:error});
    } else {
      res.json(data);
    };
  });
});

app.get("/api/exercise/log", (req, res, next) => {
  let userId = mongoose.Types.ObjectId(req.query.userId);// First need to convert string to ObjectId type
  let from = (!req.query.from ? new Date("1900-01-01") : new Date(req.query.from));
  let to = (!req.query.to ? new Date() : new Date(req.query.to));
  let limit = (!req.query.limit ? 1000000 : Number(req.query.limit));
  
  if (!userId){
    return next({message:"You should specify user id"});
  } else {
    Exercise.aggregate([
      {
        $match:{_id:userId}
      },
      { 
        $unwind: "$log"
      },
      {
        $limit:limit
      },
      {
        $match:{"log.date":{$gte: from, $lte: to}}
      },
      {
       $project: {_id:1, username:1, "log.description":1, "log.duration":1, "log.date":1}
      },
      {
        $group:{_id:"$_id", username: {$first:"$username"}, count:{$sum:1}, log:{$push:"$log"}}
      }
    ], (error, data) => {
      
      if (req.query.to){
        data[0].to = to;
      };
      if (req.query.from){
        data[0].from = from;
      };
      
      res.json(data[0]);
    });
  };
});

app.post("/api/exercise/new-user", (req, res, next) =>{
  
  const username = req.body.username;
  
  Exercise.findOne({username:username}, (error, data) =>{
    if (error) {
      throw error;
    } else {
      if (data === null) {
        Exercise.create({username:username}, (error, data) => {
          if (error) {
            throw error;
          } else {
            res.json({username:data.username, _id:data._id});
          };
        });
      } else {
        return next({message:"username already taken"});
      };
    };
  });
});

app.post("/api/exercise/add", (req, res, next) => {

  var id = req.body.userId;
  var description = req.body.description;
  var duration = req.body.duration;
  var date = (req.body.date === '' ? Date.now() : req.body.date);
    
  Exercise.findOneAndUpdate({_id:id}, {$push: {log:{description: description, duration: duration, date: date}}}, { upsert: true, new: true }, (error, data) => {
    if (error) {
      return next({message:error});
    } else {
      var insertedData = data.log[data.log.length - 1];
      var obj = {
        username: data.username,
        _id: data._id,
        description: insertedData.description,
        duration:  insertedData.duration,
        date:  insertedData.date.toDateString()
      };
      res.json(obj);
    };
  });
  
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
