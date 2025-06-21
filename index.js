const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.port || 3000;
const app = express();

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.zbkgllm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
 if(!token){
  return res.status(401).send({message:"unauthorized access"})
 }
 jwt.verify(token, process.env.secret_key,(error,decode)=>{
  if(error){
    return res.status(401).send({message:"unauthorized"})
  }
  req.decode = decode;
 
 }) 
 next();
 

};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const jobsCollection = client.db("jobHyper").collection("jobs");
    const applicationsCollection = client
      .db("jobHyper")
      .collection("applicationData");

    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });
    // add job apis
    app.post("/addjobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });
    app.get("/mypostedjobs", verifyToken, async (req, res) => {
      const email = req.query.email;
      if(req.decode.email !== email){
        return res.status(403).send({message:"forbidded"})
      }
      const query = { hr_email: email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/singlejob/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // application related api
    app.post("/applications", async (req, res) => {
      const applicationsData = req.body;
      const result = await applicationsCollection.insertOne(applicationsData);
      res.send(result);
    });

    app.get("/myapplication", async (req, res) => {
      const email = req.query.email;
      const query = {
        applicant: email,
      };
      const result = await applicationsCollection.find(query).toArray();
      // bad way to aggregate with another db
      for (let application of result) {
        const jobId = application.jobId;
        const query = { _id: new ObjectId(jobId) };
        const job = await jobsCollection.findOne(query);
        application.company = job.company;
        application.title = job.title;
        application.company_logo = job.company_logo;
        application.location = job.location;
      }
      res.send(result);
    });
    app.get("/application/:job_id", async (req, res) => {
      const jobId = req.params.job_id;
      const query = { jobId: jobId };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });
    app.patch("/applicationStatus/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: status,
        },
      };
      const result = await applicationsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // jsonwebtoken
    app.post("/jwt", async (req, res) => {
      const userEmail = req.body;
      const token = await jwt.sign(userEmail, process.env.secret_key, {
        expiresIn: "1h",
      });
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
      });
     
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running wow");
});

app.listen(port, () => {
  console.log("app is running on", port);
});
