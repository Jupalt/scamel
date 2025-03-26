import logging

def process_input_data(data):
    """
    Data should have the format:
    ['tasks', 'description', 'manual_times', 'automatic_times', 'manual_costs', 'automatic_costs', 'compatibility']
    """
    try:
        if not data or len(data) < 2:
            raise ValueError("File is empty or does not contain enough rows")
        
        headers = data[0]

        if len(headers) < 9:
            raise ValueError("File should have 9 columns")
        
        records = [row for row in data[1:] if any(cell is not None and str(cell).strip() for cell in row)]

        logging.debug(f"Records: {records}")

        tasks = []
        task_time_dict = {}
        process_specific_costs = {}
        task_descriptions = {}
        station_type_compatibility = {}

        for index, row in enumerate(records, start=2):
            try: 
                try:
                    task_id = int(row[0])
                except ValueError:
                    raise ValueError(f"Task ID in row {index} is not a number")
                
                tasks.append(task_id)
                task_descriptions[task_id] = row[1] if row[1] is not None else "Unknown"

                try: 
                    if row[5] == "n":
                        station_type_compatibility[(task_id, "manual")] = 0
                    else:
                        station_type_compatibility[(task_id, "manual")] = 1
                except:
                    raise ValueError(f"Unknown error in row {row} in column 3")
                
                try:
                    if row[5] == "n":
                        task_time_dict[(task_id, "manual")] = 0
                        station_type_compatibility[(task_id, "manual")] = 0
                    else:
                        task_time_dict[(task_id, "manual")] = int(row[5])
                        station_type_compatibility[(task_id, "manual")] = 1
                except ValueError:
                    raise ValueError(f"Manual Task Time in row {index} is not a number or n")

                try:
                    if row[6] == "n":
                        task_time_dict[(task_id, "automatic")] = 0
                        station_type_compatibility[(task_id, "automatic")] = 0
                    else:
                        task_time_dict[(task_id, "automatic")] = int(row[6])
                        station_type_compatibility[(task_id, "automatic")] = 1 
                except ValueError:
                    raise ValueError(f"Automatic Task Time in row {index} is not a number or n")

                if row[5] == "n" and row[6] == "n":
                    raise ValueError(f"Task {task_id} in row {index} is not compatible with any station type, which makes the problem unsolvable")

                def check_for_int(value, col):
                    if value == "n":
                        return 0
                    try:
                        return int(value)
                    except ValueError:
                        raise ValueError(f"Invalid value in row {index} in column {col} Station Cost")
                    
                process_specific_costs[(task_id, "manual")] = check_for_int(row[7], "Manual")
                process_specific_costs[(task_id, "automatic")] = check_for_int(row[8], "Automatic")  

            except Exception as e:
                if isinstance(e, ValueError): 
                    raise ValueError(str(e))
                else:
                    raise ValueError(f"Invalid data in row {index}") 


        precedence_relations = get_pairs(records, tasks, 2, "Precedence")
        same_station_pairs = get_pairs(records, tasks, 3, "Same Station Pair")
        incompatible = get_pairs(records, tasks, 4, "Incompatible Task")

        logging.debug(f"Tasks: {tasks}")
        logging.debug(f"Task Time Dictionary: {task_time_dict}")
        logging.debug(f"Same Station Pairs: {same_station_pairs}")
        logging.debug(f"Process Specific Costs: {process_specific_costs}")
        logging.debug(f"Task Descriptions: {task_descriptions}")
        logging.debug(f"Station Type Compatibility: {station_type_compatibility}")
        logging.debug(f"Precedence Relations: {precedence_relations}")

        return {
            "tasks": tasks,
            "task_time_dict": task_time_dict,
            "same_station_pairs": same_station_pairs,
            "process_specific_costs": process_specific_costs,
            "task_descriptions": task_descriptions,
            "station_type_compatibility": station_type_compatibility,
            "precedence_relations": precedence_relations,
            "incompatible_tasks": incompatible
        }
    
    except Exception as e:
        if isinstance(e, ValueError):
            raise ValueError(str(e))
        else:
            raise ValueError("Reason unknown") 

