const keys = require("./keys");

const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPort,
    tls: true,
    reconnectStrategy: () => 1000,
  },
});

redisClient.on("error", (err) => console.log("Redis Client Error is running", err));

const sub = redisClient.duplicate();

function fib(index) {
  if (index < 2) return 1;
  return fib(index - 1) + fib(index - 2);
}

(async () => {
  await redisClient.connect();
  await sub.connect();

  await sub.subscribe("insert", (message) => {
    redisClient.hSet("values", message, String(fib(parseInt(message))));
  });
})();
