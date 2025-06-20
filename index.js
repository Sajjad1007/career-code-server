const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const admin = require("firebase-admin");
// const serviceAccount = require("./firebase-admin-service-key.json");

app.use(cors());
app.use(express.json());

const firebaseKeyBase64 = process.env.FIREBASE_SERVICE_KEY_B64;
const firebaseKeyJson = Buffer.from(firebaseKeyBase64, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(firebaseKeyJson);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster01.ezzxwt4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster01`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("decoded token", decoded);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobsCollection = client.db("careerCodeDB").collection("jobs");
    const applicationsCollection = client
      .db("careerCodeDB")
      .collection("applications");

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = {};

      if (email) {
        query.hr_email = email;
      }

      const cursor = (await jobsCollection).find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get(
      "/jobs/applications",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const email = req.query.email;
        const query = { hr_email: email };
        const jobs = await jobsCollection.find(query).toArray();

        for (const job of jobs) {
          const applicationQuery = { jobId: job._id.toString() };
          job.applicationCount = await applicationsCollection.countDocuments(
            applicationQuery
          );
        }
        res.send(jobs);
      }
    );

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    app.get(
      "/applications",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const email = req.query.email;
        const query = {
          applicant: email,
        };
        const result = await applicationsCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await applicationsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/applications/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { jobId: id };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This is the official server of Career Code project.");
});

app.listen(port, () => {
  console.log(`Career Code server is running on port ${port}.`);
});
