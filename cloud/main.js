require('dotenv').config();
var api_key = process.env.MAILGUN_API_KEY;
var domain = process.env.MAILGUN_API_DOMAIN;
var mailgun = require("mailgun-js")({ apiKey: api_key, domain: domain });
var moment = require("moment");
var stripe_key=process.env.STRIPE_LIVE_KEY;
const stripe = require("stripe")(stripe_key);
var mailchimp = require('@mailchimp/mailchimp_marketing');
const {response} = require("express");
/**mailchimp setup */

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER || "us1",
});

/**@todo: needs to be updated */
var accountSid = process.env.TWILIO_ACCOUNT_SID; //"AC86d6c5f095fad3f1ae855a0897cc01a8"; // Your Account SID from www.twilio.com/console
var authToken = process.env.TWILIO_AUTH_TOKEN;
var phoneNumberT = process.env.TWILIO_PHONE_NUMBER;//"8f3f08b9a55b3b4c17d632ea4ec9fd29";   // Your Auth Token from www.twilio.com/console

const client = require('twilio')(accountSid, authToken);

Parse.Cloud.define("fetchSchoolPackages", async (request) => {
  // Check if the class exists
  const schema = new Parse.Schema('SchoolPackages');
  try {
    await schema.get(); // This will throw an error if the class does not exist
  } catch (error) {
    console.error("Class does not exist: ", error);
    throw new Parse.Error(101, 'Class SchoolPackage does not exist');
  }

  // Define the SchoolPackage class
  const SchoolPackage = Parse.Object.extend("SchoolPackages");
  
  // Create a query for the SchoolPackage class
  const query = new Parse.Query(SchoolPackage);

  try {
    // Execute the query to fetch all SchoolPackage objects
    const results = await query.find();

    // Map the results to a more readable format if necessary
    const packages = results.map((package) => {
      return {
        id: package.id,
        name: package.get("name"),
        description: package.get("packageDetails"),
        price: package.get("price"),
        // Add other fields as necessary
      };
    });

    // Return the packages in the response
    return {
      packages: packages,
      message: "Successfully fetched SchoolPackages",
      code: 200,
    };
  } catch (error) {
    // Handle any errors
    console.error("Error while fetching SchoolPackages: ", error);
    throw new Parse.Error(error.code || 500, error.message || 'Failed to fetch SchoolPackages');
  }
});


/**Update log in email */
Parse.Cloud.define("pingMailChimp", async (request, response) => {
  await mailchimp.ping.get();
  return { message: "Connected!", code: 200 };
});

Parse.Cloud.define("newSignUpNotification", async (request, response) => {
  /**get it from https://us1.admin.mailchimp.com/lists/settings */
  const listId = process.env.MAILCHIMP_LIST_ID;
  const subscribingUser = {
    firstName: request.params.firstName,
    lastName: request.params.lastName,
    email: request.params.email,
    phone: request.params.phone,
  };
  try {
    const result = await mailchimp.lists.addListMember(listId, {
      email_address: subscribingUser.email,
      status: "subscribed",
      merge_fields: {
        FNAME: subscribingUser.firstName,
        LNAME: subscribingUser.lastName,
        PHONE: subscribingUser.phone,
      },
    });
    return {
      message:
        "Successfully created an audience. The audience id is " + result.id,
      code: 200,
    };
  } catch (e) {
    console.log(JSON.stringify(e));
    return {
      message: "Most likely same contact saved already",
      code: e.status,
    };
  }
});

/**Add contact to an audience */
Parse.Cloud.define("addContactToMailChimp", async (request, response) => {
  /**get it from https://us1.admin.mailchimp.com/lists/settings */
  const listId = process.env.MAILCHIMP_LIST_ID;
  const subscribingUser = {
    firstName: request.params.firstName,
    lastName: request.params.lastName,
    email: request.params.email,
    phone: request.params.phone,
  };
  try {
    const result = await mailchimp.lists.addListMember(listId, {
      email_address: subscribingUser.email,
      status: "subscribed",
      merge_fields: {
        FNAME: subscribingUser.firstName,
        LNAME: subscribingUser.lastName,
        PHONE: subscribingUser.phone,
      },
    });
    return {
      message:
        "Successfully created an audience. The audience id is " + result.id,
      code: 200,
    };
  } catch (e) {
    console.log(JSON.stringify(e));
    return {
      message: "Most likely same contact saved already",
      code: e.status,
    };
  }
});
Parse.Cloud.define("getCountries", async (request, response) => {
  let user = request.params.user;
  const countries = Parse.Object.extend("countries");
  const query = new Parse.Query(countries);
  query.equalTo("code", "US");
  const result = await query.first({ useMasterKey: true });
  console.log(JSON.stringify(result), "params");
  response.json(result);
});

