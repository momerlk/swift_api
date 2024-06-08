import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import authRoutes from './routes/auth';
import userRoutes from"./routes/user";
import handleFeed from "./controllers/feed"
import cors from 'cors';


const app = express();
app.use(bodyParser.json());
app.use(cors())

const atlas_url = "mongodb+srv://swift:swift@hobby.nzyzrid.mongodb.net/swift";
const local_url = "mongodb://localhost:27017/swift"
const url = local_url;

// Connect to MongoDB
mongoose.connect(url)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Routes
app.use('/auth', authRoutes);
app.use("/user" , userRoutes);

handleFeed(9001);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
