import os
import json
import time
from pymongo import MongoClient
from bson import ObjectId
import google.generativeai as genai
import concurrent.futures
from threading import Lock

# MongoDB connection details
MONGO_URI = "mongodb://localhost:27017"
DATABASE_NAME = "swift"
COLLECTION_NAME = "products"
PROGRESS_FILE = "progress.json"

# Configure the Gemini API
genai.configure(api_key="AIzaSyD75qFy_cprb1j8W_AxDBzAtsBQnWFH2Vc")

# Create the model with appropriate configurations
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
    "stop_sequences": ["Explanation"],
    "response_mime_type": "application/json",
}
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    safety_settings=safety_settings,
    generation_config=generation_config,
)

chat_session = model.start_chat()

def generate_prompt(data : str) -> str : 
    schema = """const productSchema = new mongoose.Schema({
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
    image_url: {
        type : String,
    },
    description: {
        type : String,
        required : true,
    },
    price: {
        type : String,
        required : true,
    },
    currency: {
        type : String,
        required : true,
    },
    available: {
        type: Boolean,
        required : true,
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
    """
    return f"""
    Based on this schema {schema}. Convert this array of data "{data}" to an array of 
    Product objects based on the schema. Use the "description", "title" and "handle" 
    fields as your main source of extracting information from each object in the array 
    of data to generate audience data infer the "age_range", target "gender", "interests" 
    of the customer, "price_range" the income class of the customer like "middle-class", 
    "user_type". Also in the meta tags generate categories inferring from the "description"
    of the object. Also infer the "garment" type, as well as "style" and "keywords" that would
    be useful for recommendation systems. This generated information should be suitable 
    for use in recommendation systems primarily and understood by computers and be in a format
    suitable for programs. structured and concise. 
    """


def extract_info(data):
    prompt = generate_prompt(f"{data}")
    print(f"prompt = {prompt}")
    response = chat_session.send_message(prompt)
    return response

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as file:
            progress = json.load(file)
            if "last_processed_id" in progress:
                progress["last_processed_id"] = ObjectId(progress["last_processed_id"])
            return progress
    return {"last_processed_id": None}

def save_progress(last_processed_id):
    with open(PROGRESS_FILE, "w") as file:
        progress = {"last_processed_id": str(last_processed_id)}
        json.dump(progress, file)



# Initialize MongoDB client
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]
collection = db[COLLECTION_NAME]
new_collection = db["new_products"]

# Load progress
progress = load_progress()
last_processed_id = progress["last_processed_id"]

# Query to fetch products
query = {}
if last_processed_id:
    query["_id"] = {"$gt": last_processed_id}

def rate_limit(last_request_time, requests_in_last_minute, lock):
    with lock:
        now = time.time()
        if last_request_time and (now - last_request_time < 1):
            time.sleep(1 - (now - last_request_time))
        if len(requests_in_last_minute) >= 15:
            sleep_time = 60 - (now - requests_in_last_minute[0])
            if sleep_time > 0:
                time.sleep(sleep_time)
            requests_in_last_minute = requests_in_last_minute[1:]
        now = time.time()  # Update now after potential sleep
        requests_in_last_minute.append(now)
        return now, requests_in_last_minute

def process_batch(batch, last_request_time, requests_in_last_minute, lock):
    products_list = batch

    # Rate limiting
    last_request_time, requests_in_last_minute = rate_limit(last_request_time, requests_in_last_minute, lock)

    # Extract information from descriptions
    response = extract_info(products_list)
    data_list = json.loads(response.text)

    new_documents = []

    # Iterate over products and their corresponding extracted data
    for product, data in zip(products_list, data_list):
        # Determine the value of mens_clothing
        if not data.get("clothing", False):
            data["mens_clothing"] = False
        elif "mens" in [tag.lower() for tag in data.get("tags", [])]:
            data["mens_clothing"] = True
        else:
            data["mens_clothing"] = False

        # Add the original product's _id to the new data
        data["_id"] = product["_id"]
        new_documents.append(data)

        # Save progress
        save_progress(product["_id"])

    # Insert new documents into the new collection
    if new_documents:
        new_collection.insert_many(new_documents)

    return last_request_time, requests_in_last_minute


# TODO : MAKE THE PROMPT SIZE MUCH MUCH MUCH MUCH SMALLER, current size is almost 2800 words

def main():
    batch_size = 8
    offset = 0
    max_workers = 3  # Ensure we don't exceed 15 requests per minute

    last_request_time = 0
    requests_in_last_minute = []
    lock = Lock()

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = []

        while True:
            cursor = collection.find(query).sort("_id").skip(offset).limit(batch_size)
            products_list = list(cursor)

            if not products_list:
                break

            # Submit batch for processing
            futures.append(executor.submit(process_batch, products_list, last_request_time, requests_in_last_minute, lock))

            # Increment offset for the next batch
            offset += batch_size

            # Check if we reached the daily limit
            if len(requests_in_last_minute) >= 1500:
                print("Daily limit reached, stopping execution.")
                break

        # Wait for all futures to complete
        for future in concurrent.futures.as_completed(futures):
            last_request_time, requests_in_last_minute = future.result()

            # Check if we reached the daily limit
            if len(requests_in_last_minute) >= 1500:
                print("Daily limit reached, stopping execution.")
                break

    print("Processing complete.")

main()