"""
This module contains the function for solving the optimization model using a specified solver.
Available solvers:
    - Gurobi
    - SCIP
    - Appsi Highs
"""

from pyomo.opt import SolverFactory, TerminationCondition
from backend.optimization.result import Result
import logging

SOLVER_NAME = "gurobi" # Alternative: appsi_highs
class Solver: 
    def __init__(self):
        self.solver_name = SOLVER_NAME
        self.solver = None

    def solve(self, models, time_limit):
        results = {}
        for objective, model in models.items():
            solved_model = self.execute(model, time_limit)
            results[objective] = Result(solved_model, objective)
        
        return results

    def execute(self, model, time_limit):
        """
        Parameters: 
        ----------
        model: pyomo.environ.ConcreteModel
            The optimization model to be solved
        time_limit: int
            The time limit (in seconds) for the optimization process before it terminates
        """
        # Initialize
        logging.info(f"Time Limit: {time_limit} seconds")
        self.solver = SolverFactory(self.solver_name)
        if not self.solver.available():
            logging.info(f"{self.solver_name} solver is not available!")
            return None
        else:
            logging.info(f"Using {self.solver_name} to solve the model.")
            self.is_running = True

            if self.solver_name == "gurobi":
                self.solver.options['Heuristics'] = 1.0
                self.solver.options['MIPFocus'] = 2
                self.solver.options['TimeLimit'] = time_limit
                self.solver.options['MIPGap'] = 0.00
            elif self.solver_name == "scip":
                self.solver.options['limits/time'] = time_limit
                # solver.options['cuts'] = 'strong'
                self.solver.options['presolving'] = 1
                self.solver.options['threads'] = 4
                self.solver.options['decomposition'] = 'block'
            elif self.solver_name == "appsi_highs":
                self.solver.options['time_limit'] = time_limit

            # Solve the model
            try: 
                results = self.solver.solve(model, tee=False)
            except:
                raise Exception("No solution found. Please increase the time limit")

            if results.solver.termination_condition == TerminationCondition.infeasible:
                raise Exception("Problem is not solvable")
            
            return model