const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const port = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

// jsonwebtoken
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "Invalid authorization" });
    }

    const token = authorization.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "Invalid authorization" });
        }
        req.decoded = decoded;
        next();
    });
};

app.get('/',(req,res)=>{
    res.send('social-link server is running')
})

app.listen(port,()=>{
    console.log(`server is running at port: ${port}`);
})