Parse.Cloud.define("addUserToRole", function (request, response) {
  //Parse.Cloud.useMasterKey();
  var userId = new Parse.User({ id: request.params.user });
  var accountName = request.params.accountname;
  var query = new Parse.Query(Parse.Role);
  query.contains("name", accountName);
  query.limit(1);
  query.first().then(function (role) {
    if (role) {
      role.getUsers().add(userId);
      role.save();
      response?.success("Successfully updated the role.");
    } else {
      response.error("error adding user to role " + error);
    }
  });
});

/**Send reminder email to take part of the survey after 7 days */
Parse.Cloud.define("reminder", async (request, response) => {
  if (request.params.email) {
    return new Promise((resolve, reject) => {
      var body = "<p>Hi " + request.params.name + "</p><br>";
      body +=
        "<p>It’s been a fun journey, but unfortunately, we’re coming to the end of your trial period. We’d love to keep this going!</p>";
      body +=
        "<p>In order to continue your DriverX subscription and enjoy the included purpose-built systems designed for your success along with the cutting-edge DriverX student course, you’ll need to select one of our paid plans here.</p>";
      body +=
        "<p>Otherwise, your trial will end in less than 7 days and you won’t be able to access your account any longer.</p>";
      body +=
        "<p>Let us know if you have any questions about our plans or need any assistance!</p>";
      var data = {
        from: "The DriverX<no-reply@thedriverx.com>",
        to: "" + request.params.name + " <" + request.params.email + ">",
        subject: "60 day trial ending soon",
        html: body,
      };
      mailgun.messages().send(data, (error) => {
        if (error) {
          return reject(error);
        }
        return resolve({ message: "Email sent", code: 200 });
      });
    });
  } else {
    return "Email is required.";
  }
});

/**Run this 7 days before the expiring date, to remind Schools that they need to sign up */
Parse.Cloud.job("trialReminder", async (request) => {
  const fiftyThreeDays = moment().utc().subtract(53, "days");

  const User = Parse.Object.extend("User");
  const query = new Parse.Query(User);
  query.equalTo("trial", true);
  query.notEqualTo("reminderEmailSent", true);
  query.lessThanOrEqualTo("trialBegun", new Date(fiftyThreeDays));
  query.limit(10);

  await query.find().then((users) => {
    console.log(users.length);
    if (users.length > 0) {
      const recur_loop = async function (i, response) {
        var num = i || 0;
        if (num < response.length) {
          const data = {
            email: response[num].get("customEmail"),
            name:
              response[num].get("firstName") +
              " " +
              response[num].get("lastName"),
          };
          await Parse.Cloud.run("reminder", data).then(
            (results) => {
              if (results.code === 200) {
                /**Mar the user as welcome email sent */
                var User = Parse.Object.extend("User");
                var saveUser = new User();
                saveUser.id = response[num].id;
                saveUser.set("reminderEmailSent", true);
                saveUser.save(null, { useMasterKey: true }).then(
                  () => {
                    recur_loop(num + 1, users);
                  },
                  () => {
                    recur_loop(num + 1, users);
                  }
                );
              } else {
                recur_loop(num + 1, users);
              }
            },
            (error) => {
              console.log(error);
              recur_loop(num + 1, users);
            }
          );
        } else {
          console.log("All done");
        }
      };
      recur_loop(0, users);
    }
  });
});

Parse.Cloud.define("updateUser", async (request, response) => {
  var User = Parse.Object.extend("User");
  var saveUser = new User();
  saveUser.id = request.params.user;

  saveUser.set("email", request.params.email);
  saveUser.set("customEmail", request.params.email);
  saveUser.set("username", request.params.email);
  saveUser.set("status", request.params.status);
  saveUser.set("firstName", request.params.firstName);
  saveUser.set("lastName", request.params.lastName);
  saveUser.set("profilePicture", request.params.profilePicture);
  saveUser.set("emailVerified", true);
  saveUser.set("profileNotCompleted", request.params.profileNotCompleted);

  await saveUser.save(null, { useMasterKey: true }).then(
    (saveUser) => {
      console.log("Success");
      response.success("User information updated");
    },
    (error) => {
      console.log("Error" + error);
      response.error("Error! " + error.message);
    }
  );
});

