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
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = __importDefault(require("../models/user"));
const uuid_1 = require("uuid");
const router = express_1.default.Router();
// Signup route
router.post('/signup', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, phone_number } = req.body;
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const user_id = (0, uuid_1.v4)();
        const user = new user_1.default({ user_id, email, password: hashedPassword, phone_number });
        yield user.save();
        res.status(200).json({ message: 'User created successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}));
// Login route
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, phone_number, password } = req.body;
        let user = null;
        if (email === null || email == undefined) {
            user = yield user_1.default.findOne({ phone_number });
        }
        else {
            user = yield user_1.default.findOne({ email });
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }
        // TODO : Add a secret key that changes every day
        const token = jsonwebtoken_1.default.sign({ user_id: user.user_id }, 'my-secret-key', { expiresIn: '3h' });
        res.status(200).json({ token });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}));
exports.default = router;
