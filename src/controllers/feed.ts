import Action from "../models/actions"
import uws from "uWebSockets.js"
import Product from "../models/product"
import user from "../models/user";
import jwt from "jsonwebtoken"
import {v4 as uuid} from "uuid";


// params : n -> number of recommendations to make
export async function recommend(n : number){
    try {
        const products = await Product.aggregate([{ $sample: { size: n } }]);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return null;
    }
}

export default async function handle_feed(port : number){
    const app = uws.App().ws('/feed' , {
        /* There are many common helper features */
    idleTimeout: 32,
    maxBackpressure: 1024,
    maxPayloadLength: 512,

    open : async (ws : uws.WebSocket<unknown>) => {
        const products = await recommend(20);
        if (products === null){
            ws.send(JSON.stringify({
                status : 500,
                message : "Failed to recommend products",
            }))
        } else {
            ws.send(JSON.stringify({
                status : 200,
                message : `real-time connection established`,
                products : products,
            }))
        }

    },

    message : async (ws : uws.WebSocket<unknown>, client_message : ArrayBuffer, isBinary : boolean) => {
        try  {
            const message_string = Buffer.from(client_message).toString();
            const message = JSON.parse(message_string);
            let user_id = ""

            // TODO : Get Actual Secret Key from centralised system
            jwt.verify(message.token, 'my-secret-key', (err : any, user : any) => {
                if (err) {
                    return ws.send(JSON.stringify(({ message: 'Invalid token' })));
                }
                user_id = user.user_id;
            });

            const data = {
                user_id : user_id,
                action_type : message.action_type,
                product_id : message.product_id, 
                action_id : uuid(),
                action_timestamp : (new Date()).toDateString(),
            }

            console.log(`data = ${data}`)

            const action = new Action(data);
            await action.save();
            
            const products = await recommend(1);
            if (products === null){
                ws.send(JSON.stringify({
                    status : 500,
                    message : "Failed to recommend products",
                }))
            } else {
                ws.send(JSON.stringify({
                    status : 200,
                    message : `real-time connection established`,
                    products : products,
                }))
            }


        } catch(e : any){
            ws.send(JSON.stringify({
                status : 500,
                message : `could not add action, error = ${e}`,
            }))
        }
    },

    close : (ws : uws.WebSocket<unknown>) => {
        // TODO : cannot do ws.send but add closure logic
    },
    
    }).listen(port, (token) => {
        if (token) {
            console.log(`Feed websocket listening on port ${port}`);
        } else {
            console.log(`Feed websocket failed to listen on ${port}`);
        }
    });
}