Parse.Cloud.define("updateUserStatus", (request, response) => {
  var User = Parse.Object.extend("User");
  var saveUser = new User();
  saveUser.id = request.params.user;
  saveUser.set("status", request.params.status);
  //saveUser.set("independent", request.params.status);
  saveUser.save(null, { useMasterKey: true }).then(
    (saveUser) => {
      response?.success("User information updated");
    },
    (error) => {
      response.error("Error! " + error.message);
    }
  );
});

Parse.Cloud.define("deleteUser", function (request, response) {
  if (request.params.user) {
    var query = new Parse.Query(Parse.User);
    query.get(request.params.user).then(function (user) {
      user.destroy({ useMasterKey: true });
      return "User deleted";
    });
  }
});

/**Get Stripe account link for onboarding information*/
Parse.Cloud.define("getAccountLink", function (request, response) {
  const accountLink = stripe.accountLinks.create({
    account: request.params.accountId,
    refresh_url: request.params.refreshURL,
    return_url: request.params.returnURL,
    type: "account_onboarding",
  });
  return accountLink;
});

/**new user joined */
Parse.Cloud.define("newUserJoined", async (request, response) => {
  if (request.params.name) {
    var body = "<p>Good day Ali!</p>";
    body +=
      "<p>A new user named <b>" +
      request.params.name +
      "</b> with the user type " +
      request.params.type +
      " and has following contact information " +
      request.params.contact +
      " has joined to the DriverX. Please go to admin panel to review details.</p>";
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: "ontariodriverx@gmail.com",
      subject: "New Sign Up!",
      html: body,
    };
    await mailgun.messages().send(data, async (error, body) => {
      return "Email sent!";
    });
  } else {
    return "Email is required.";
  }
});

/** Inform Admin that Client Via Provided City for Road Test  */
Parse.Cloud.define("sendCityToAdminEmail", async (request, response) => {
  if (request.params.name) {
    var body = "<p>Good day Ali!</p>";
    body +=
      "<p>A new user named <b>" +
      request.params.name +
      "</b> with the user type " +
      request.params.type +
      " and has following contact information " +
      request.params.contact +
      " has Provided City for Road Test. </p> " + 
      `<h3>City : ${ request.params.city} </h3>`;
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: "ontariodriverx@gmail.com",
      subject: "User Provided City for Road Test",
      html: body,
    };
    console.log("Data coming  === ", data);
    try {
      await mailgun.messages().send(data, async (error, body) => {
        console.log("Email Sent Success == ", body);
        console.log("Email Sent Error == ", error);
        return "Email sent!";
      });
    } catch (error) {
      console.log("Error in Sending Email = ", error);
      return error
    }
  } else {
    return "Email is required.";
  }
});

/**new school joined */
Parse.Cloud.define("newSchoolJoined", function (request, response) {
  if (request.params.name) {
    var body = "<p>Good day!,</p><br>";
    body +=
      "<p>A new school named " +
      request.params.name +
      " has joined to DriverX. Please go to admin panel to review details.</p>";
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: "ontariodriverx@gmail.com",
      subject: "New School Joined!",
      html: body,
    };
    mailgun.messages().send(data, function (error, body) {
      return "Email sent!";
    });
  } else {
    return "Email is required.";
  }
});

