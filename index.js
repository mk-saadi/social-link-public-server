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
		const followCollection = client.db("social-link").collection("follow");

		/* ------------------------------ users -------------------------------- */
		app.post("/users", async (req, res) => {
			const { name, userName, image, email, isVerified, password } =
				req.body; // remember to put "image" in the value

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

				const newUser = {
					name,
					userName,
					image,
					email,
					isVerified,
					password: hash,
				};

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
			let query = {};

			if (req.query?.name) {
				query.name = {
					$regex: req.query.name,
					$options: "i",
				};
			}
			const result = await usersCollection.find(query).toArray();
			res.send(result);
		});

		/* ------------------------------ post -------------------------------- */
		postsCollection.createIndex({
			createdAt: 1,
			expireAfterSeconds: 2592000,
		});

		const deleteAdminExpiredPosts = async () => {
			const thirtyDaysAgo = new Date(
				Date.now() - 30 * 24 * 60 * 60 * 1000
			);
			const expiredPosts = await postsCollection
				.find({
					createdAt: {
						$lt: thirtyDaysAgo,
					},
				})
				.toArray();

			for (const post of expiredPosts) {
				await postsCollection.deleteOne({ _id: post._id });
			}
		};

		setInterval(deleteAdminExpiredPosts, 86400000);

		app.post("/posts", async (req, res) => {
			const post = req.body;
			post.createdAt = new Date();
			const result = await postsCollection.insertOne(post);
			res.send(result);
		});

		app.get("/posts", async (req, res) => {
			const result = await postsCollection.find().toArray();
			res.send(result);
		});

		app.patch("/posts/like/:postId", verifyJWT, async (req, res) => {
			try {
				const postId = req.params.postId;
				const userDisplayName = req.body.user.displayName; // Extract the user's displayName from the request body

				console.log(
					"postId",
					"userDisplayName",
					postId,
					userDisplayName
				);
				// Check if the user's displayName is already included in the likedBy array
				const found = await postsCollection.findOne({
					_id: new ObjectId(postId),
					likedBy: { $in: [userDisplayName] },
				});

				if (!found) {
					// The user has not liked the post before, so increment the likes count and push the user's displayName to the likedBy array
					const result = await postsCollection.updateOne(
						{ _id: new ObjectId(postId) },
						{
							$inc: { likes: 1 },
							$push: { likedBy: userDisplayName },
						}
					);
					res.send(result);
				} else {
					// The user has already liked the post, so do nothing
					res.status(400).json({
						message: "You have already liked this post",
					});
				}
			} catch (error) {
				console.error("Error incrementing likes:", error);
				res.status(500).json({ message: "Internal server error" });
			}
		});

		app.get("/posts/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await postsCollection.findOne(query);
			res.send(result);
		});

		/* ------------------------------ follow -------------------------------- */
		app.post("/follow", async (req, res) => {
			const followData = req.body;
			const userId = followData.followerId;

			// Check if the userId matches the followerId in the database.
			const followDataDocument = await followCollection.findOne({
				followerId: userId,
			});

			// If the follow data document does not exist, then create a new one.
			if (!followDataDocument) {
				await followCollection.insertOne(followData);
			} else {
				// Check if the new ID already exists in the followingIds array.
				const alreadyFollowing =
					followDataDocument.followingIds.includes(
						followData.followingIds[0]
					);

				// If the new ID does not already exist in the followingIds array, then add it.
				if (!alreadyFollowing) {
					followDataDocument.followingIds.push(
						followData.followingIds[0]
					);

					// Update the follow data document in the database.
					await followCollection.replaceOne(
						{ followerId: userId },
						followDataDocument
					);
				}

				// Return a success message to the client.
				res.send({ success: true });
			}
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
