from optimization.model import AssemblyLineModel as ALM
import optimization.solver as solver
from optimization.result import Result
import pickle
from collections import defaultdict
import logging

def prepare(t, h):
    tasks = t["tasks"]
    task_time_dict = t["task_time_dict"]
    same_station_pairs = t["same_station_pairs"]
    process_specific_costs = t["process_specific_costs"]
    task_descriptions = t["task_descriptions"]
    station_type_compatibility = t["station_type_compatibility"]
    precedence_relations = t["precedence_relations"]
    cycle_time = h["cycle_time"]
    station_types = h["station_types"]
    station_costs = h["station_costs"]
    incompatible_tasks = h["incompatible_tasks"]
    labor_costs = h["labor_costs"]
    working_hours = h["working_hours"]
    maintenance_costs = h["maintenance_costs"]
    horizon = h["horizon"]
    time_limit = h["time_limit"]
    objectives = h["objectives"]

    n_objectives = len(objectives)
    time_limit = int(time_limit / n_objectives)

    max_number_of_parallel_stations = get_number_of_parallel_stations(task_time_dict, tasks, station_types, same_station_pairs, cycle_time)
    logging.info(f"Max number of parallel stations: {max_number_of_parallel_stations}")

    models = {}
    for objective in objectives:
        alm = ALM(objective)
        model = alm.build_model(cycle_time, tasks, station_types, task_time_dict, precedence_relations,
                    incompatible_tasks, same_station_pairs, station_type_compatibility, station_costs, 
                    process_specific_costs, labor_costs, maintenance_costs, working_hours, horizon, max_number_of_parallel_stations)
        
        models[objective] = model

    return models, time_limit, cycle_time, task_time_dict

def save_to_pickle(results, path):
    with open(path, 'wb') as f:
        pickle.dump(results, f)

def load_from_pickle(path):
    with open(path, 'rb') as f:
        results = pickle.load(f)
    
    return results

def get_number_of_parallel_stations(task_time_dict, tasks, station_types, comp, cycle_time):
    graph = defaultdict(list)
    for a, b in comp:
        graph[a].append(b)
        graph[b].append(a)

    visited = set()
    components = []

    def dfs(node, component):
        stack = [node]
        while stack:
            curr = stack.pop()
            if curr not in visited:
                visited.add(curr)
                component.append(curr)
                stack.extend(graph[curr])

    for task in tasks:
        if task not in visited:
            component = []
            dfs(task, component)
            components.append(component)

    logging.info(f"Components: {components}")

    max_task_time = 0
    for component in components:
        a = min(component)
        b = max(component)

        connected_tasks = [task for task in tasks if a <= task <= b]

        for station_type in station_types:
            type_max_task_time = sum(task_time_dict[(task, station_type)] for task in connected_tasks)
            if type_max_task_time > max_task_time:
                max_task_time = type_max_task_time

    logging.info(f"Max task time: {max_task_time}")

    return (max_task_time + cycle_time - 1) // cycle_time # Aufrunden