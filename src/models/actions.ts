import mongoose, {Schema, Document} from "mongoose"

export interface IAction extends Document {
    user_id : string;
    action_type : "liked" | "disliked" | "added_to_cart"; 
    action_timestamp : string;
    
    product_id : string;
}

const actionSchema = new Schema({
    user_id : {
        type : String,
        required : true, 
    },
    action_id : {
        type : String,
        required : true,
    },
    action_type : {
        type : String,
        required: true,
    },
    action_timestamp : {
        type : String, 
        required : true,
    },

    product_id : {
        type : String,
        required : true, 
    }
})

export default mongoose.model<IAction>('action', actionSchema);
