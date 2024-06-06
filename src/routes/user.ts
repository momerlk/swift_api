import express from "express";
import { Request, Response, NextFunction } from 'express';
import jwt from "jsonwebtoken";
import actions from "../models/actions";
import product from "../models/product";
import user from "../models/user"


export interface AuthRequest extends Request {
    user?: any;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header is missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Bearer token is missing' });
    }

    // TODO : Get Actual Secret Key from centralised system
    jwt.verify(token, 'my-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

const router = express.Router();
router.use(authMiddleware);

router.get("/verify" , async (req , res) => {
    return res.status(200).json({message : "Token verified"})
})

router.get("/refresh" , async (req : AuthRequest ,res) => {
    // TODO : Add a secret key that changes every day
    const token = jwt.sign({ user_id: req?.user.user_id }, 'my-secret-key', { expiresIn: '3h' });

    res.status(200).json({ token });
})

router.get("/liked" , async (req : AuthRequest , res) => {
    try {
        const user_id = req.user?.user_id;

        // gets all likes of the user
        const liked_actions = await actions.find({action_type : "liked" , user_id : user_id})


        let products = []
        for (let i = 0;i < liked_actions.length;i++){
            const product_id = liked_actions[i]["product_id"];
            const data = await product.findOne({product_id : product_id})
            products.push(data)
        }
        return res.status(200).json(products)
    } catch(e){
        return res.status(500).json({message : `error = ${e}`})
    }
})


export default router;