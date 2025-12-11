const express = require("express");
const cors = require("cors");
const app = express();

const port = process.env.PORT || 8000;

// Middleware
require("dotenv").config();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.mz20f4d.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const database = client.db("BookCourier");
    const booksCollection = database.collection("books");
    const librariesCollection = database.collection("libraries");
    const ordersCollection = database.collection("bookorders");

    app.get("/books/latest", async (req, res) => {
      const cursor = booksCollection.find().sort({ added_at: -1 }).limit(4);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/books", async (req, res) => {
      const cursor = booksCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const book = await booksCollection.findOne(query);
      res.send(book);
    });

    app.get("/libraries", async (req, res) => {
      const cursor = librariesCollection.find();
      const libraries = await cursor.toArray();
      res.send(libraries);
    });

    app.get("/bookorders", async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const cursor = ordersCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    });

    app.post("/books", async (req, res) => {
      const newBook = req.body;
      const result = await booksCollection.insertOne(newBook);
      res.send(result);
    });

    app.post("/bookorders", async (req, res) => {
      const newOrder = req.body;
      const result = await ordersCollection.insertOne(newOrder);
      res.send(result);
    });

    // app.post("/libraries", async (req, res) => {
    //   const newLibrary = req.body;
    //   const result = await librariesCollection.insertOne(newLibrary);
    //   res.send(result);
    // });

    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id;
      const mrp_price = req.query.mrp_price;
      const rental_rate_per_day = req.query.rental_rate_per_day;
      const query = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          mrp_price: mrp_price,
          rental_rate_per_day: rental_rate_per_day,
        },
      };
      const result = await booksCollection.updateOne(query, updatedData);
      res.send(result);
    });
    await client.db("admin").command({ ping: 1 });
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
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
