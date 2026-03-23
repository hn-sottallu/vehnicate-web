from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import pandas as pd
from supabase import create_client
from aliv_module import AlivRoadDefects  # your file
from datetime import timedelta
import h3 as h3lib
import os
from dotenv import load_dotenv

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
def enrich_events(tripid, vehicleid, result, df):
    enriched = []

    for event in result["speedbreakers"]:
        start_time = event["start_time"]
        end_time = event["end_time"]

        # 🔹 Filter raw data within time range
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
            "end_time_ms": end_time_ms
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
    df["time_ms"] = df["timesent"].astype("int64") // 10**6

    # running Aliv
    result = aliv_roadDefects(all_data)
    if not result.get("speedbreakers"):
        print("No events detected")
        return
    
    enriched_events = enrich_events(tripid, vehicleid, result, df)
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

            #backtracking 2.5seconds
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
            print(images[:2])
            for img in images:
                images_to_insert.append({
                    "vehicle_id": vehicleid,
                    "trip_id": tripid,
                    "h3_index": h3_index,
                    "image_url": img["file_url"],
                    "event_id": event_id,
                    "timestamp": img["timestamp"]
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