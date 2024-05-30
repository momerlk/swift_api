"use strict";
const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
    product_id: {
        type: String,
        required: true,
        unique: true,
    },
    product_url: {
        type: String,
        required: true,
        unique: true,
    },
    shopify_id: {
        type: Number,
        required: true,
    },
    handle: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    vendor: {
        type: String,
        required: true,
    },
    image_url: {
        type: String,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: String,
        required: true,
    },
    currency: {
        type: String,
        required: true,
    },
    available: {
        type: Boolean,
        required: true,
    },
    rating: {
        impressions: { type: Number },
    },
    meta_tags: {
        categories: [{ type: String }],
        tags: [{ type: String }],
        fabric: [{ type: String }],
        garment_type: [{ type: String }],
        style: [{ type: String }],
        clothing: { type: Boolean },
        clothing_type: { type: String },
        keywords: [{ type: String }],
    },
    audience: {
        age_range: [{ type: String }],
        gender: { type: String },
        interests: [{ type: String }],
        occasion: [{ type: String }],
        price_range: [{ type: String }],
        location: [{ type: String }],
        user_type: [{ type: String }],
    },
    product_details: {
        sizes: [{ type: String }],
    },
});
const Product = mongoose.model('Products', productSchema);
module.exports = Product;
