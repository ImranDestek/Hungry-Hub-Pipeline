var express = require("express");
var paymentRouter = express.Router();
const nodeCCAvenue = require("node-ccavenue");
const CryptoJS = require("crypto-js");

paymentRouter.post("/request", (req, res, next) => {
  const keys = {
    // working_key: "0F24EA2B350020FE955E1005F938359D",
    working_key: "27799975BF6F28AC6FB68D93C623DCB9",
    // access_code: "AVXT67KE64BN12TXNB",
    access_code: "AVBU32KK67BJ14UBJB",
  };

  const params = {
    order_id: req.body.order_id,
    amount: req.body.amount,
  };

  try {
    const ccav = new nodeCCAvenue.Configure({
      ...keys,
      merchant_id: "2469874",
    });
    const orderParams = {
      redirect_url: encodeURIComponent(
        `http://localhost:3000/api/pay/response?access_code=${keys?.access_code}&working_key=${keys?.working_key}`
      ),
      cancel_url: encodeURIComponent(
        `http://localhost:3000/api/pay/response?access_code=${keys?.access_code}&working_key=${keys?.working_key}`
      ),
      billing_name: "Test User",
      currency: "INR",
      ...params,
    };
    const encryptedOrderData = ccav.getEncryptedOrder(orderParams);

    // console.log(encryptedOrderData);
    res.setHeader("content-type", "application/json");
    res.status(200).json({
      payLink: `https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction&access_code=${keys.access_code}&encRequest=${encryptedOrderData}`,
    });
  } catch (err) {
    next(err);
  }
});

paymentRouter.post("/response", (req, res, next) => {
  try {
    var encryption = req.body.encResp;
    const ccav = new nodeCCAvenue.Configure({
      ...req.query,
      merchant_id: "2469874",
    });
    var ccavResponse = ccav.redirectResponseToJson(encryption);
    var ciphertext = CryptoJS.AES.encrypt(
      JSON.stringify(ccavResponse),
      "Astro"
    ).toString();

    console.log(ccavResponse);
    if (ccavResponse["order_status"] == "Success") {
      console.log("Success");
      res.send("success");
      // res.redirect(`https://imran-blog.hashnode.dev`);
    } else {
      console.log("error");
      res.send("error");
      // res.redirect(`https://imranportfo.netlify.app`);
    }
  } catch (error) {
    next(error);
  }
});

module.exports = paymentRouter;
