const keys = require("./keys");

// Express App setup
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres client setup
const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on("error", () => {
  console.log("Lost PG Connection");
});

async function createTable() {
  try {
    await pgClient.query("CREATE TABLE IF NOT EXISTS values (number INT)");
    console.log("Postgres table created");
  } catch (err) {
    console.log("Waiting for Postgres...");
    setTimeout(createTable, 1000);
  }
}
createTable();

// Redis client setup
const redis = require("redis");
const redisClient = redis.createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPort,
    tls: true,
    reconnectStrategy: () => 1000,
  },
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

const redisPublisher = redisClient.duplicate();

(async () => {
  await redisClient.connect();
  await redisPublisher.connect();
})();

// Express routes

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM values");

  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  const values = await redisClient.hGetAll("values");
  res.send(values);
});

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if (index > 40) {
    return res.status(422).send("Index is too high");
  }

  await redisClient.hSet("values", String(index), "nothing yet");

  await redisPublisher.publish("insert", String(index));

  pgClient.query("INSERT INTO values (number) VALUES($1)", [index]);

  res.send({ working: true });
});

app.listen(5000, (err) => console.log("listening on 5000"));
