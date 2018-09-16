const { promisify } = require("util");

const mongoose = require("mongoose");
const AWS = require("aws-sdk");
const uuid = require("node-uuid");
const authenticate = require("mm-authenticate")(mongoose);
const { Team, Script } = require("mm-schemas")(mongoose);
const { send, buffer } = require("micro");

const amqp = require("amqplib");
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://localhost";
const COMPILER_QUEUE = `compilerQueue`;

mongoose.connect(process.env.MONGO_URL);
mongoose.Promise = global.Promise;

const s3 = new AWS.S3({
  params: { Bucket: "mechmania" }
});

const upload = promisify(s3.upload.bind(s3));

module.exports = authenticate(async (req, res) => {
  const team = req.user;
  console.log(`${team.name} - Start uploading script`);

  // Pipe file to s3
  const body = await buffer(req, { limit: "10mb" });
  if (!body) {
    return send(res, 400, "No script to push");
  }
  const scriptName = uuid.v4();
  const key = "scripts/" + scriptName;

  console.log(`${team.name} - Upload to s3 (${key})`);
  const data = await upload({
    Key: key,
    Body: body
  });
  console.log(`${team.name} - Uploaded to s3 (${data.Location})`);

  // Add URL to mongo
  console.log(`${team.name} - Add to mongo (${key})`);
  const script = new Script({
    key,
    url: data.Location,
    owner: team.id
  });
  console.log(`${team.name} - Saving script`);
  await script.save();
  console.log(`${team.name} - Added to mongo (${script.id})`);
  team.latestScript = script.id;
  await team.save();
  console.log(`${team.name} - Updated team latestScript (${team.latestScript})`);
  
  console.log(`${team.name} - Notifying ${COMPILER_QUEUE}`);
  const conn = await amqp.connect(RABBITMQ_URI);
  const ch = await conn.createChannel();
  ch.assertQueue(COMPILER_QUEUE, { durable: true });
  ch.sendToQueue(COMPILER_QUEUE, Buffer.from(data.key), { persistent: true });
  console.log(`${team.name} - Notified ${COMPILER_QUEUE}`);

  send(res, 200, script);
});
