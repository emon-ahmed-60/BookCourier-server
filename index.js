const express = require("express");
const cors = require("cors");
const app = express();
require('dotenv').config();
const port = process.env.PORT || 8000;
const crypto = require("crypto");
const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

function generateTrackingId() {
  const prefix = "PRCL"; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex

  return `${prefix}-${date}-${random}`;
}

// Middleware

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    req.decoded_email = decoded.email;

    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

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
    const usersCollection = database.collection("users");
    const librarianCollection = database.collection("librarians");
    const booksCollection = database.collection("books");
    const librariesCollection = database.collection("libraries");
    const ordersCollection = database.collection("bookorders");
    const paymentCollection = database.collection("payments");
    const wishlistsCollection = database.collection("wishlists");
    const reviewsCollection = database.collection("reviews");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== "admin") {
        res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyLibrarian = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== "librarian") {
        res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/users",verifyFBToken,verifyAdmin, async (req, res) => {
      try {
        const cursor = usersCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/my-books", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email };
        const cursor = booksCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email };
        const user = await usersCollection.findOne(query);
        res.send({ role: user?.role || "user" });
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/reviews/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { reviewId: id };
        const cursor = reviewsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/wishlist", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email };
        const cursor = wishlistsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/librarians", async (req, res) => {
      try {
        const query = {};
        if (req.query.status) {
          query.status = req.query.status;
        }
        const cursor = librarianCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/books/latest", async (req, res) => {
      try {
        let query = { bookStatus: { $ne: "unpublished" } };
        const cursor = booksCollection
          .find(query)
          .sort({ added_at: -1 })
          .limit(4);
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
        let query = { bookStatus: { $ne: "unpublished" } };
        let sortOption = {};
        if (search) {
          query = { ...query, title: { $regex: search, $options: "i" } };
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

    app.get("/library-orders", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { librarianEmail: email };
        const orders = await ordersCollection.find(query).toArray();
        res.send(orders);
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

    app.get("/payments", verifyFBToken, async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};
        if (email) {
          query.customerEmail = email;

          if (email !== req.decoded_email) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        const cursor = paymentCollection.find(query).sort({ paidAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/all-books", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const cursor = booksCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const email = user.email;
        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          return res.send({
            existingUserId: existingUser._id,
            message: "user already exists",
          });
        }

        user.createdAt = new Date();
        user.role = "user";

        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/librarians", async (req, res) => {
      try {
        const librarian = req.body;
        librarian.status = "pending";
        librarian.createdAt = new Date();

        const result = await librarianCollection.insertOne(librarian);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/review", async (req, res) => {
      try {
        const review = req.body;
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/wishlist", async (req, res) => {
      try {
        const email = req.query.email;
        const wishlist = req.body;
        wishlist.email = email;
        const result = await wishlistsCollection.insertOne(wishlist);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/books", verifyFBToken, verifyLibrarian, async (req, res) => {
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

    app.patch("/users/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const roleInfo = req.body;
        const query = { _id: new ObjectId(id) };
        const updateUser = {
          $set: {
            role: roleInfo.role,
          },
        };
        const result = await usersCollection.updateOne(query, updateUser);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch("/all-book/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const updateStatus = req.body;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            bookStatus: updateStatus.bookStatus,
          },
        };
        const result = await booksCollection.updateOne(query, update);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch(
      "/librarian/:id",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const status = req.body.status;
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const update = {
            $set: {
              status: status,
            },
          };

          if (status === "approve") {
            const email = req.body.email;
            const userQuery = { email };
            const updateUser = {
              $set: {
                role: "librarian",
              },
            };
            const userResult = await usersCollection.updateOne(
              userQuery,
              updateUser
            );
          }
          const result = await librarianCollection.updateOne(query, update);
          res.send(result);
        } catch (error) {
          console.log(error);
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    );

    app.patch("/book/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const update = req.body;
        const updateBook = {
          $set: {
            bookStatus: update.bookStatus,
          },
        };
        const result = await booksCollection.updateOne(query, updateBook);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch(
      "/books/:id",
      verifyFBToken,
      verifyLibrarian,
      async (req, res) => {
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
      }
    );

    app.patch(
      "/book-update/:id",
      verifyFBToken,
      verifyLibrarian,
      async (req, res) => {
        try {
          const id = req.params.id;
          const update = req.body;
          const query = { _id: new ObjectId(id) };
          const updateBook = {
            $set: {
              status: update.bookStatus,
            },
          };
          const result = await ordersCollection.updateOne(query, updateBook);
          res.send(result);
        } catch (error) {
          console.log(error);
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    );

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

    app.delete("/book/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const book = await booksCollection.findOne(query);

        if (!book) {
          return res.status(404).json({ error: "Book not found" });
        }

        const deleteBookResult = await booksCollection.deleteOne(query);

        const orderQuery = { title: book.title };
        const deleteOrdersResult = await ordersCollection.deleteMany(
          orderQuery
        );

        res.send({
          deletedBook: deleteBookResult,
          deletedOrdersCount: deleteOrdersResult.deletedCount,
        });
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
