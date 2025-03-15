import logging
from pyomo.environ import *
from optimization.constraints import *
from optimization.objectives import *
import optimization.filter as filter

class AssemblyLineModel:
    def __init__(self, objective_function):
        logging.getLogger('pyomo').setLevel(logging.CRITICAL)
        self.objective_function = objective_function
        self.enable_filter = True
        self.model = None

    def build_model(self, cycle_time, tasks, station_types, task_time_dict, precedence_relations,
                    incompatible_tasks, same_station_pairs, station_type_compatibility, station_costs, 
                    process_specific_costs, labor_costs, maintenance_costs, working_hours, horizon, max_number_of_parallel_stations):
        
        model = ConcreteModel()

        products = ["Test"]

        max_stations = len(tasks)

        logging.debug(f"Max Stations: {max_stations}")

        total_labor_costs = labor_costs * working_hours * horizon * 250

        parallel_cost_dict = {i: (i+(0.1*(i-1))**2) for i in range(1, max_number_of_parallel_stations + 1)}

        model.TASKS = Set(initialize=tasks)
        model.STATIONS = Set(initialize=list(range(1, max_stations + 1))) # Initialize STATIONS with an upper bound
        model.TYPES = Set(initialize=station_types)
        model.PARALLELS = Set(initialize=list(range(1, max_number_of_parallel_stations+1))) # Maximum number of parallel stations
        model.PRODUCTS = Set(initialize=products)
        model.PrecedencePairs = Set(initialize=precedence_relations, within=model.TASKS * model.TASKS)
        model.IncompatiblePairs = Set(initialize=incompatible_tasks, within=model.TASKS * model.TASKS)
        model.SameStationPairs = Set(initialize=same_station_pairs, within=model.TASKS * model.TASKS)

        # Parameters
        model.T = Param(initialize=cycle_time) # Cycle time
        model.t = Param(model.TASKS, model.TYPES, initialize=task_time_dict) # Processing time of a task 
        model.F = Param(model.TASKS, model.TYPES, initialize=station_type_compatibility, within=Binary)
        model.C = Param(model.TYPES, initialize=station_costs) # Cost for opening a station
        model.q = Param(model.TASKS, model.TYPES, initialize=process_specific_costs) # Cost for processing a task on a station type
        model.M = Param(initialize=max_stations)
        model.labor_costs = Param(initialize=total_labor_costs) # Labor costs
        model.maintenance_costs = Param(initialize=maintenance_costs) # Maintenance costs
        model.parallel_costs = Param(model.PARALLELS, initialize=parallel_cost_dict) # Costs for parallel stations

        model.x = Var(model.TASKS, model.STATIONS, model.TYPES, model.PARALLELS, within=Binary)  # Task assignment
        model.y = Var(model.STATIONS, model.PARALLELS, within=Binary)  # Helper variable Parallel
        model.z = Var(model.STATIONS, model.TYPES, within=Binary)  # Station type assignment

        if self.enable_filter:
            for i in model.TASKS:
                for j in model.STATIONS:
                    for k in model.TYPES:
                        for p in model.PARALLELS:
                            if not filter.x_is_valid(i, j, k, p, station_type_compatibility, max_stations):
                                model.x[i, j, k, p].fix(0)

        # Constraints
        model.task_assignment = Constraint(model.TASKS, rule=task_assignment_rule)
        model.station_type = Constraint(model.STATIONS, model.TYPES, rule=station_type_rule)
        model.station_type_helper = Constraint(model.STATIONS, rule=station_type_helper_rule)
        model.station_compatibility = Constraint(model.TASKS, model.STATIONS, model.TYPES, model.PARALLELS, rule=compatibility_rule)
        model.cycle_time = Constraint(model.STATIONS, rule=time_rule)
        model.consistent_parallelity = Constraint(model.STATIONS, model.PARALLELS, rule=consistent_parallelity_rule)
        model.parallel_helper = Constraint(model.STATIONS, rule=parallel_helper_rule)
        model.precedence_relations = Constraint(model.PrecedencePairs, rule=precedence_relations_rule)
        model.same_station_pairs_constraint = Constraint(model.SameStationPairs, model.STATIONS, rule=same_station_pairs_rule)

        # Objective
        if self.objective_function == "Minimize_Stations":
            model.v = Var(model.STATIONS, model.PARALLELS, within=Binary)
            model.open_station = Constraint(model.STATIONS, model.PARALLELS, rule=open_station)
            model.objective_function = Objective(rule=minimize_stations, sense=minimize)

        elif self.objective_function == "Minimize_Initial_Investment":
            model.w = Var(model.STATIONS, model.TYPES, model.PARALLELS, within=Binary)
            model.helper_open_station = Constraint(model.STATIONS, model.TYPES, model.PARALLELS, rule=helper_open_station)
            model.objective_function = Objective(rule=minimize_fix_costs, sense=minimize)

        elif self.objective_function == "Minimize_Total_Cost_of_Ownership":
            model.w = Var(model.STATIONS, model.TYPES, model.PARALLELS, within=Binary)
            model.helper_open_station = Constraint(model.STATIONS, model.TYPES, model.PARALLELS, rule=helper_open_station)
            model.objective_function = Objective(rule=minimize_costs, sense=minimize)

        elif self.objective_function == "Maximize_Automation":
            model.v = Var(model.STATIONS, model.PARALLELS, within=Binary)
            model.open_station = Constraint(model.STATIONS, model.PARALLELS, rule=open_station)
            model.w = Var(model.STATIONS, model.TYPES, model.PARALLELS, within=Binary)
            model.helper_open_station = Constraint(model.STATIONS, model.TYPES, model.PARALLELS, rule=helper_open_station)
            model.objective_function = Objective(rule=maximize_automation, sense=minimize)
        
        else:
            raise ValueError("Invalid objective function")

        self.model = model

        return model