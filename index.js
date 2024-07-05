// Example express application adding the parse-server module to expose Parse
// compatible API routes.
//const API_URL = 'https://thedriverx.com'
require('dotenv').config();
const PORT = process.env.PORT;
// const API_URL = process.env.SERVER_URL || 'https://hostdev.tk';
const API_URL = process.env.SERVER_URL;
const CustomAuth = require('./CustomAuth');
var express = require("express");
var ParseServer = require("parse-server").ParseServer;
var cron = require("node-cron");
var request = require("request");
var path = require("path");
var S3Adapter = require("@parse/s3-files-adapter");
var AWS = require("aws-sdk");

var databaseUri = process.env.MONGO_DB_URL;

if (!databaseUri) {
  console.log("DATABASE_URI not specified, falling back to localhost.");
}

/**Run cron job every hour for transfer the money*/
cron.schedule("0 * * * *", function () {
  var options = {
    url: `${API_URL}/parse/jobs/transferToAccount`,
    headers: {
      "X-Parse-Application-Id": "71237DFB8FA1D83A3363EB45CF0B4AC7BD44E1EA",
      "X-Parse-Master-Key": "EE1AE6E26B3D99A91968F9D0E2D544E2887A1FF7",
      "Content-Type": "application/json",
    },
  };
  request.post(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
     // console.log(body);
    }
  });
});

/**Check this trial reminder once a day at 6:10pm */
cron.schedule("10 18 * * *", function () {
  var options = {
    url: `${API_URL}/parse/jobs/trialReminder`,
    headers: {
      "X-Parse-Application-Id": "71237DFB8FA1D83A3363EB45CF0B4AC7BD44E1EA",
      "X-Parse-Master-Key": "EE1AE6E26B3D99A91968F9D0E2D544E2887A1FF7",
      "Content-Type": "application/json",
    },
  };
  request.post(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
     // console.log(body);
    }
  });
});

//Configure Digital Ocean Spaces EndPoint
const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACE_ENDPOINT);
var s3Options = {
  bucket: "driverxspace",
  baseUrl: process.env.DO_BASE_URL,
  region: "nyc3",
  directAccess: true,
  globalCacheControl: "public, max-age=31536000",
  bucketPrefix: "",
  s3overrides: {
    accessKeyId: process.env.DO_ACCESS_KEY_ID,
    secretAccessKey: process.env.DO_SECRET_ACCESS_KEY,
    endpoint: spacesEndpoint
  },
};
var s3Adapter = new S3Adapter(s3Options);
var api = new ParseServer({
  databaseURI: databaseUri,
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + "/cloud/main.js",
  appId: process.env.APP_ID ,
  masterKey: process.env.MASTER_KEY, //Add your master key here. Keep it secret!
  serverURL:  `${API_URL}/parse`, // Don't forget to change to https if needed
  allowClientClassCreation: false,
  maxUploadSize: "200mb",
  filesAdapter: s3Adapter,

  push: {
    android: {
      senderId:process.env.ANDROID_SENDER_ID,
      apiKey:process.env.ANDROID_API_KEY
    },
    ios: {
      pfx: __dirname + (process.env.IOS_PFX || "/public/cert/driverxPushCert.p12"),
      topic: process.env.IOS_TOPIC || "com.thedriverx",
      production: true
    },
  },

  verifyUserEmails:  false,
  emailVerifyTokenValidityDuration: 2 * 60 * 60,
  preventLoginWithUnverifiedEmail: false,

  publicServerURL: `${API_URL}/parse/`,
  appName: "theDriverX",
  emailAdapter: {
    module: "@parse/simple-mailgun-adapter",
    options: {
      // The address that your emails come from
      fromAddress: "theDriverX <no-reply@thedriverx.com>",
      // Your domain from mailgun.com
      domain: process.env.MAILGUN_API_DOMAIN,
      // Your API key from mailgun.com
      apiKey: process.env.MAILGUN_API_KEY
    },
  },
  auth: {
    socialAuth: {
      module: CustomAuth,
    }
  }
});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();

// Serve static assets from the /public folder
app.use("/", express.static(path.join(__dirname, "/public")));
process.env.VERBOSE = true;

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || "/parse";
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get("/", function (req, res) {
  res
    .status(200)
    .send(
      "I dream of being a website.  Please star the parse-server repo on GitHub!"
    );
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get("/test", function (req, res) {
  res.sendFile(path.join(__dirname, "/public/test.html"));
});

var port = PORT || 1337;
var httpServer = require("http").createServer(app);
httpServer.listen(port, function () {
  console.log("Parse server running on port " + port + ".");
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
