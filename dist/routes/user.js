"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const actions_1 = __importDefault(require("../models/actions"));
const product_1 = __importDefault(require("../models/product"));
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header is missing' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Bearer token is missing' });
    }
    // TODO : Get Actual Secret Key from centralised system
    jsonwebtoken_1.default.verify(token, 'my-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};
const router = express_1.default.Router();
router.use(authMiddleware);
router.get("/verify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    return res.status(200).json({ message: "Token verified" });
}));
router.get("/refresh", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO : Add a secret key that changes every day
    const token = jsonwebtoken_1.default.sign({ user_id: req === null || req === void 0 ? void 0 : req.user.user_id }, 'my-secret-key', { expiresIn: '3h' });
    res.status(200).json({ token });
}));
router.get("/liked", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const user_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        // gets all likes of the user
        const liked_actions = yield actions_1.default.find({ action_type: "liked", user_id: user_id });
        let products = [];
        for (let i = 0; i < liked_actions.length; i++) {
            const product_id = liked_actions[i]["product_id"];
            const data = yield product_1.default.findOne({ product_id: product_id });
            products.push(data);
        }
        return res.status(200).json(products);
    }
    catch (e) {
        return res.status(500).json({ message: `error = ${e}` });
    }
}));
exports.default = router;
