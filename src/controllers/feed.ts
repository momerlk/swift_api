import Action from "../models/actions"
import uws from "uWebSockets.js"
import Product from "../models/product"

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


            const action = new Action(message);
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