import Action from "../models/actions"
import uws from "uWebSockets.js"
import Product from "../models/product"
import user from "../models/user";
import jwt from "jsonwebtoken"
import {v4 as uuid} from "uuid";
import History from "../models/history"


// params : n -> number of recommendations to make
export async function recommend(n : number){
    // TODO : may recommend duplicate products take user history into account
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
        ws.send(JSON.stringify({
            status : 200,
            message : `Real-time feed connection established`
        }))
    },

    message : async (ws : uws.WebSocket<unknown>, client_message : ArrayBuffer, isBinary : boolean) => {
        try  {
            const message_string = Buffer.from(client_message).toString();
            const message = JSON.parse(message_string);
            let user_id = ""

            // TODO : Get Actual Secret Key from centralised system
            // TODO : Create a error logger system which logs errors that users face
            jwt.verify(message.token, 'my-secret-key', (err : any, user : any) => {
                if (err) {
                    return ws.send(JSON.stringify(({ message: 'Invalid token' })));
                }
                user_id = user.user_id;
            });

            // TODO : User history has duplicate product items in it.
            
            // user just connected
            if(message.action_type === "open"){
                

                let user_history = await History.findOne({user_id : user_id});
                // first time users who are made first websocket connection
                if (user_history === null){
                    
                    const rec_products = await recommend(4); // cold start

                    if(rec_products === null) {
                        ws.send(JSON.stringify({status : 500, message : `Failed to recommend products`}));
                    }

                    let product_ids = [];
                    for(let i = 0;i < rec_products!.length;i++){
                        product_ids.push(rec_products![i]["product_id"]);
                    }

                    user_history = new History({
                        user_id : user_id , 
                        products : product_ids,
                        index : 0,
                    })

                    console.log(`OPEN WITHOUT HISTORY : user.history.index = ${user_history!.index}`)
                    console.log(`OPEN WITHOUT HISTORY : products length = ${rec_products!.length}`)
                    console.log(`OPEN WITHOUT HISTORY : total products length = ${product_ids.length}`) 
                    console.log(`OPEN WITHOUT HISTORY : title of the first product = ${rec_products![0]["title"]}`)
                    console.log(`OPEN WITHOUT HISTORY : vendor of the first product = ${rec_products![0]["vendor"]}`)
                
                    await user_history.save(); // creates user history

                    ws.send(JSON.stringify({
                        status : 200,
                        message : `4 products recommended and user history saved`,
                        products : rec_products 
                    }))
                    return;
                } else {
                    // Handle logic for users that already have a history but are making connection
                    user_history!.index += 1; // the new array will start from next item
                    const rec_products = await recommend(2); // recommend two new products

                    // failed to get recommendations
                    if (rec_products === null){
                        // update the index in the products
                        await History.findOneAndUpdate({user_id : user_id} , user_history)
                        ws.send(JSON.stringify({
                            status : 500,
                            message : "Failed to recommend products",
                        }))
                        return;
                    } else {

                        // the product ids of the new products recommended
                        let product_ids = [];
                        for(let i = 0;i < rec_products!.length;i++){
                            product_ids.push(rec_products![i]["product_id"]);
                        }
                        
                        // updated product ids stored in user history collection
                        product_ids = (user_history?.products.concat(product_ids)) as any[];

                        user_history!.products = product_ids;

                        // got all products in the history from index
                        const products : any[] = [];
                        // start from index+1 and get all products in user history
                        for(let i = user_history!.index;i < product_ids.length;i++){
                            const product = await Product.findOne({product_id : product_ids[i]})
                            products.push(product);
                        }
                        
                        console.log(`OPEN WITH HISTORY : user.history.index = ${user_history!.index}`)
                        console.log(`OPEN WITH HISTORY : products length = ${products.length}`)
                        console.log(`OPEN WITH HISTORY : total products length = ${product_ids.length}`)
                        console.log(`OPEN WITH HISTORY : title of the first product = ${products?.[0]?.["title"]}`)
                        console.log(`OPEN WITH HISTORY : vendor of the first product = ${products?.[0]?.["vendor"]}`)

                        // update user history
                        await History.findOneAndUpdate({user_id : user_id} , user_history)
                        
                        // send all the product data
                        ws.send(JSON.stringify({
                            status : 200,
                            message : `2 more products recommended`,
                            products : products,
                        }))
                        return;
                    }
                }            
            }
            

            // PRODUCTS FOR SWIPES START

            // TODO : add proper timestamp
            // TODO : Sometimes doesn't update user_history index and recommends same product twice fix that.

            // This is for all swiping actions

            const data = {
                user_id : user_id,
                action_type : message.action_type,
                product_id : message.product_id, 
                action_id : uuid(),
                action_timestamp : (new Date()).toDateString(),
            }

            const user_history = await History.findOne({user_id : user_id});

            // user has no history which should not be true if connected before
            if (user_history === null){
                ws.send(JSON.stringify({
                    status : 400,
                    message : `No User History found invalid WebSocket Connection`
                }))
                return;
            }
            
            // save user action
            const action = new Action(data);
            await action.save();
            user_history!.index += 1; // record action


            // recomend two new products
            const rec_products = await recommend(2);

            // failed to get recommendations
            if (rec_products === null){
                // update the index in the products
                await History.findOneAndUpdate({user_id : user_id} , user_history)
                ws.send(JSON.stringify({
                    status : 500,
                    message : "Failed to recommend products",
                }))
                return;
            } else {

                // the product ids of the new products recommended
                let product_ids = [];
                for(let i = 0;i < rec_products!.length;i++){
                    product_ids.push(rec_products![i]["product_id"]);
                }

                product_ids = (user_history?.products.concat(product_ids)) as any[];

                user_history!.products = product_ids;

                // got all products in the history fromm index
                const products = [];
                for(let i = user_history!.index;i < product_ids.length;i++){
                    const product = await Product.findOne({product_id : product_ids[i]})
                    products.push(product);
                }

                // update user history 
                await History.findOneAndUpdate({user_id : user_id} , user_history)

                console.log(`ACTION : user.history.index = ${user_history!.index}`)
                console.log(`ACTION : products length = ${products.length}`)
                console.log(`ACTION : total products length = ${product_ids.length}`)
                console.log(`ACTION : title of the first product = ${(products?.[0])?.["title"]}`)
                console.log(`ACTION : vendor of the first product = ${products?.[0]?.["vendor"]}`)

                ws.send(JSON.stringify({
                    status : 200,
                    message : `2 more products recommended`,
                    products : products,
                }))
                return;
            }


        } catch(e : any){
            ws.send(JSON.stringify({
                status : 500,
                message : `could not add action, error = ${e}`,
            }))
        }
    },

    close : (ws : uws.WebSocket<unknown>) => {
        // TODO : cannot do ws.send on closed connection but add socket close logic
    },
    
    }).listen(port, (token) => {
        if (token) {
            console.log(`Feed websocket listening on port ${port}`);
        } else {
            console.log(`Feed websocket failed to listen on ${port}`);
        }
    });
}