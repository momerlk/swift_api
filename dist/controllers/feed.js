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
exports.recommend = void 0;
const actions_1 = __importDefault(require("../models/actions"));
const uWebSockets_js_1 = __importDefault(require("uWebSockets.js"));
const product_1 = __importDefault(require("../models/product"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const history_1 = __importDefault(require("../models/history"));
// params : n -> number of recommendations to make
function recommend(n) {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO : may recommend duplicate products take user history into account
        try {
            const products = yield product_1.default.aggregate([{ $sample: { size: n } }]);
            return products;
        }
        catch (error) {
            console.error('Error fetching products:', error);
            return null;
        }
    });
}
exports.recommend = recommend;
function handle_feed(port) {
    return __awaiter(this, void 0, void 0, function* () {
        const app = uWebSockets_js_1.default.App().ws('/feed', {
            /* There are many common helper features */
            idleTimeout: 32,
            maxBackpressure: 1024,
            maxPayloadLength: 512,
            open: (ws) => __awaiter(this, void 0, void 0, function* () {
                ws.send(JSON.stringify({
                    status: 200,
                    message: `Real-time feed connection established`
                }));
            }),
            message: (ws, client_message, isBinary) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                try {
                    const message_string = Buffer.from(client_message).toString();
                    const message = JSON.parse(message_string);
                    let user_id = "";
                    // TODO : Get Actual Secret Key from centralised system
                    // TODO : Create a error logger system which logs errors that users face
                    jsonwebtoken_1.default.verify(message.token, 'my-secret-key', (err, user) => {
                        if (err) {
                            return ws.send(JSON.stringify(({ message: 'Invalid token' })));
                        }
                        user_id = user.user_id;
                    });
                    // TODO : User history has duplicate product items in it.
                    // user just connected
                    if (message.action_type === "open") {
                        let user_history = yield history_1.default.findOne({ user_id: user_id });
                        // first time users who are made first websocket connection
                        if (user_history === null) {
                            const rec_products = yield recommend(4); // cold start
                            if (rec_products === null) {
                                ws.send(JSON.stringify({ status: 500, message: `Failed to recommend products` }));
                            }
                            let product_ids = [];
                            for (let i = 0; i < rec_products.length; i++) {
                                product_ids.push(rec_products[i]["product_id"]);
                            }
                            user_history = new history_1.default({
                                user_id: user_id,
                                products: product_ids,
                                index: 0,
                            });
                            console.log(`OPEN WITHOUT HISTORY : user.history.index = ${user_history.index}`);
                            console.log(`OPEN WITHOUT HISTORY : products length = ${rec_products.length}`);
                            console.log(`OPEN WITHOUT HISTORY : total products length = ${product_ids.length}`);
                            console.log(`OPEN WITHOUT HISTORY : title of the first product = ${rec_products[0]["title"]}`);
                            console.log(`OPEN WITHOUT HISTORY : vendor of the first product = ${rec_products[0]["vendor"]}`);
                            yield user_history.save(); // creates user history
                            ws.send(JSON.stringify({
                                status: 200,
                                message: `4 products recommended and user history saved`,
                                products: rec_products
                            }));
                            return;
                        }
                        else {
                            // Handle logic for users that already have a history but are making connection
                            user_history.index += 1; // the new array will start from next item
                            const rec_products = yield recommend(2); // recommend two new products
                            // failed to get recommendations
                            if (rec_products === null) {
                                // update the index in the products
                                yield history_1.default.findOneAndUpdate({ user_id: user_id }, user_history);
                                ws.send(JSON.stringify({
                                    status: 500,
                                    message: "Failed to recommend products",
                                }));
                                return;
                            }
                            else {
                                // the product ids of the new products recommended
                                let product_ids = [];
                                for (let i = 0; i < rec_products.length; i++) {
                                    product_ids.push(rec_products[i]["product_id"]);
                                }
                                // updated product ids stored in user history collection
                                product_ids = (user_history === null || user_history === void 0 ? void 0 : user_history.products.concat(product_ids));
                                user_history.products = product_ids;
                                // got all products in the history from index
                                const products = [];
                                // start from index+1 and get all products in user history
                                for (let i = user_history.index; i < product_ids.length; i++) {
                                    const product = yield product_1.default.findOne({ product_id: product_ids[i] });
                                    products.push(product);
                                }
                                console.log(`OPEN WITH HISTORY : user.history.index = ${user_history.index}`);
                                console.log(`OPEN WITH HISTORY : products length = ${products.length}`);
                                console.log(`OPEN WITH HISTORY : total products length = ${product_ids.length}`);
                                console.log(`OPEN WITH HISTORY : title of the first product = ${(_a = products === null || products === void 0 ? void 0 : products[0]) === null || _a === void 0 ? void 0 : _a["title"]}`);
                                console.log(`OPEN WITH HISTORY : vendor of the first product = ${(_b = products === null || products === void 0 ? void 0 : products[0]) === null || _b === void 0 ? void 0 : _b["vendor"]}`);
                                // update user history
                                yield history_1.default.findOneAndUpdate({ user_id: user_id }, user_history);
                                // send all the product data
                                ws.send(JSON.stringify({
                                    status: 200,
                                    message: `2 more products recommended`,
                                    products: products,
                                }));
                                return;
                            }
                        }
                    }
                    // PRODUCTS FOR SWIPES START
                    // TODO : add proper timestamp
                    // TODO : Sometimes doesn't update user_history index and recommends same product twice fix that.
                    // This is for all swiping actions
                    const data = {
                        user_id: user_id,
                        action_type: message.action_type,
                        product_id: message.product_id,
                        action_id: (0, uuid_1.v4)(),
                        action_timestamp: (new Date()).toDateString(),
                    };
                    const user_history = yield history_1.default.findOne({ user_id: user_id });
                    // user has no history which should not be true if connected before
                    if (user_history === null) {
                        ws.send(JSON.stringify({
                            status: 400,
                            message: `No User History found invalid WebSocket Connection`
                        }));
                        return;
                    }
                    // save user action
                    const action = new actions_1.default(data);
                    yield action.save();
                    user_history.index += 1; // record action
                    // recomend two new products
                    const rec_products = yield recommend(2);
                    // failed to get recommendations
                    if (rec_products === null) {
                        // update the index in the products
                        yield history_1.default.findOneAndUpdate({ user_id: user_id }, user_history);
                        ws.send(JSON.stringify({
                            status: 500,
                            message: "Failed to recommend products",
                        }));
                        return;
                    }
                    else {
                        // the product ids of the new products recommended
                        let product_ids = [];
                        for (let i = 0; i < rec_products.length; i++) {
                            product_ids.push(rec_products[i]["product_id"]);
                        }
                        product_ids = (user_history === null || user_history === void 0 ? void 0 : user_history.products.concat(product_ids));
                        user_history.products = product_ids;
                        // got all products in the history fromm index
                        const products = [];
                        for (let i = user_history.index; i < product_ids.length; i++) {
                            const product = yield product_1.default.findOne({ product_id: product_ids[i] });
                            products.push(product);
                        }
                        // update user history 
                        yield history_1.default.findOneAndUpdate({ user_id: user_id }, user_history);
                        console.log(`ACTION : user.history.index = ${user_history.index}`);
                        console.log(`ACTION : products length = ${products.length}`);
                        console.log(`ACTION : total products length = ${product_ids.length}`);
                        console.log(`ACTION : title of the first product = ${(_c = (products === null || products === void 0 ? void 0 : products[0])) === null || _c === void 0 ? void 0 : _c["title"]}`);
                        console.log(`ACTION : vendor of the first product = ${(_d = products === null || products === void 0 ? void 0 : products[0]) === null || _d === void 0 ? void 0 : _d["vendor"]}`);
                        ws.send(JSON.stringify({
                            status: 200,
                            message: `2 more products recommended`,
                            products: products,
                        }));
                        return;
                    }
                }
                catch (e) {
                    ws.send(JSON.stringify({
                        status: 500,
                        message: `could not add action, error = ${e}`,
                    }));
                }
            }),
            close: (ws) => {
                // TODO : cannot do ws.send on closed connection but add socket close logic
            },
        }).listen(port, (token) => {
            if (token) {
                console.log(`Feed websocket listening on port ${port}`);
            }
            else {
                console.log(`Feed websocket failed to listen on ${port}`);
            }
        });
    });
}
exports.default = handle_feed;
