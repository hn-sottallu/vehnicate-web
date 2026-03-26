from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import pandas as pd
from supabase import create_client
from aliv_module import AlivRoadDefects  # your file
from datetime import timedelta
import h3 as h3lib
import os
from dotenv import load_dotenv
import requests
from PIL import Image, ImageDraw, ImageFont
import io

"""
each time a new row comes into the "trips" table, a https request is triggered via ngrok
and the vehicleid, starttime & endtime are sent as a response.
|
↓
These 3 values are later used by the process_trip() function to retrieve IMU + gps data from the
datatransmission table and this raw data is fed into Aliv for road defects.
"""
load_dotenv()  # reads the .env file

SOURCE_URL = os.environ.get("SOURCE_URL")
SOURCE_KEY = os.environ.get("SOURCE_KEY")
TARGET_URL = os.environ.get("TARGET_URL")
TARGET_KEY = os.environ.get("TARGET_KEY")

app = FastAPI()

class TripRecord(BaseModel):
    tripid: int
    vehicleid: int
    starttime: str
    endtime: str
    startx: float
    starty: float
    startz: float
    distance: float

class WebhookPayload(BaseModel):
    type: str
    table: str
    schema: str
    record: TripRecord

# for  deriving the absolute timestamps and lat&lon from the output that aliv gives i.e.,
# relative timestamps (in ms) corresponding to the events.
def enrich_events(tripid, vehicleid, result, df, rotation_angle):
    enriched = []

    for event in result["speedbreakers"]:
        start_time = event["start_time"]
        end_time = event["end_time"]

        # Filter raw data within time range
        subset = df[
            (df["time_ms"] >= start_time) &
            (df["time_ms"] <= end_time)
        ]

        if subset.empty:
            continue

        # 🔹 Extract values
        start_timestamp = subset["timesent"].iloc[0]
        end_timestamp = subset["timesent"].iloc[-1]

        start_time_ms = int(subset["time_ms"].iloc[0])
        end_time_ms = int(subset["time_ms"].iloc[-1])

        # 🔹 Get lat/lon pairs (chronological + unique)
        lat_lon = (
            subset[["latitude", "longitude"]]
            .dropna()
            .drop_duplicates()
            .values
            .tolist()
        )
        first_lat, first_lon = lat_lon[0][0], lat_lon[0][1]
        h3_index = h3lib.latlng_to_cell(first_lat, first_lon, 8)
        enriched.append({
            "vehicleid": vehicleid,
            "tripid": tripid,
            "h3_index": h3_index,
            "start_timestamp": start_timestamp.isoformat(),
            "end_timestamp": end_timestamp.isoformat(),
            "parameter": event["parameter"],
            "path": lat_lon,
            "start_time_ms": start_time_ms,
            "end_time_ms": end_time_ms,
            "rotation_angle": rotation_angle
        })

    return enriched

def aliv_roadDefects(rows):
    aliv = AlivRoadDefects(verbose=False, fs=80)

    result = aliv.analyze_batch(rows)
    print("ALIv result:", result)
    print("Speedbreakers found:", len(result.get("speedbreakers", [])))
    return result

