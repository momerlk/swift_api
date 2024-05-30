import mongoose, {Schema, Document} from "mongoose"

export interface IHistory extends Document {
    user_id : string;
    products : any[];
    index : number; 
}

const actionSchema = new Schema({
    user_id : {
        type : String,
        required : true, 
        unique : true,
    },
    products : {
        type : Array,
        required : true
    },
    index : {
        type : Number,
        required : true,
    }
})

export default mongoose.model<IHistory>('history', actionSchema);