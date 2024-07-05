// Example express application adding the parse-server module to expose Parse
// compatible API routes.
//const API_URL = 'https://thedriverx.com'
const PORT = 3000
const API_URL = 'https://hostdev.tk'
const CustomAuth = require('./CustomAuth');
var express = require("express");
var ParseServer = require("parse-server").ParseServer;
var cron = require("node-cron");
var request = require("request");
var path = require("path");
var S3Adapter = require("@parse/s3-files-adapter");
var AWS = require("aws-sdk");

var databaseUri =
    "mongodb+srv://dxuser:ClczLNKeXsoF0ulP@thedriverxclustoer.caao5.mongodb.net/dxdb_dev?retryWrites=true&w=majority";

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
            console.log(body);
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
            console.log(body);
        }
    });
});

//Configure Digital Ocean Spaces EndPoint
const spacesEndpoint = new AWS.Endpoint("https://nyc3.digitaloceanspaces.com");
var s3Options = {
    bucket: "driverxspace",
    baseUrl: "https://driverxspace.nyc3.digitaloceanspaces.com",
    region: "nyc3",
    directAccess: true,
    globalCacheControl: "public, max-age=31536000",
    bucketPrefix: "",
    s3overrides: {
        accessKeyId: "4WK65K5Z7J6IG4X3WJKR",
        secretAccessKey: "ZAqEjm6xWdXSip9nfY1WrFXPijd6z5I8O590pFH7JTE",
        endpoint: spacesEndpoint,
    },
};
var s3Adapter = new S3Adapter(s3Options);

var api = new ParseServer({
    databaseURI: databaseUri,
    cloud: process.env.CLOUD_CODE_MAIN || __dirname + "/cloud/main.js",
    appId: process.env.APP_ID || "71237DFB8FA1D83A3363EB45CF0B4AC7BD44E1EA",
    masterKey: process.env.MASTER_KEY || "EE1AE6E26B3D99A91968F9D0E2D544E2887A1FF7", //Add your master key here. Keep it secret!
    serverURL: process.env.SERVER_URL || `${API_URL}/parse`, // Don't forget to change to https if needed
    allowClientClassCreation: false,
    maxUploadSize: "200mb",
    filesAdapter: s3Adapter,

    push: {
        android: {
            senderId: "814141650586",
            apiKey:
                "AAAAvY6ftpo:APA91bHugZSm4oNsKaDrdAWGacVB1dZ7-QImtsO3xQ9gfip_s7dvmEJtfNgP6ylG3MR2oG72GUjXmibtV49CaQZwqY9qIyfriCYe7lgeyLIKf-i6aa1zTjIRVRrMO4a_7O4WzXbLBhIJ",
        },
        ios: {
            pfx: __dirname + "/public/cert/driverxPushCert.p12",
            topic: "com.thedriverx",
            production: true,
        },
    },

    verifyUserEmails: true,
    emailVerifyTokenValidityDuration: 2 * 60 * 60,
    preventLoginWithUnverifiedEmail: true,

    publicServerURL: `${API_URL}/parse/`,
    appName: "theDriverX",
    emailAdapter: {
        module: "@parse/simple-mailgun-adapter",
        options: {
            // The address that your emails come from
            fromAddress: "theDriverX <no-reply@thedriverx.com>",
            // Your domain from mailgun.com
            domain: "mg.thedriverx.com",
            // Your API key from mailgun.com
            apiKey: "536219bb7310c7f4f7423061fdb705dd-7cd1ac2b-75d4b13a",
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

var port = process.env.PORT || PORT;
var httpServer = require("http").createServer(app);
httpServer.listen(port, function () {
    console.log("Parse server running on port " + port + ".");
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
