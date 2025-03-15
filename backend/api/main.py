from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from typing import List, Any
import api.data_processing as dp
import optimization.main as optimizer
from optimization.solver import Solver
import pickle
import json
import os
import logging

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
app.mount("/input", StaticFiles(directory=os.path.join(FRONTEND_DIR, "input"), html=True), name="input")
app.mount("/report", StaticFiles(directory=os.path.join(FRONTEND_DIR, "report"), html=True), name="report")

solver = Solver(solver_name="gurobi")

optimization_data = {
    "task_information": None,
    "hyperparameters": None
}
task_descriptions = None
results = None
task_time_dict = None
optimization_status = {"status": "Optimization not started"}

class InputData(BaseModel):
    data: List

class Hyperparameters(BaseModel):
    hyperparameters: Any

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "input", "index.html"))

@app.post("/upload-data")
async def upload_data(payload: InputData):
    """Processes the Excel-file"""
    global task_descriptions
    received_data = payload.data
    try:
        optimization_data["task_information"] = dp.process_input_data(received_data)
        task_descriptions = optimization_data["task_information"]["task_descriptions"]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing Excel-file: {str(e)}")

    return JSONResponse(content={"message": "Excel Upload successfull"}, status_code=200)

@app.post("/upload-hyperparameters")
async def upload_hyperparameters(payload: Hyperparameters):
    try:
        hyperparameters = payload.hyperparameters
        optimization_data["hyperparameters"] = dp.process_hyperparameters(hyperparameters)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{str(e)}")
    return JSONResponse(content={"message": "Hyperparameters processed successfully"}, status_code=200)

@app.get("/start-optimization")
async def start_optimization(background_tasks: BackgroundTasks, save_to_pickle=False):
    global task_time_dict
    models, time_limit, cycle_time, task_time_dict = optimizer.prepare(optimization_data["task_information"], optimization_data["hyperparameters"])
    try:
        background_tasks.add_task(run_optimization, models, time_limit, cycle_time, task_time_dict, save_to_pickle)
        optimization_status["status"] = "Optimization started"
        return {"message": "Optimization started successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def run_optimization(models, time_limit, cycle_time, task_time_dict, save_to_pickle):
    global results
    try:
        results = solver.solve(models, time_limit)
        if save_to_pickle:
            optimizer.save_to_pickle(results, "results.pkl")
        optimization_status["status"] = "Optimization finished"

    except Exception as e:
        logging.info(f"Error: {e}")
        optimization_status["status"] = f"Optimization failed. Reason: {str(e)}"
        raise Exception(str(e))

    try:
        for objective, result in results.items():
            result.build_station_time_graph(cycle_time, task_time_dict)
    except Exception as e:
        raise Exception(f"Couldn't create result graph")

@app.get("/get-status")
async def get_status():
    return JSONResponse(content=optimization_status["status"])

@app.get("/get-station-results")
async def get_station_results(from_pickle=False, pickle_path="results.pkl"):
    if from_pickle:
        local_results = optimizer.load_from_pickle(pickle_path)
    else:
        local_results = results

    all_station_results = {}
    for objective, result in local_results.items():
        station_results = result.station_results
        all_station_results[objective] = station_results

    return JSONResponse(content=all_station_results)

@app.get("/get-table_data")
async def get_table_data(from_pickle=False, pickle_path="results.pkl"):
    global results

    if from_pickle:
        local_results = optimizer.load_from_pickle(pickle_path)
    else:
        local_results = results

    data = {}
    for objective, result in local_results.items():
        table_data = result.table_data
        data[objective] = table_data

    return JSONResponse(content=data)

@app.get("/get-task-descriptions")
async def get_task_descriptions():
    return JSONResponse(content=task_descriptions)

@app.get("/get-task-times")
async def get_task_times():
    json_data = convert_tuple_key_to_strings(task_time_dict)
    return JSONResponse(content=json_data)

def convert_tuple_key_to_strings(dictionary):
    converted_dict = {json.dumps(list(key), separators=(',', ':')): value for key, value in dictionary.items()}
    return converted_dict

@app.get("/graph/{objective}")
def get_graph(objective: str):
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "optimization", "graphs"))
    filename = os.path.join(BASE_DIR, f"{objective}.png")
    logging.info(f"Sending file: {filename}")
    return FileResponse(
        filename,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

def start_server(port=8000):
    logging.getLogger("uvicorn.access").handlers = []  # Entfernt alle Handler für HTTP-Logs
    logging.getLogger("uvicorn.access").propagate = False
    uvicorn.run("api.main:app", host="127.0.0.1", port=port, log_level="info", access_log=False)
    