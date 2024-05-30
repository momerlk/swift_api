import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user';
import {v4 as uuid} from "uuid";

const router = express.Router();

// Signup route
router.post('/signup', async (req, res) => {
    try {
        const {email , password, phone_number } = req.body;


        const hashedPassword = await bcrypt.hash(password, 10);

        const user_id = uuid(); 
        const user = new User({user_id , email , password: hashedPassword, phone_number });


        await user.save();

        res.status(200).json({ message: 'User created successfully' });

    } catch (error : any) {
        res.status(500).json({ message: error.message });
    }
});

// Login route
router.post('/signin', async (req, res) => {
    try {
        const { email, phone_number , password } = req.body;

        let user = null

        if (email === null || email == undefined){
           user = await User.findOne({ phone_number }); 
        } else {
            user = await User.findOne({ email })
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // TODO : Add a secret key that changes every day
        const token = jwt.sign({ user_id: user.user_id }, 'my-secret-key', { expiresIn: '3h' });

        res.status(200).json({ token });
    } catch (error : any) {
        res.status(500).json({ message: error.message });
    }
});

// TODO : Add /refresh route to prevent expiration of tokens

export default router;
