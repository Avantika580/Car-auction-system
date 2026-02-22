const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3017;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());
app.use(session({
  secret: "autobid_secret",
  resave: false,
  saveUninitialized: true
}));

// Multer (image upload config)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// MySQL setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Admin@123",
  database: "autobid"
});
db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL Connected");
});

// Static pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "public/signup.html")));
app.get("/session-info", (req, res) => res.json(req.session.user || null));
app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login.html")));

// Signup
app.post("/signup", (req, res) => {
  const { username, password, role } = req.body;
  if (!["buyer", "seller"].includes(role)) return res.redirect("/signup.html?error=invalid");

  db.query("SELECT * FROM users WHERE username = ?", [username], (err, result) => {
    if (result.length > 0) return res.redirect("/signup.html?error=exists");
    const hash = bcrypt.hashSync(password, 10);
    db.query("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, role], () =>
      res.redirect("/signup.html?success=1")
    );
  });
});

// Login
app.post("/login", (req, res) => {
  const { username, password, role } = req.body;
  db.query("SELECT * FROM users WHERE username = ? AND role = ?", [username, role], (err, users) => {
    if (!users.length || !bcrypt.compareSync(password, users[0].password)) {
      return res.redirect("/login.html?error=1");
    }
    req.session.user = { id: users[0].id, username, role };
    if (role === "admin") return res.redirect("/admin.html");
    if (role === "buyer") return res.redirect("/index.html");
    if (role === "seller") return res.redirect("/seller.html");
  });
});

// Add Car
app.post("/add-car", upload.array("images"), (req, res) => {
  const { showroom_name, location, brand, model, year, price, description } = req.body;
  const sellerId = req.session.user.id;
  const images = req.files.map(file => "/uploads/" + file.filename).join(",");
  const auctionEnd = new Date();
  auctionEnd.setDate(auctionEnd.getDate() + 3);

  db.query("SELECT id FROM showrooms WHERE name = ?", [showroom_name], (err, result) => {
    if (err) return res.sendStatus(500);
    const insertCar = (showroomId) => {
      db.query(
        `INSERT INTO cars (brand, model, year, price, description, seller_id, status, images, showroom_id, auction_end, is_live)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, FALSE)`,
        [brand, model, year, price, description, sellerId, images, showroomId, auctionEnd],
        () => res.redirect("/seller.html")
      );
    };
    if (result.length) insertCar(result[0].id);
    else {
      db.query("INSERT INTO showrooms (name, location) VALUES (?, ?)", [showroom_name, location], (e2, r2) => {
        if (e2) return res.sendStatus(500);
        insertCar(r2.insertId);
      });
    }
  });
});

// Admin Approval
app.post("/admin/approve-car", (req, res) => {
  db.query("UPDATE cars SET status = 'approved', is_live = TRUE WHERE id = ?", [req.body.carId], () => res.sendStatus(200));
});
app.post("/admin/reject-car", (req, res) => {
  db.query("UPDATE cars SET status = 'rejected' WHERE id = ?", [req.body.carId], () => res.sendStatus(200));
});

// Fetch Cars
app.get("/cars", (req, res) => {
  db.query(`
    SELECT c.*, s.name AS showroom_name, s.location
    FROM cars c
    JOIN showrooms s ON c.showroom_id = s.id
    WHERE c.status = 'approved'`,
    (err, cars) => {
      if (err) return res.sendStatus(500);
      res.json(cars);
    });
});

// Fetch bids for a car
app.get("/api/bids/:carId", (req, res) => {
  db.query("SELECT username, amount, time FROM bids WHERE car_id = ? ORDER BY id DESC", [req.params.carId], (err, bids) => {
    if (err) return res.sendStatus(500);
    res.json(bids);
  });
});

// Save a bid (user or system)
app.post("/api/bid", (req, res) => {
  const { carId, amount, username, isSystem } = req.body;
  const buyerId = isSystem ? null : req.session?.user?.id;
  if (!carId || !amount || !username) return res.status(400).send("Missing fields");

  db.query(
    `INSERT INTO bids (car_id, buyer_id, username, amount, time) VALUES (?, ?, ?, ?, NOW())`,
    [carId, buyerId, username, amount],
    (err) => {
      if (err) {
        console.error("Bid insert error:", err);
        return res.sendStatus(500);
      }
      res.sendStatus(200);
    }
  );
});

// Auto-close auctions every 60 seconds
setInterval(() => {
  db.query(`
    UPDATE cars 
    SET is_live = FALSE, status = 'closed', winner_id = (
      SELECT buyer_id FROM bids WHERE car_id = cars.id ORDER BY amount DESC LIMIT 1
    )
    WHERE auction_end < NOW() AND status = 'approved'`, (err) => {
    if (!err) console.log("🔔 Closed ended auctions");
  });
}, 60000);

// Socket.IO Bidding
io.on("connection", (socket) => {
  socket.on("joinRoom", (carId) => socket.join(`car_${carId}`));

  socket.on("newBid", ({ carId, amount, username }) => {
    const bid = { carId, amount, username, time: new Date() };
    io.to(`car_${carId}`).emit("bidUpdate", bid); // Notify all in room
    io.emit("bidUpdate", bid); // Also for admin/global
  });
});

// Start server
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
