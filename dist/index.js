"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const body_parser_1 = __importDefault(require("body-parser"));
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
const feed_1 = __importDefault(require("./controllers/feed"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use((0, cors_1.default)());
const atlas_url = "mongodb+srv://swift:swift@hobby.nzyzrid.mongodb.net/swift";
const local_url = "mongodb://localhost:27017/swift";
const url = atlas_url;
// Connect to MongoDB
mongoose_1.default.connect(url)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));
// Routes
app.use('/auth', auth_1.default);
app.use("/user", user_1.default);
(0, feed_1.default)(9001);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
