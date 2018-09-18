const { promisify } = require("util");

const mongoose = require("mongoose");
const AWS = require("aws-sdk");
const uuid = require("node-uuid");
const authenticate = require("mm-authenticate")(mongoose);
const { Script } = require("mm-schemas")(mongoose);
const { send, buffer } = require("micro");

const amqp = require("amqplib");
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://localhost";
const COMPILER_QUEUE = `compilerQueue`;

mongoose.connect(process.env.MONGO_URL);
mongoose.Promise = global.Promise;

const s3 = new AWS.S3({
  params: { Bucket: "mechmania" }
});

const getObject = promisify(s3.getObject.bind(s3));

module.exports = authenticate(async (req, res) => {
  const team = req.user;
  console.log(`${team.name} - Getting the compiled log file from S3`);
  const data = s3
        .getObject({Key: `compiled/${team.latestScript.key}`  })

  send(data, 200, script);
});
