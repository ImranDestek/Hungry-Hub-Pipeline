const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createServer } = require("http");
const { Server } = require("socket.io");
const connectDb = require("./db/connect");
const { errorHandler } = require("./middleware/errorMiddleware");
const port = 3000;
const path = require("path");
const multer = require("multer");
const {
  uploadBannerImage,
  uploadCategoryImage,
  uploadMItemImage,
  uploadRestImage,
} = require("./controllers/uploadImageController");

const app = express();
const httpServer = createServer(app);

connectDb()
  .then((db) => {
    app.locals.db = db;

    httpServer.listen(port, () => {
      console.log(`Server running on port:${port}`);
    });

    const io = new Server(httpServer, {
      cors: {
        origin: "https://master.waayu.app",
        methods: ["GET", "POST"], // Add allowed methods
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      console.log(socket.id);
    });

    const notifyClients = (order) => {
      console.log("called", order);
      io.emit("newOrder", order);
    };

    app.use(express.json());

    const allowedOrigins = [
      "https://master.waayu.app",
      "https://waayupro.in/waayudesk_live/place-orders",
      "https://waayupro.in/waayudesk_live",
      "https://waayupro.in",
      "http://localhost:4200",
      "*",
    ];

    app.use(
      cors({
        origin: function (origin, callback) {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
        optionsSuccessStatus: 204,
      })
    );
    app.use(express.urlencoded({ extended: true }));

    const uploadsFolder = path.join(__dirname, "images");

    // Routes
    app.use("/api/order", require("./routes/orderRoutes"));
    app.use("/api/order-history", require("./routes/orderHistoryRoutes"));
    app.use("/api/user", require("./routes/userRoutes"));
    app.use("/api/menu", require("./routes/menuRoutes"));
    app.use("/api/place-order", require("./routes/placeOrderRoutes"));
    app.use("/api/ayodhya-rest", require("./routes/ayodhyaRestaurantRoutes"));
    app.use("/api/rest", require("./routes/restaurantRoutes"));
    app.use("/api/pay", require("./routes/paymentRoutes"));

    // Uplaod Banner Image
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        return cb(null, "./images/banner");
      },
      filename: function (req, file, cb) {
        const filenameWithoutSpaces = file.originalname.replace(/\s+/g, "");
        return cb(null, `${filenameWithoutSpaces}`);
      },
    });

    const uploadBanner = multer({ storage });

    app.post("/upload-banner", uploadBanner.single("image"), uploadBannerImage);

    // Upload Category Image
    const categoryStorage = multer.diskStorage({
      destination: function (req, file, cb) {
        return cb(null, "./images/category");
      },
      filename: function (req, file, cb) {
        const filenameWithoutSpaces = file.originalname.replace(/\s+/g, "");
        return cb(null, `${filenameWithoutSpaces}`);
      },
    });

    const uploadCategory = multer({ storage: categoryStorage });

    app.post(
      "/upload-category",
      uploadCategory.single("image"),
      uploadCategoryImage
    );

    // Upload MItem Image
    const mItemStorage = multer.diskStorage({
      destination: function (req, file, cb) {
        return cb(null, "./images/mitem");
      },
      filename: function (req, file, cb) {
        const filenameWithoutSpaces = file.originalname.replace(/\s+/g, "");
        return cb(null, `${filenameWithoutSpaces}`);
      },
    });

    const uploadMItem = multer({ storage: mItemStorage });

    app.post("/upload-mitem", uploadMItem.single("image"), uploadMItemImage);

    // Upload Rest Image
    const restStorage = multer.diskStorage({
      destination: function (req, file, cb) {
        return cb(null, "./images/rest");
      },
      filename: function (req, file, cb) {
        const filenameWithoutSpaces = file.originalname.replace(/\s+/g, "");
        return cb(null, `${filenameWithoutSpaces}`);
      },
    });

    const uploadRest = multer({ storage: restStorage });

    app.post("/upload-rest", uploadRest.single("image"), uploadRestImage);

    app.use("/images", express.static(uploadsFolder));

    app.use(errorHandler);

    app.get("/", (_, res) => {
      res.status(200).json({ message: "Waayu Admin API" });
    });

    app.get("/msg", (req, res) => {
      notifyClients("HI FROM SERVER");
      res.send({
        message: "Message from Server",
      });
    });
  })
  .catch((err) => {
    console.error(
      "Failed to connect to the database. Server not started.",
      err
    );

    process.exit(1); // Exit the process with failure
  });
