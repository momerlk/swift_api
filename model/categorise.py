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
    schema = """{
        product_id: { id of the product, unique },
        product_type : {type of the product e.g "womens_clothing", "kids_clothing", "mens_clothing"},
        category : {broad category of the product e.g "clothes", "shoes", "accessories"}
        product_url: { URL of the product page, unique },
        options : {options of the product like examples given sizes, colours, etc.},
        shopify_id: { Shopify ID },
        handle: { product handle },
        title: { product title },
        vendor: { product vendor },
        vendor_title : {product vendor title},
        description: { detailed and useful product description },
        price: { product price },
        currency: { currency of the price },
        available: { availability status },
        meta_tags: {
            categories: { categories inferred from description },
            garment_type: { type of garment },
            style: { style of the product },
            keywords: { keywords for recommendation }
        },
        audience: {
            age_range: { target age range },
            gender: { target gender },
            interests: { customer interests },
            price_range: { price range/income class },
            user_type: { type of user }
        }
    }"""

    prompt = f"""
    Using the schema "{schema}", convert this data "{data}" into Product objects.
    1. Extract "age_range", "gender", "interests", "price_range", "user_type" from "description", "title", "handle".
    2. Generate "categories" from "description".
    3. Infer "garment_type", "style", "keywords" for recommendations.
    4. Infer product type and category and generate data for "category" and "product_type" fields according to schema.
    5. In the Description add newline characters where appropriate denoted by "/newline" not escape sequences.
    6. You may modify the description to be more readable and user friendly.
    7. Carefully interpret the instructions and descriptions in the schema.
    Ensure data is structured, concise, and suitable for programmatic use. Your(Gemini's) 
    output format is JSON, no javascript or any coding or any other comments.
    """


    return prompt


import time 

def extract_info(data):
    prompt = generate_prompt(f"{data}")
    for item in data : 
        print(f"handle = {item["handle"]}")
    response = None
    while True : 
        error = False
        try : 
            response = chat_session.send_message(prompt)
        except Exception as e : 
            error = True

        if error == False : 
            break
        else : 
            print(f"could not get response trying again after 30 seconds ...")
            time.sleep(30)

    return response

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as file:
            progress = json.load(file)
            if "last_processed_id" in progress:
                progress["last_processed_id"] = ObjectId(progress["last_processed_id"])
            
            return progress
    return {"last_processed_id": None , "total_requests" : 0}

def save_progress(last_processed_id , total_requests):
    with open(PROGRESS_FILE, "w") as file:
        progress = {"last_processed_id": str(last_processed_id) , "total_requests" : total_requests}
        json.dump(progress, file)



# Initialize MongoDB client
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]
collection = db[COLLECTION_NAME]
new_collection = db["new_products"]

# Load progress
progress = load_progress()
last_processed_id = progress["last_processed_id"]
total_requests = progress["total_requests"]

# Query to fetch products
query = {}
if last_processed_id:
    query["_id"] = {"$gt": last_processed_id}

def rate_limit(last_request_time, requests_in_last_minute):
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

import pprint
import re
def fix_json_errors(json_string):
    # Define a regex pattern to find problematic characters
    problematic_chars_pattern = re.compile(r'[\x00-\x1F\x7F\u2028\u2029]')
    
    # Replace problematic characters with their escaped equivalents
    sanitized_json_string = problematic_chars_pattern.sub(
        lambda x: '\\u{:04x}'.format(ord(x.group(0))), 
        json_string
    )
    
    return sanitized_json_string

def process_batch(batch, last_request_time, requests_in_last_minute, total_requests):
    products_list = batch

    # Rate limiting
    last_request_time, requests_in_last_minute = rate_limit(last_request_time, requests_in_last_minute)

    total_requests += len(batch)
    # Extract information from descriptions
    response = extract_info(products_list)
    text = response.text.encode().decode('unicode_escape')
    try : 
        data_list = json.loads(text)
    except Exception as e : 
        print(f"could not decode response, error = {e}, trying fixed_json")
        fixed_text = fix_json_errors(text)
        try : 
            data_list = json.loads(fixed_text)
        except Exception as e2 : 
            print(f"could not decode response, error = {e}, trying fixed_json")
            return last_request_time, requests_in_last_minute , total_requests
    
    
    new_documents = []

    # Iterate over products and their corresponding extracted data
    for product, data in zip(products_list, data_list):

        try : 
            del data["_id"]
        except Exception as e : 
            e = None 
        
        new_documents.append(data)

        # Save progress
        save_progress(product["_id"] , total_requests)

    # Insert new documents into the new collection
    if new_documents:
        new_collection.insert_many(new_documents)

    return last_request_time, requests_in_last_minute , total_requests


# TODO : MAKE THE PROMPT SIZE MUCH MUCH MUCH MUCH SMALLER, current size is almost 2800 words

def main(total_requests):
    batch_size = 2

    last_request_time = 0
    requests_in_last_minute = []

    print(f"total requests = {total_requests}")

    while True:
        cursor = collection.find(query).sort("_id").skip(total_requests).limit(batch_size)
        products_list = list(cursor)

        if not products_list:
            break
        
        last_request_time, requests_in_last_minute , total_requests = process_batch(products_list , last_request_time , requests_in_last_minute, total_requests)  

        print(f"total requests = {total_requests}")
        # Check if we reached the daily limit
        if len(requests_in_last_minute) >= 1500:
            print("Daily limit reached, stopping execution.")
            break

    print("Processing complete.")

main(total_requests)