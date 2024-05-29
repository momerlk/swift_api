import mongoose, {Schema, Document} from "mongoose"

const productSchema = new Schema({
  product_id: {
    type : String,
    required : true,
    unique : true,
  },
  product_url: {
    type : String,
    required : true,
    unique : true,
  },
  shopify_id: {
    type : Number, 
    required : true,
  },
  handle: {
    type : String,
    required : true,
  },
  title: {
    type : String,
    required : true,
  },
  vendor: {
    type : String,
    required : true,
  },
  category: {
    type : String,
  },
  image_url: {
    type : String,
  },
  description: {
    type : String,
    required : true,
  },
  body_html: {
    type : String,
    required : false,
  },
  price: {
    type : String,
    required : true,
  },
  currency: {
    type : String,
    required : true,
  },
  options: {
    type : Array,
    required : false,
  },
  tags: {
    type : Array,
    required : false,
  },
  available: {
    type: Boolean,
    required : true,
  }
})

export default mongoose.model('products', productSchema);