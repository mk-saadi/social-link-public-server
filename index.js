const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

require("dotenv").config();
const port = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

// jsonwebtoken;
const verifyJWT = (req, res, next) => {
	const authorization = req.headers.authorization;
	if (!authorization) {
		return res
			.status(401)
			.send({ error: true, message: "Invalid authorization" });
	}

	const token = authorization.split(" ")[1];

	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			return res
				.status(401)
				.send({ error: true, message: "Invalid authorization" });
		}

		req.decoded = decoded;
		next();
	});
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri =
	"mongodb+srv://social-link:W6VVY3l6WYQYFvQh@cluster0.mrt0xqs.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// await client.connect();

		const usersCollection = client.db("social-link").collection("users");
		const postsCollection = client.db("social-link").collection("posts");

		// >> users
		app.post("/users", async (req, res) => {
			const { name, email, password } = req.body;

			const existingUser = await usersCollection.findOne({
				email: email,
			});

			if (existingUser) {
				return res.status(400).send({ message: "User already exists" });
			}

			const saltRounds = 10;
			bcrypt.hash(password, saltRounds, async (err, hash) => {
				if (err) {
					return res
						.status(500)
						.send({ message: "Password hashing error" });
				}

				const newUser = { name, email, password: hash };

				const result = await usersCollection.insertOne(newUser);
				res.send(result);
			});
		});

		app.post("/users/login", async (req, res) => {
			const { email, password } = req.body;

			const user = await usersCollection.findOne({ email: email });

			if (!user) {
				res.status(401).send({ message: "Login failed" });
			} else {
				bcrypt.compare(
					password,
					user.password,
					async (err, passwordMatch) => {
						if (err || !passwordMatch) {
							res.status(401).send({ message: "Login failed" });
						} else {
							const token = jwt.sign(
								{ email: email },
								process.env.ACCESS_TOKEN_SECRET,
								{
									expiresIn: "30d",
								}
							);
							res.send({ token });
						}
					}
				);
			}
		});

		app.get("/users", async (req, res) => {
			const result = await usersCollection.find().toArray();
			res.send(result);
		});

		// >> post apis
		app.post("/posts", async (req, res) => {
			const post = req.body;
			console.log(post);
			const result = await postsCollection.insertOne(post);
			res.send(result);
		});

		app.get("/posts", async (req, res) => {
			const result = await postsCollection.find().toArray();
			res.send(result);
		});

		app.get("/posts/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await postsCollection.findOne(query);
			res.send(result);
		});

		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("social-link server is running");
});

app.listen(port, () => {
	console.log(`server is running at port: ${port}`);
});
