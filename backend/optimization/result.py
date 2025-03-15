import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
import matplotlib.lines as mlines
import os
import logging

class Result:
    def __init__(self, solved_model, objective):
        self.solved_model = solved_model
        self.objective = objective
        self.station_results = self.generate_station_results()
        self.table_data = self.generate_table_data()

    def generate_station_results(self):
        station_results = {}

        # Iterate over all stations
        for j in self.solved_model.STATIONS:
            for i in self.solved_model.TASKS:
                for k in self.solved_model.TYPES:
                    for p in self.solved_model.PARALLELS:
                        if self.solved_model.x[i, j, k, p].value == 1:
                            if j not in station_results:
                                station_results[j] = {
                                    "station_type": k,  # Setze den station_type
                                    "assigned_tasks": [i],  # Initialisiere die Liste mit der aktuellen Aufgabe
                                    "parallel_stations": p,  # Setze parallel_stations
                                }
                            else:
                                # Falls station_results[j] schon existiert, füge die Aufgabe hinzu
                                station_results[j]["assigned_tasks"].append(i)
        
        new_station_results = {i + 1: value for i, (key, value) in enumerate(station_results.items())}
        station_results = new_station_results

        return station_results
    
    def generate_table_data(self):
        return {
            'number_of_stations': self.calculate_number_of_stations(),
            'total_number_of_stations': self.calculate_total_number_of_stations(),
            'cost_of_ownership': self.calculate_total_costs(),
            'fix_costs': self.calculate_fix_costs(),
            'labor_costs': self.calculate_labor_costs(),
        }

    def calculate_total_costs(self):
        fix_costs = self.calculate_fix_costs()
        labor_costs = self.calculate_labor_costs()
        maintenance_costs = self.calculate_maintenance_costs()
        costs = fix_costs + labor_costs + maintenance_costs
        return costs
    
    def calculate_number_of_stations(self):
        return len(self.station_results)

    def calculate_total_number_of_stations(self):
        n = 0
        for station in self.station_results.values():
            n += int(station["parallel_stations"])
        return n

    def calculate_fix_costs(self):
        """Calculates the fix costs"""
        costs = 0
        # Fix costs for opening the stations
        for station in self.station_results.values():
            costs += (self.solved_model.C[station["station_type"]] * int(station["parallel_stations"]))

        # Task specific costs
        for station in self.station_results.values():
            for task in station["assigned_tasks"]:
                costs += (self.solved_model.q[task, station["station_type"]] * int(station["parallel_stations"]))
        return costs

    def calculate_labor_costs(self):
        """Calculates the labor costs per year"""
        n  = 0
        for station in self.station_results.values():
            if station["station_type"] == "manual":
                n += int(station["parallel_stations"])
        return n * self.solved_model.labor_costs.value
    
    def calculate_maintenance_costs(self):
        """Calculates the maintenance costs per year"""
        costs = 0
        for station in self.station_results.values():
            if station["station_type"] == "automatic":
                costs += (self.solved_model.C[station["station_type"]] * int(station["parallel_stations"]))
                for task in station["assigned_tasks"]:
                    costs += (self.solved_model.q[task, station["station_type"]] * int(station["parallel_stations"]))
        return costs * self.solved_model.maintenance_costs.value

    def build_station_time_graph(self, cycle_time, task_time_dict, task_number=True):
        # Prepare by extracting relevant data
        station_info = {}
        for station_count, (station, info) in enumerate(self.station_results.items(), start=1):
            tasks = info["assigned_tasks"]
            station_type = info["station_type"]
            parallel_stations = info["parallel_stations"]
            task_times = [task_time_dict[(task, station_type)] for task in tasks]
            
            # Save relevant data in dictionary
            station_info[station_count] = {
                "task_times": task_times,
                "tasks": tasks,
                "station_type": station_type,
                "parallel_stations": parallel_stations
            }

        # Colors for station types
        station_type_colors = {
            "automatic": "#0E9682",  # green
            "manual": "#FF7F50"      # orange
        }

        fig, ax = plt.subplots(figsize=(10, 6))

        current_position = 1
        p = []  # List of number of parallel stations for x-Axis
        for station_data in station_info.values():
            p.append(station_data["parallel_stations"])

        # Create Diagram
        for station_count, data in station_info.items():
            task_times = data["task_times"]
            tasks = data["tasks"]
            station_type = data["station_type"]
            parallel_stations = data["parallel_stations"]
            
            bar_color = station_type_colors.get(station_type, "#D3D3D3")  # Standard color if type is unknown
            bottom = 0 

            # Creates the stacked bars for each task
            for task_time, task in zip(task_times, tasks):
                task_time /= parallel_stations  # Reduce task time by dividing with number of parallel stations

                ax.bar(current_position, task_time, bottom=bottom, color=bar_color, edgecolor='black', linewidth=1)
                
                if task_number:
                    # Shows the task number 
                    middle = bottom + task_time / 2
                    ax.text(current_position, middle, str(task), ha='center', va='center', fontsize=9, color='black', fontweight='bold')

                bottom += task_time

            current_position += 1

        # Add Max Time as horizontal line
        ax.axhline(y=cycle_time, color='red', linestyle='--', label='Max Cycle Time')

        # Set Axis and title
        station_keys = list(station_info.keys())
        ax.set_xticks(station_keys) 
        ax.set_xticklabels(p)  # Labelling x-Axis with number of parallel stations
        ax.set_xlabel('Number of Workers/Robots')
        ax.set_ylabel('Total Time (Seconds)')
        ax.set_title(self.objective.replace("_", " "))

        ax.set_ylim(0, cycle_time + 5)
        
        # Create Legend
        legend_elements = [
            Patch(facecolor=color, edgecolor='black', label=station_type) 
            for station_type, color in station_type_colors.items()
        ]
        max_cycle_time_line = mlines.Line2D([], [], color='red', linestyle='--', label='Max Cycle Time')
        ax.legend(handles=legend_elements + [max_cycle_time_line], loc='upper right')

        # Save Diagram
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        folder_path = os.path.join(BASE_DIR, "graphs")
        os.makedirs(folder_path, exist_ok=True)
        result_graph_path = os.path.join(folder_path, f"{self.objective}.png")
        plt.savefig(result_graph_path, dpi=200)
        plt.close()
        logging.info(f"Saved Diagram to '{result_graph_path}'")

        return result_graph_path