def process_trip(tripid,vehicleid, starttime, endtime):
    print("Starting heavy processing")

    supabase_source = create_client(SOURCE_URL, SOURCE_KEY)
    supabase_target = create_client(TARGET_URL, TARGET_KEY)

    all_data = []
    page_size = 5000
    start = 0

    while True:
        response = (
            supabase_source
            .table("datatransmission")
            .select("*")
            .eq("vehicleid", vehicleid)
            .gte("timesent", starttime)
            .lte("timesent", endtime)
            .order("timesent", desc=False)
            .range(start, start + page_size - 1)
            .execute()
        )

        batch = response.data

        if not batch:
            break

        all_data.extend(batch)
        start += page_size

    print("Total rows fetched:", len(all_data))

    if len(all_data) == 0:
        print("No data found, skipping")
        return

    # 🔹 Convert to DataFrame
    df = pd.DataFrame(all_data)

    df["timesent"] = pd.to_datetime(df["timesent"], utc=True, errors="coerce")
    #df["timesent"] = df["timesent"].dt.tz_convert("Asia/Kolkata")
    df = df.sort_values("timesent").reset_index(drop=True)

    # for enrich_events()
    #df["time_ms"] = df["timesent"].astype("int64") // 10**6
    base_time = df["timesent"].iloc[0]
    df["time_ms"] = ((df["timesent"] - base_time).dt.total_seconds() * 1000).astype(int)
    accel_x = df["accel_x"].iloc[0]
    rotation_angle = 90 if accel_x > 0 else -90
    # running Aliv
    #result = aliv_roadDefects(all_data)
    result = aliv_roadDefects(df.to_dict(orient="records"))
    if not result.get("speedbreakers"):
        print("No events detected")
        return
    
    enriched_events = enrich_events(tripid, vehicleid, result, df, rotation_angle)
    print("number of enriched events", enriched_events)
    if enriched_events:
        #supabase_target.table("roaddefects").insert(enriched_events).execute()
        # Step 1: Insert and get IDs
        insert_response = supabase_target.table("roaddefects")\
            .insert(enriched_events)\
            .execute()

        inserted_events = insert_response.data

        # Step 2: Fetch and map images
        images_to_insert = []

        for event in inserted_events:
            event_id = event["id"]
            h3_index = event["h3_index"]
            start_time = event["start_timestamp"]
            end_time = event["end_timestamp"]
            rotation_angle = event.get("rotation_angle", -90)  # fallback to -90

            adjusted_start_time = (
                pd.to_datetime(start_time, utc=True) - timedelta(seconds=2.5)
            ).isoformat()

            image_response = (
                supabase_source
                .table("image_data")
                .select("file_url, timestamp")
                .eq("vehicle_id", vehicleid)
                .gte("timestamp", adjusted_start_time)
                .lte("timestamp", end_time)
                .execute()
            )

            images = image_response.data
            for img_row in images:
                # Download image
                try:
                    resp = requests.get(img_row["file_url"], timeout=20)
                    resp.raise_for_status()
                    img_bytes = resp.content
                except Exception as e:
                    print(f"Failed to download image: {e}")
                    continue

                # Rotate + watermark
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                img = img.rotate(rotation_angle, expand=True)

                original_dt = pd.to_datetime(img_row["timestamp"])
                dt_str = original_dt.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                watermark_text = f"{dt_str}\ncaptured by vehnicate"

                draw = ImageDraw.Draw(img)
                font_size = int(img.height * 0.035)
                while True:
                    try:
                        font = ImageFont.truetype("arial.ttf", font_size)
                    except:
                        font = ImageFont.load_default()
                        break
                    bbox = draw.multiline_textbbox((0, 0), watermark_text, font=font)
                    if (bbox[2] - bbox[0]) <= img.width * 0.30:
                        break
                    font_size -= 2
                    if font_size <= 12:
                        break

                padding = 20
                for ox, oy in [(2,2),(-2,-2),(2,-2),(-2,2),(0,2),(2,0),(-2,0),(0,-2)]:
                    draw.multiline_text((padding+ox, padding+oy), watermark_text, fill="black", font=font)
                draw.multiline_text((padding, padding), watermark_text, fill="white", font=font)

                # Upload to Supabase storage instead of saving locally
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG")
                buffer.seek(0)

                file_name = f"{vehicleid}/{tripid}/{event_id}/{img_row['timestamp']}.jpg"
                supabase_target.storage.from_("processed-images").upload(
                    file_name,
                    buffer.read(),
                    {"content-type": "image/jpeg"}
                )
                public_url = supabase_target.storage.from_("processed-images").get_public_url(file_name)

                images_to_insert.append({
                    "vehicle_id": vehicleid,
                    "trip_id": tripid,
                    "h3_index": h3_index,
                    "image_url": public_url,   # ← processed image URL, not original
                    "event_id": event_id,
                    "timestamp": img_row["timestamp"]
                })

        # Step 3: Insert images
        if images_to_insert:
            supabase_target.table("images").insert(images_to_insert).execute()


    print("Processing finished")


@app.post("/Aliv_for_MVP1")
def Aliv_for_MVP1(payload: WebhookPayload,  background_tasks: BackgroundTasks):

    trip = payload.record

    #print("Trip received:")
    #print("Trip ID:", trip.tripid)
    #print("Vehicle:", trip.vehicleid)
    #print("Start:", trip.starttime)
    #print("End:", trip.endtime)
    background_tasks.add_task(
        process_trip,
        trip.tripid,
        trip.vehicleid,
        trip.starttime,
        trip.endtime
    )

    return {"status": "received"}