Parse.Cloud.define("accountStatusEmail", async (request, response) => {
  if (request.params.email) {
    if (request.params.status === "Approved") {
      /**First set 60 days trial then email*/
      var User = Parse.Object.extend("User");
      var saveUser = new User();
      saveUser.id = request.params.associatedId;
      saveUser.set("trial", true);
      saveUser.set("trialBegun", new Date());
      await saveUser.save(null, { useMasterKey: true }).then(
        async (saveUser) => {
          //var status = request.params.status;
          var body = "<p>Hello,</p><br>";
          body +=
            "<p>Welcome to DriverX – innovating the way schools, students and instructors connect.</p>";
          body +=
            "<p>With DriverX you’ll easily be able to manage clients, instructors, and, bookings as well as track payments, issue certificates and communicate instantly, all through one system.</p>";
          body +=
            "<p>We’re excited for you to try DriverX, free for 60 days, and take advantage of purpose-built systems, specifically designed for your success.</p>";
          body +=
            "<p>To get started with simply <a href='https://school.thedriverx.com/' target='_blank'>click here</p>";
          body += "<p>We hope you enjoy everything DriverX has to offer!</p>";
          var data = {
            from: "The Driver X<no-reply@thedriverx.com/>",
            to: request.params.email,
            subject: "Driver X Account",
            html: body,
          };
          await mailgun.messages().send(data, function (error, body) {
            return "Email sent!";
          });
          response.success("Instructor information updated");
        },
        function (error) {
          response.error("Error! " + error.message);
        }
      );
    } else {
      var status = request.params.status;
      var body = "<p>Good day!,</p><br>";
      status = status == true ? "Approved" : "Declined";
      body += "<p>Your account has been " + status + "</p>";
      var data = {
        from: "The Driver X<no-reply@thedriverx.com/>",
        to: request.params.email,
        subject: "Driver X Account",
        html: body,
      };
      mailgun.messages().send(data, function (error, body) {
        return "Email sent!";
      });
    }
  } else {
    return "Email is required.";
  }
});

/**When school gets certificate request */
Parse.Cloud.define("certificateRequest", async (request, response) => {
  if (request.params.email) {
    var body = "<p>Hello,</p><br>";
    body +=
      "<p>" +
      request.params.studentName +
      " has requested their driving certificate. To view the student’s profile and issue the certificate, please go to admin panel and click on manage certificates from left menu.</p>";
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: request.params.email,
      subject: "Certificate request",
      html: body,
    };
    await mailgun.messages().send(data, function (error, body) {
      return "Email sent!";
    });
  } else {
    return "Email is required.";
  }
});

/**Send decline email*/
Parse.Cloud.define("declineEmail", async (request, response) => {
  if (request.params.email) {
    var body = "<p>Good day " + request.params.name + ",</p><br>";
    body +=
      "<p>Your appointment with " +
      request.params.senderName +
      " on <strong>" +
      request.params.date +
      "</strong> has been declined. Note from the sender: <b>" +
      request.params.note +
      "</b></p>";
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: request.params.email,
      subject: "Appointment changed!",
      html: body,
    };
    await mailgun.messages().send(data, function (error, body) {
      return "Email sent!";
    });
  } else {
    return "Email is required.";
  }
});

/**Send decline email*/
Parse.Cloud.define("approvedEmail", async (request, response) => {
  if (request.params.email) {
    var body = "<p>Good day " + request.params.name + ",</p><br>";
    body +=
      "<p>Your appointment with " +
      request.params.senderName +
      " on <strong>" +
      request.params.date +
      "</strong> has been approved. Note from the sender: <b>" +
      request.params.note +
      "</b></p>";
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: request.params.email,
      subject: "Appointment approved!",
      html: body,
    };
    await mailgun.messages().send(data, function (error, body) {
      return "Email sent!";
    });
  } else {
    return "Email is required.";
  }
});

Parse.Cloud.define("cancelSubEmail", async (request, response) => {
  if (request.params.email) {
    var body = "<p>Good day " + request.params.name + ",</p><br>";
    body +=
      "<p>The driving school your account is associated with " +
      request.params.schoolName +
      " has cancelled their subscription with DriverX. As a result, your associated with the school no longer exist. However, you are still with Driver X as an independent instructor. We highly recommend you to go to your profile and associate yourself with a new school to continue the maximum benefit from Driver X.</b></p>";
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: request.params.email,
      subject: "Your Driving School Unsubscribed!",
      html: body,
    };
    await mailgun.messages().send(data, function (error, body) {
      return "Email sent!";
    });
  } else {
    return "Email is required.";
  }
});

