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
		const saveCollection = client.db("social-link").collection("savePost");
		const followCollection = client.db("social-link").collection("follow");
		const storyCollection = client.db("social-link").collection("story");
		const reportCollection = client.db("social-link").collection("report");
		const blockCollection = client.db("social-link").collection("block");
		const aboutCollection = client.db("social-link").collection("about");
		const blogsCollection = client.db("social-link").collection("blogs");
		const hideCollection = client.db("social-link").collection("hide");
		const feedbackCollection = client
			.db("social-link")
			.collection("feedback");
		const commentsCollection = client
			.db("social-link")
			.collection("comments");

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
					createdAt: new Date(),
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

			if (req.query?.userName) {
				query.userName = {
					$regex: req.query.userName,
					$options: "i",
				};
			}

			const result = await usersCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/users/:userName", async (req, res) => {
			const username = req.params.userName;
			console.log(username);

			const query = { userName: username };

			const result = await usersCollection.findOne(query);

			res.send(result);
		});

		app.delete("/users/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await usersCollection.deleteOne(query);
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

		// app.get("/posts/:userName", async (req, res) => {
		// 	const userName = req.params.userName;

		// 	const query = { userName: { $in: [userName] } };

		// 	const result = await postsCollection.find(query).toArray();
		// 	res.send(result);
		// });

		// app.put("/posts/like", async (req, res) => {
		// 	const { postId } = req.body;

		// 	// console.log("🚀 ~ file: index.js:142 ~ app.put ~ postId:", postId)
		// 	const result = await postsCollection.updateOne(
		// 		{ _id: new ObjectId(postId) },
		// 		{ $inc: { likes: 1 } }
		// 	);
		// 	res.send(result);
		// });

		app.patch("/posts/like/:postId", async (req, res) => {
			try {
				const postId = req.params.postId;
				const userName = req.body.user.userName; // Extract the user's displayName from the request body

				console.log("postId", "userName", postId, userName);

				// Check if the user's displayName is already included in the likedBy array
				const found = await postsCollection.findOne({
					_id: new ObjectId(postId),
					likedBy: { $in: [userName] },
				});

				if (!found) {
					// The user has not liked the post before, so increment the likes count and push the user's displayName to the likedBy array
					const result = await postsCollection.updateOne(
						{ _id: new ObjectId(postId) },
						{
							$inc: { likes: 1 },
							$push: { likedBy: userName },
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
				res.status(500).json({
					message: "Internal server error",
				});
			}
		});

		app.put("/posts/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const options = { upsert: true };

			const updatedPost = req.body;
			const posts = {
				$set: {
					image: updatedPost.image,
					name: updatedPost.name, // it is the content of the post
				},
			};
			const result = await postsCollection.updateOne(
				filter,
				posts,
				options
			);
			res.send(result);
		});

		app.get("/posts/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await postsCollection.findOne(query);
			res.send(result);
		});

		app.delete("/posts/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await postsCollection.deleteOne(query);
			res.send(result);
		});

		/* ------------------------------ save post -------------------------------- */
		app.post("/savePost", async (req, res) => {
			const post = req.body;
			const result = await saveCollection.insertOne(post);
			res.send(result);
		});

		app.get("/savePost", async (req, res) => {
			const result = await saveCollection.find().toArray();
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

		app.get("/follow", async (req, res) => {
			const result = await followCollection.find().toArray();
			res.send(result);
		});

		app.delete("/follow", async (req, res) => {
			const { followerId, unfollowId } = req.body;
			console.log("followerId, unfollowId", followerId, unfollowId);
			// Find the follower document
			const followDataDocument = await followCollection.findOne({
				followerId,
			});

			// Check if the follower document exists
			if (!followDataDocument) {
				return res.status(404).send({ message: "Follower not found" });
			}

			// Remove the unfollowId from the followingIds array
			const updatedFollowingIds = followDataDocument.followingIds.filter(
				(id) => id !== unfollowId
			);

			// Update the follower document with the updated followingIds array
			await followCollection.replaceOne(
				{ followerId },
				{ ...followDataDocument, followingIds: updatedFollowingIds }
			);

			// Return a success message to the client
			res.send({ success: true });
		});

		/* ------------------------------ comment -------------------------------- */
		commentsCollection.createIndex({
			createdAt: 1,
			expireAfterSeconds: 2592000,
		});

		const deleteComment = async () => {
			const thirtyDaysAgo = new Date(
				Date.now() - 30 * 24 * 60 * 60 * 1000
			);
			const expiredPosts = await commentsCollection
				.find({
					createdAt: {
						$lt: thirtyDaysAgo,
					},
				})
				.toArray();

			for (const post of expiredPosts) {
				await commentsCollection.deleteOne({ _id: post._id });
			}
		};

		setInterval(deleteComment, 86400000);

		app.post("/comments", async (req, res) => {
			const post = req.body;
			post.createdAt = new Date();
			const result = await commentsCollection.insertOne(post);
			res.send(result);
		});

		app.get("/comments", async (req, res) => {
			const result = await commentsCollection.find().toArray();
			res.send(result);
		});

		/* ------------------------------ story -------------------------------- */
		storyCollection.createIndex({
			createdAt: 1,
			expireAfterSeconds: 86400,
		});

		const deleteExpiredStory = async () => {
			const oneDaysAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const expiredStories = await storyCollection
				.find({
					createdAt: {
						$lt: oneDaysAgo,
					},
				})
				.toArray();

			for (const story of expiredStories) {
				await storyCollection.deleteOne({ _id: story._id });
			}
		};

		setInterval(deleteExpiredStory, 60000);

		app.post("/story", async (req, res) => {
			const story = req.body;
			story.createdAt = new Date();
			const result = await storyCollection.insertOne(story);
			res.send(result);
		});

		app.get("/story", async (req, res) => {
			const result = await storyCollection.find().toArray();
			res.send(result);
		});

		app.get("/story/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await storyCollection.findOne(query);
			res.send(result);
		});

		/* ------------------------------ report to admin -------------------------------- */
		app.post("/report", async (req, res) => {
			const report = req.body;
			report.createdAt = new Date();
			const result = await reportCollection.insertOne(report);
			res.send(result);
		});

		app.get("/report", async (req, res) => {
			const result = await reportCollection.find().toArray();
			res.send(result);
		});

		/* ------------------------------ feedback from admin -------------------------------- */
		app.post("/feedback", async (req, res) => {
			const report = req.body;
			report.createdAt = new Date();
			const result = await feedbackCollection.insertOne(report);
			res.send(result);
		});

		app.get("/feedback", async (req, res) => {
			const result = await feedbackCollection.find().toArray();
			res.send(result);
		});

		/* ------------------------------ block -------------------------------- */
		app.post("/block", async (req, res) => {
			const blockData = req.body;
			const userName = blockData.blockerName;

			console.log(blockData);

			const blockDataDocument = await blockCollection.findOne({
				blockerName: userName,
			});

			if (!blockDataDocument) {
				await blockCollection.insertOne(blockData);
			} else {
				const alreadyBlocking = blockDataDocument.blockedNames.includes(
					blockData.blockedNames[0]
				);

				if (!alreadyBlocking) {
					blockDataDocument.blockedNames.push(
						blockData.blockedNames[0]
					);

					await blockCollection.replaceOne(
						{ blockerName: userName },
						blockDataDocument
					);
				}

				res.send({ success: true });
			}
		});

		app.get("/block", async (req, res) => {
			const result = await blockCollection.find().toArray();
			res.send(result);
		});

		/* ------------------------------ about -------------------------------- */
		app.post("/about", async (req, res) => {
			const report = req.body;
			report.createdAt = new Date();
			const result = await aboutCollection.insertOne(report);
			res.send(result);
		});

		app.get("/about", async (req, res) => {
			const result = await aboutCollection.find().toArray();
			res.send(result);
		});

		app.put("/about/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const options = { upsert: true };

			const updateAbout = req.body;
			const aboutEdit = {
				$set: {
					bio: updateAbout.bio,
					address: updateAbout.address,
					birthday: updateAbout.birthday,
					facebook: updateAbout.facebook,
					github: updateAbout.github,
					twitter: updateAbout.twitter,
					linked: updateAbout.linked,
					website: updateAbout.website,
					discord: updateAbout.discord,
					relation: updateAbout.relation,
					quote: updateAbout.quote,
				},
			};
			const result = await aboutCollection.updateOne(
				filter,
				aboutEdit,
				options
			);
			res.send(result);
		});

		/* ------------------------------ blogs -------------------------------- */
		app.post("/blogs", async (req, res) => {
			const report = req.body;
			report.createdAt = new Date();
			const result = await blogsCollection.insertOne(report);
			res.send(result);
		});

		app.get("/blogs", async (req, res) => {
			let query = {};

			if (req.params.category) {
				if (
					req.params.category == "Technology" ||
					req.params.category == "Lifestyle" ||
					req.params.category == "Entertainment" ||
					req.params.category == "Personal Development" ||
					req.params.category == "Business and Finance" ||
					req.params.category == "Science and Education" ||
					req.params.category == "Books and Literature" ||
					req.params.category == "Social Issues" ||
					req.params.category == "Parenting and Family" ||
					req.params.category == "Sports" ||
					req.params.category == "Photography and Art" ||
					req.params.category == "Science Fiction and Fantasy" ||
					req.params.category == "Humor and Satire" ||
					req.params.category == "DIY and Crafts" ||
					req.params.category == "Education and Learning" ||
					req.params.category == "History and Culture" ||
					req.params.category == "News and Politics" ||
					req.params.category == "Tech Reviews"
				) {
					query.category = req.params.category;
				} else {
					query.category = {
						$regex: req.params.category,
						$options: "i",
					};
				}
			}

			if (req.query?.category) {
				query.category = {
					$regex: req.query.category,
					$options: "i",
				};
			}

			if (req.query?.title) {
				query.title = {
					$regex: req.query.title,
					$options: "i",
				};
			}

			const result = await blogsCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/blogs/:title", async (req, res) => {
			const title = req.params.title;
			const query = { title: title };
			const result = await blogsCollection.findOne(query);
			res.send(result);
		});

		app.patch("/blogs/like/:postId", async (req, res) => {
			try {
				const postId = req.params.postId;
				const userName = req.body.user.userName;

				// console.log("postId", "userName", postId, userName);

				const found = await blogsCollection.findOne({
					_id: new ObjectId(postId),
					likedBy: { $in: [userName] },
				});

				if (!found) {
					const result = await blogsCollection.updateOne(
						{ _id: new ObjectId(postId) },
						{
							$inc: { likes: 1 },
							$push: { likedBy: userName },
						}
					);
					res.send(result);
				} else {
					res.status(400).json({
						message: "You have already liked this post",
					});
				}
			} catch (error) {
				console.error("Error incrementing likes:", error);
				res.status(500).json({
					message: "Internal server error",
				});
			}
		});

		/* ------------------------------ hide -------------------------------- */
		// app.post("/hide", async (req, res) => {
		// 	const report = req.body;
		// 	report.createdAt = new Date();
		// 	const result = await hideCollection.insertOne(report);
		// 	res.send(result);
		// });

		app.post("/hide", async (req, res) => {
			const hideData = req.body;
			const userName = hideData.hiderUser;

			// Check if the userName matches the hiderUser in the database. the one who is hiding other users
			const hideDataDocument = await hideCollection.findOne({
				hiderUser: userName,
			});

			// If the hide data document does not exist, then create a new one.
			if (!hideDataDocument) {
				await hideCollection.insertOne(hideData);
			} else {
				// Check if the new user's name already exists in the hidingUsers array.
				const alreadyHiding = hideDataDocument.hidingUsers.includes(
					hideData.hidingUsers[0]
				);

				// If the new user's name does not already exist in the hidingUsers array, then add it.
				if (!alreadyHiding) {
					hideDataDocument.hidingUsers.push(hideData.hidingUsers[0]);

					// Update the hide data document in the database.
					await hideCollection.replaceOne(
						{ hiderUser: userName },
						hideDataDocument
					);
				}

				// Return a success message to the client.
				res.send({ success: true });
			}
		});

		app.get("/hide", async (req, res) => {
			const result = await hideCollection.find().toArray();
			res.send(result);
		});

		app.delete("/hide", async (req, res) => {
			const { hiderUser, unHideUser } = req.body;
			console.log("hiderUser, unHideUser", hiderUser, unHideUser);
			// Find the user document
			const hideDataDocument = await hideCollection.findOne({
				hiderUser,
			});

			// Check if the user document exists
			if (!hideDataDocument) {
				return res.status(404).send({ message: "User not found" });
			}

			// Remove the unHideUser from the hidingUsers array
			const updatedHidingUsers = hideDataDocument.hidingUsers.filter(
				(us) => us !== unHideUser
			);

			// Update the user document with the updated hidingUsers array
			await hideCollection.replaceOne(
				{ hiderUser },
				{
					...hideDataDocument,
					hidingUsers: updatedHidingUsers,
				}
			);

			// Return a success message to the client
			res.send({ success: true });
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
