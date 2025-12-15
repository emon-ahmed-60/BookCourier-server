const express = require("express");
const cors = require("cors");
const app = express();

const port = process.env.PORT || 8000;
const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "PRCL"; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex

  return `${prefix}-${date}-${random}`;
}

// Middleware
require("dotenv").config();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.mz20f4d.mongodb.net/?appName=Cluster0`;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    const paymentCollection = database.collection("payments");

    app.get("/books/latest", async (req, res) => {
      try {
        const cursor = booksCollection.find().sort({ added_at: -1 }).limit(4);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/books", async (req, res) => {
      try {
        const { search, order } = req.query;
        let query = {};
        let sortOption = {};
        if (search) {
          query = { title: { $regex: search, $options: "i" } };
        }
        sortOption.mrp_price = order === "asc" ? 1 : -1;
        const cursor = booksCollection.find(query).sort(sortOption);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/books/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const book = await booksCollection.findOne(query);
        res.send(book);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/libraries", async (req, res) => {
      try {
        const cursor = librariesCollection.find();
        const libraries = await cursor.toArray();
        res.send(libraries);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/bookorders", async (req, res) => {
      try {
        const userEmail = req.query.email;
        const query = { email: userEmail };
        const cursor = ordersCollection.find(query);
        const orders = await cursor.toArray();
        res.send(orders);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/payments", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { customerEmail: email };
        const cursor = paymentCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/books", async (req, res) => {
      try {
        const newBook = req.body;
        const result = await booksCollection.insertOne(newBook);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/bookorders", async (req, res) => {
      try {
        const newOrder = req.body;
        const result = await ordersCollection.insertOne(newOrder);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // app.post("/libraries", async (req, res) => {
    //   const newLibrary = req.body;
    //   const result = await librariesCollection.insertOne(newLibrary);
    //   res.send(result);
    // });

    app.patch("/books/:id", async (req, res) => {
      try {
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
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch("/bookorders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            status: "cancelled",
          },
        };
        const result = await ordersCollection.updateOne(query, update);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Payment Releted APIS here
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.amount) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.bookTitle,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.email,
        mode: "payment",
        metadata: {
          orderId: paymentInfo.orderId,
          bookName: paymentInfo.bookTitle,
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-failed`,
      });
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };

      const paymentExist = await paymentCollection.findOne(query);
      if (paymentExist) {
        return res.send({ message: "order already exist" });
      }
      const trackingId = generateTrackingId();
      if (session.payment_status === "paid") {
        const id = session.metadata.orderId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "paid",
            trackingId: trackingId,
          },
        };
        const result = await ordersCollection.updateOne(query, update);
        const paymentHistory = {
          amount: session.amount_total / 100,
          customerEmail: session.customer_email,
          orderId: session.metadata.orderId,
          bookName: session.metadata.bookName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: trackingId,
        };

        if (session.payment_status === "paid") {
          const paymentResult = await paymentCollection.insertOne(
            paymentHistory
          );
          res.send({
            modify: result,
            paymentInfo: paymentResult,
            success: true,
            trackingId: trackingId,
          });
        }
      }
      res.send({ success: true });
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
  try {
    res.send("Server is running");
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