/**Welcome email*/
Parse.Cloud.define("sendWelcomeEmail", function (request, response) {
  if (request.params.email) {
    var body = "<p>Good day " + request.params.name + ",</p><br>";
    body +=
      "<p>Welcome to Sign N Drive, your account has been successfully created! Please login to start your application for the purchase of your Vehicle</p>";
    body +=
      "<p>Once signed in you will be assigned a Finance Manager and will be able to Apply, Choose Appointment Date, Choose your Vehicle, Sign your Documents, Upload your Documents, Chat with the Finance Manager, See your Loan Status, etc.</p>";

    body +=
      "<br><p>If you have any questions please do not hesitate to contact us as 416-993-7483, or email us at info@signndrive.ca.</p>";
    body += "<p>Sincerely,</p><br>";
    body += "<p>Ash Alli</p>";
    body += "<p>President</p><br><br>";
    body +=
      "<small>The information contained in this e-mail (including any attachments) is intended only for the personal</small><br>";
    body +=
      "<small>and confidential use of the recipient(s) named above. If you are not an intended recipient of this message, please notify the sender by replying to this message and then delete the message and any copies from your system. Any use, dissemination, distribution, or reproduction of this message by unintended recipients, is not authorised and may be unlawful.</small>";
    /*
     From email will change in future
     */
    var data = {
      from: "Sign n Drive <info@signndrive.ca>",
      to: request.params.email,
      subject: "Welcome to Sign N Drive!",
      html: body,
    };
    mailgun.messages().send(data, function (error, body) {
      return "Email sent!";
    });
  } else {
    return "Email is required.";
  }
});

Parse.Cloud.define("instructorStatus", function (request, response) {
  var User = Parse.Object.extend("User");
  var saveUser = new User();
  saveUser.id = request.params.user;
  saveUser.set("independent", userStatus);
  saveUser.save(null, { useMasterKey: true }).then(
    function (saveUser) {
      response.success("Instructor information updated");
    },
    function (error) {
      response.error("Error! " + error.message);
    }
  );
});

/**Products/plan list from stripe account
 * let's load products, corresponding prices
 * and send it to the front
 * https://stripe.com/docs/api/products/list?lang=node
 */
Parse.Cloud.define("getPlanList", function (request, response) {
  const products = stripe.products.list({
    limit: 3,
    active: true,
  });
  return products;
});

/**With product ID */
Parse.Cloud.define("getPriceByProduct", function (request, response) {
  const prices = stripe.prices.list({
    product: request.params.product,
    limit: 1,
  });
  return prices;
});

/**Get product details with product ID */
Parse.Cloud.define("getProductDetails", function (request, response) {
  const product = stripe.products.retrieve(request.params.product);
  return product;
});

/**Create customer */
Parse.Cloud.define("createStripeCustomer", function (request, response) {
  const customer = stripe.customers.create({
    email: request.params.email,
  });
  return customer;
});

/**Create customer secret */
Parse.Cloud.define("createCustomerSecret", function (request, response) {
  const secret = stripe.setupIntents.create({
    customer: request.params.customerId,
  });
  return secret;
});

/**Get current payment methods list */
Parse.Cloud.define("getPaymentMethodList", function (request, response) {
  const paymentMethods = stripe.paymentMethods.list({
    customer: request.params.customerId,
    type: "card",
  });
  return paymentMethods;
});

/**Get current payment method details */
Parse.Cloud.define("getPaymentMethodDetails", function (request, response) {
  const paymentMethod = stripe.paymentMethods.retrieve(
    request.params.paymentMethodId
  );
  return paymentMethod;
});

/**Charge student for package purchase on their saved card */
Parse.Cloud.define("chargeCardForSchoolPackage", async (request, response) => {
  try {
    await stripe.paymentMethods.attach(request.params.paymentMethodId, {
      customer: request.params.customerId,
    });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: request.params.amount,
      currency: "cad",
      customer: request.params.customerId,
      payment_method: request.params.paymentMethodId,
      application_fee_amount: request.params.fee,
      off_session: request.params.offSeason,
      transfer_data: {
        destination: request.params.ownerAccountId,
      },
      confirm: true,
    });
    return paymentIntent;
  } catch (err) {
    // Error code will be authentication_required if authentication is needed
    console.log("Error code is: ", err.code);
    const paymentIntentRetrieved = stripe.paymentIntents.retrieve(
      err.raw.payment_intent.id
    );
    console.log("PI retrieved: ", paymentIntentRetrieved.id);
    return response.status("402").send({ error: { message: err.message } });
  }
});

