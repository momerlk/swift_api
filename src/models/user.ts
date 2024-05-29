import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    user_id : string;
    email: string;
    password: string;
    phone_number: string;
}

const userSchema: Schema = new Schema({
    user_id : {
        type : String,
        require: true,
        unique : true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phone_number: {
        type: String,
        required: true,
        unique : true,
    }
});

export default mongoose.model<IUser>('user', userSchema);