def get_pairs(records, tasks, column, type):
    pairs = []
    for index, row in enumerate(records, start=2):
        task_id = int(row[0])
        a = row[column]

        if not a:
            continue

        try:
            try:
                a = int(a)
            except ValueError:
                raise ValueError(f"{type} in row {index} is not a number")
            if a not in tasks:
                raise ValueError(f"{type} in row {index} is not a valid task ID")
            if a:
                pairs.append((a, task_id))
 
        except Exception as e:
            if isinstance(e, ValueError): 
                raise ValueError(str(e))
            else:
                raise ValueError(f"Invalid {type} in row {index}")
            
    return pairs

def process_hyperparameters(data):
    cycle_time = data["cycle_time_requirement"]
    if cycle_time is None: 
        raise ValueError("Required Cycle Time is not defined")
    
    time_limit = data["time_limit"]
    if time_limit is None:
        raise ValueError("Time Limit is not defined")
    
    manual_station_costs = data["manual_cost"]
    if manual_station_costs is None:
        raise ValueError("Manual Station Costs are not defined")
    
    automatic_station_costs = data["automatic_cost"]
    if automatic_station_costs is None:
        raise ValueError("Automatic Station Costs are not defined")
    
    station_costs = {
        "manual": manual_station_costs,
        "automatic": automatic_station_costs
    }

    labor_costs = data["labor_costs"]
    if labor_costs is None:
        raise ValueError("Labor Costs are not defined")
    
    working_hours = data["working_hours"]
    if working_hours is None:
        raise ValueError("Working Hours are not defined")
    
    maintenance_costs = data["maintenance_costs"] / 100
    if maintenance_costs is None:
        raise ValueError("Maintenance Costs are not defined")
    
    horizon = data["horizon"]
    if horizon is None:
        raise ValueError("Horizon is not defined")
    
    objectives = data["objectives"]

    if (time_limit / len(objectives) < 10):
        if len(objectives) == 1:
            raise ValueError(f"For {len(objectives)} Objective the Time Limit should be at least {10 * len(objectives)} Seconds!")
        else:
            raise ValueError(f"For {len(objectives)} Objectives the Time Limit should be at least {10 * len(objectives)} Seconds!")

    station_types = data.get("station_types", list(station_costs.keys()))

    return {
        "cycle_time": cycle_time,
        "station_costs": station_costs,
        "station_types": station_types,
        "labor_costs": labor_costs,
        "working_hours": working_hours,
        "maintenance_costs": maintenance_costs,
        "horizon": horizon,
        "objectives": objectives,
        "time_limit": time_limit
    }

def default_precedence_relations(tasks):
    """
    Generates a default precedence relation for the given tasks. Tasks are ordered in a sequence.
    """
    # Generate precedence relations for consecutive tasks with relevance 1
    return [(tasks[i], tasks[i+1]) for i in range(len(tasks) - 1)]

def process_current_status_data(data):
    records = [row for row in data[1:] if any(cell is not None and str(cell).strip() for cell in row)]

    station_results = {}
    task_specific_costs = {}
    task_time_dict = {}
    task_descritptions = {}

    station = 1
    station_type = "manual"
    parallel_stations = 1

    for index, row in enumerate(records, start=2):
        if row[3] is not None:
            station = int(row[3])
            station_type = row[4]
            parallel_stations = int(row[5])

        try:
            task_id = int(row[0])
        except ValueError:
            raise ValueError(f"Task ID in row {index} is not a number")
        
        task_descritptions[task_id] = row[1] if row[1] is not None else "Unknown"

        task_time_dict[(task_id, station_type)] = int(row[2])
        
        if station not in station_results:
            station_results[station] = {
                "station_type": station_type,
                "assigned_tasks": [task_id],
                "parallel_stations": parallel_stations
            }
        else:
            # Falls station_results[j] schon existiert, füge die Aufgabe hinzu
            station_results[station]["assigned_tasks"].append(task_id)

        task_specific_costs[task_id] = int(row[6])

    return station_results, task_specific_costs, task_time_dict, task_descritptions