/**Charge student on their saved card when instructor mark appmnt as finished */
Parse.Cloud.define("chargeCardForAppointment", async (request, response) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: request.params.amount,
      currency: "cad",
      customer: request.params.customerId,
      payment_method: request.params.paymentMethodId,
      //application_fee_amount: request.params.fee,
      off_session: request.params.offSeason,
      transfer_group: request.params.transfer_group,
      // transfer_data: {
      //   destination: request.params.ownerAccountId,
      // },
      confirm: true,
    });
    return paymentIntent;
  } catch (err) {
    // Error code will be authentication_required if authentication is needed
    console.log("Error code is: ", err.code);
    const paymentIntentRetrieved = stripe.paymentIntents.retrieve(
      err.raw.payment_intent.id
    );
    console.log("PI retrieved: ", paymentIntentRetrieved.id);
    return response.status("402").send({ error: { message: err.message } });
  }
});

/**Transfer the money to school and instructor*/
//ref: https://stripe.com/docs/connect/charges-transfers
// Parse.Cloud.define("transferMoney", function (request, response) {
//   try {
//     const transfer = stripe.transfers.create({
//       amount: request.params.amount,
//       currency: "cad",
//       destination: request.params.ownerAccountId,
//       transfer_group: request.params.transfer_group,
//     });
//     return transfer;
//   } catch (err) {
//     // Error code will be authentication_required if authentication is needed
//     console.log("Error code is: ", err.code);
//     const paymentIntentRetrieved = stripe.paymentIntents.retrieve(
//       err.raw.payment_intent.id
//     );
//     console.log("PI retrieved: ", paymentIntentRetrieved.id);
//     return response.status("402").send({ error: { message: err.message } });
//   }
// });

Parse.Cloud.define("transferMoney", async (request, response) => {
  try {
    const transfer = await stripe.transfers.create({
      amount: request.params.amount,
      currency: "cad",
      destination: request.params.ownerAccountId,
      transfer_group: request.params.transfer_group,
    });
    return transfer;
  } catch (err) {
    // Error code will be balance_insufficient if balance is insufficient
    console.log("Error code is: ", err.code);

    // if (err.raw && err.raw.payment_intent && err.raw.payment_intent.status) {
    //   const paymentIntentStatus = err.raw.payment_intent.status;
    //   console.log("PaymentIntent status: ", paymentIntentStatus);
    // }
    console.log(JSON.stringify(response));
    return response.status(402).send({ error: { message: err.message } });
  }
});


/**Create stripe user account to receive payout and money */
Parse.Cloud.define("createStripeAccount", function (request, response) {
  const account = stripe.accounts.create({
    type: "express",
    country: "CA",
    email: request.params.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  return account;
});

/**Get stripe user account */
Parse.Cloud.define("getStripeUserAccount", function (request, response) {
  const account = stripe.accounts.retrieve(request.params.ownerAccountId);
  return account;
});

/**Create subscription */
Parse.Cloud.define("createSubscription", async (request, response) => {
  try {
    console.log(request.params);
    /**this is  issue, previously attaching default_payment_method worked but now only attaching token works*/
    await stripe.customers.createSource(request.params.customerId, {
      source: request.params.token,
    });

    // await tripe.paymentMethods.attach(request.params.paymentMethodId, {
    //   customer: request.params.customerId,
    // });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: request.params.customerId,
      items: [{ price: request.params.priceId }],
      expand: ["latest_invoice.payment_intent"],
    });
    return subscription;
  } catch (error) {
    return response.status("402").send({ error: { message: error.message } });
  }
});

/**Get Stripe subscription*/
Parse.Cloud.define("getSubscription", function (request, response) {
  const subscription = stripe.subscriptions.retrieve(
    request.params.subscriptionId
  );
  return subscription;
});

/**Get Stripe subscription*/
Parse.Cloud.define("cancelSubscription", function (request, response) {
  const deleted = stripe.subscriptions.del(request.params.subscriptionId);
  return deleted;
});

