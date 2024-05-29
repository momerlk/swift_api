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
// params : n -> number of recommendations to make
function recommend(n) {
    return __awaiter(this, void 0, void 0, function* () {
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
                const products = yield recommend(20);
                if (products === null) {
                    ws.send(JSON.stringify({
                        status: 500,
                        message: "Failed to recommend products",
                    }));
                }
                else {
                    ws.send(JSON.stringify({
                        status: 200,
                        message: `real-time connection established`,
                        products: products,
                    }));
                }
            }),
            message: (ws, client_message, isBinary) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const message_string = Buffer.from(client_message).toString();
                    const message = JSON.parse(message_string);
                    const action = new actions_1.default(message);
                    yield action.save();
                    const products = yield recommend(1);
                    if (products === null) {
                        ws.send(JSON.stringify({
                            status: 500,
                            message: "Failed to recommend products",
                        }));
                    }
                    else {
                        ws.send(JSON.stringify({
                            status: 200,
                            message: `real-time connection established`,
                            products: products,
                        }));
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
                // TODO : cannot do ws.send but add closure logic
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