/**Run cron job to execute pending transfer for instructor and school*/
Parse.Cloud.job("transferToAccount", async (request) => {
  const today = moment();
  const transfers = Parse.Object.extend('transfers');
  const query = new Parse.Query(transfers);
  query.notEqualTo('transferred', true);
  query.lessThanOrEqualTo('maturityDate', today.toDate());
  query.limit(5);
  query.descending('createdAt');
  query.include('appointmentId.studentId');
  const balance = await stripe.balance.retrieve();
  try {
    const results = await query.find({ useMasterKey: true });
    if (results.length > 0) {
      const recur_loop = async (i) => {
        const num = i || 0;
        if (num < results.length && balance["available"][0]["amount"] > (results[i].get('amount') * 100)) {
          const sData = {
            amount: results[i].get('amount') * 100,
            ownerAccountId: results[i].get('ownerAccountId'),
            transfer_group: results[i].get('transfer_group'),
          };
          try {
            const result = await Parse.Cloud.run('transferMoney', sData);
            if (result) {
              const transfers = Parse.Object.extend('transfers');
              const savetransfers = new transfers();
              savetransfers.id = results[i].id;
              savetransfers.set('transferred', true);
              await savetransfers.save();

              const PaymentHistories =
                Parse.Object.extend('PaymentHistories');
              const savePaymentHistories = new PaymentHistories();

              const User = Parse.Object.extend('User');
              const UserPointerId = new User();
              UserPointerId.id = results[i].get('receiverId').id;
              savePaymentHistories.set('receiverId', UserPointerId);

              const SenderPointerId = new User();
              SenderPointerId.id = results[i]
                .get('appointmentId')
                .get('studentId').id;
              savePaymentHistories.set('senderId', SenderPointerId);

              savePaymentHistories.set('amount', results[i].get('amount'));
              savePaymentHistories.set(
                'associaatedId',
                results[i].get('appointmentId').id
              );
              savePaymentHistories.set(
                'stripePaymentId',
                results[i].get('stripePaymentId')
              );
              savePaymentHistories.set(
                'notes',
                'Ran cron job to transfer the money'
              );
              savePaymentHistories.set('type', ['appointment']);
              savePaymentHistories.set('paymentDate', new Date(moment()));
              savePaymentHistories.set('status', true);

              await savePaymentHistories.save();
              await recur_loop(num + 1);
            }
          } catch (error) {
            console.log(error);
          }
        } else {
          console.log('Fully done');
        }
      };

      await recur_loop(0);
    }
  } catch (error) {
    console.log(error);
  }

});

/**find the school email then send instructor joining email*/
Parse.Cloud.define("instructorJoinedEmail", async (request, response) => {
  if (request.params.schoolId) {
    const Schools = Parse.Object.extend("Schools");
    const query = new Parse.Query(Schools);
    query.equalTo("objectId", request.params.schoolId);
    query.include("associatedId");
    const result = await query.first({ useMasterKey: true });
    if (result) {
      var body = "<p>Good day!,</p><br>";
      body +=
        "<p>An instructor, " +
        request.params.instructorName +
        " with the email " +
        request.params.instructorEmail +
        " has been added under your school. Please log in in to the admin panel to view details.</p>";
      var data = {
        from: "The Driver X<no-reply@thedriverx.com/>",
        to: result.get("associatedId").get("email"),
        subject: "New Instructor Joined",
        html: body,
      };
      mailgun.messages().send(data, function (error, body) {
        console.log(JSON.stringify(error));
        return "Email sent!";
      });
    } else {
      response.error("No record found");
    }
  } else {
    response.error("No valid email");
  }
});

Parse.Cloud.define("newAppointmentEmail", async (request, response) => {
  if (request.params.email) {
    var body = "<p>Good day!</p><br>";
    body +=
      "<p>You have received a new lesson booking " +
      " from " +
      request.params.requesterName +
      ". To view and confirm the booking please log in to your app.</p>";
    var data = {
      from: "The Driver X<no-reply@thedriverx.com/>",
      to: request.params.email,
      subject: "New Appointment",
      html: body,
    };
    mailgun.messages().send(data, (error, body) => {
      console.log(JSON.stringify(error));
      return "Email sent!";
    });
  } else {
    response.error("No valid email");
  }
});

/**Send push notification*/
Parse.Cloud.define("sendPush", function (request, response) {
  if (request.params.include_player_ids) {
    var jsonBody = {
      app_id: "c516ce91-22fd-4478-ab5d-a0f8064ba80b",
      //included_segments: ["All"],
      include_player_ids: [request.params.include_player_ids],
      headings: { en: request.params.heading },
      contents: { en: request.params.message },
      data: {
        type: request.params.type,
        id: request.params.senderId,
      },
      thread_id: request.params.thread_id,
      android_group: request.params.android_group,
    };
    Parse.Cloud.httpRequest({
      url: "https://onesignal.com/api/v1/notifications",
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Authorization: "Basic NTdiNTExZmEtY2UxYy00OWYxLWFkOTctNTdkMTA3N2MzZDBi",
      },
      body: JSON.stringify(jsonBody),
      success: function (httpResponse) {
        response.success("sent");
      },
      error: function (httpResponse) {
        response.error("Failed with: " + httpResponse.status);
      },
    });
  }
});

/**Send SMS to a customer */
Parse.Cloud.define("sendSMS", async (request, response) => {
  var getMessage = request.params.message,
    getPhoneTo = "+16474592887",
    getPhoneFrom = process.env.TWILIO_PHONE_NUMBER;

  await client.messages
    .create({
      body: getMessage, // Any number Twilio can deliver to
      from: getPhoneFrom, // A number you bought from Twilio and can use for outbound communication
      to: getPhoneTo, // body of the SMS message
    })
    .then(function (results) {
      response.success(results);
    })
    .catch(function (error) {
      response.error(error);
    });
});

/**Send SMS to a customer */
Parse.Cloud.define("sendAppointmentSMS", async (request, response) => {
    const getMessage = request.params.message;
    const getPhoneTo = request.params.to;

    const data = {
      body: getMessage,
      from : phoneNumberT,
      to : getPhoneTo
    }
    console.log("Daat  === ", data );
    try{
      console.log(data,'data')
      await client.messages
          .create(data)
          .then(message => {
            console.log("@@@@---MSG SENT----@@@s" ,message.sid);
          });
    } catch (e) {
      console.log(e,'Error')
    }
    return {
      success: true,
      message:'sent'
    }
});

Parse.Cloud.define('phone-number-verification',async (request, response) => {
  const phoneNumber = request.params.phone;
  const PhoneVerification = Parse.Object.extend("PhoneVerification");
  const query = new PhoneVerification();
  const  code  = Math.floor(Math.random()*90000) + 10000;
  query.set('phone',phoneNumber)
  query.set('code',code)
  query.set('is_used',0)
  const acl = new Parse.ACL()
  acl.setPublicReadAccess(true)
  acl.setPublicWriteAccess(true)
  query.setACL(acl)
  let messageId = ''
  await query.save({}, { useMasterKey: true }).then(async (res) => {

    const data = {
      body: `Phone Number verification code : ${code}`,
      from : phoneNumberT,
      to : `${phoneNumber}`
    }
    console.log("Daat  === ", data );
    try{
      console.log(data,'data')
      await client.messages
          .create(data)
          .then(message => {
            messageId = message.sid
          });
    } catch (e) {
      console.log(e,'Error')
    }
  })
  return {
    success: true,
    data: {
      messageId:messageId
    },
    message:'sent'
  }

});

Parse.Cloud.define('verifyPhoneNumber',async (request, response) => {
  const phoneNumber = request.params.phone;
  const code = request.params.code;
  let status = false
  let message = ''
  let isValid = false
  if (phoneNumber === '') {
    message = 'Phone number is required'
    status = false
    isValid = true
  }
  if (code === '') {
    message = 'OTP code is required'
    status = false
    isValid = true
  }
  if (isValid){
    return {
      success: status,
      data:data,
      message:message
    }
  }

  const PhoneVerification = Parse.Object.extend("PhoneVerification");
  const query = new Parse.Query(PhoneVerification);
  query.equalTo('phone',phoneNumber)
  query.equalTo('code',Number(code))
  query.equalTo('is_used',0)
  let data = {};
  await query.first()
      .then(async (res)=>{
        console.log(res,'res')
        if (res !== undefined){
          data.id = res.id
          status = true
          res.set('is_used', 1)
          res.save({}, { useMasterKey: true })
        }
        else{
          message = 'Invalid OTP Code.'
          status = false
        }
      },(error) => {
        message = 'Invalid OTP Code.'
        status = false
        data.id = ''
      })
  return {
    success: status,
    data:data,
    message:message
  }
});



