def minimize_stations(model):
    return sum(model.v[j, p] * model.parallel_costs[p] for j in model.STATIONS for p in model.PARALLELS)

def minimize_fix_costs(model):
    station_costs = sum(model.C[k] * model.w[j, k, p] * p for k in model.TYPES for p in model.PARALLELS for j in model.STATIONS)

    task_specific_costs = sum(model.q[i, k] * model.x[i, j, k, p] * p
                              for i in model.TASKS
                              for j in model.STATIONS
                              for k in model.TYPES
                              for p in model.PARALLELS)
    
    return station_costs + task_specific_costs

def minimize_costs(model):
    fixed_automatic_costs = sum(sum(model.C["automatic"] * model.w[j, "automatic", p] * p for p in model.PARALLELS)
                                    + sum(model.q[i, "automatic"] * model.x[i, j, "automatic", p] * p
                                    for i in model.TASKS
                                    for p in model.PARALLELS)
                                for j in model.STATIONS)

    total_automatic_costs = fixed_automatic_costs * (1 + model.maintenance_costs)

    fixed_manual_costs = sum(sum(model.C["manual"] * model.w[j, "manual", p] * p for p in model.PARALLELS) for j in model.STATIONS)
    task_specific_manual_costs = sum(model.q[i, "manual"] * model.x[i, j, "manual", p] * p for i in model.TASKS for p in model.PARALLELS for j in model.STATIONS)
    total_labor_costs = sum(sum(model.w[j, "manual", p] * model.labor_costs * p for p in model.PARALLELS) for j in model.STATIONS)

    return total_automatic_costs + fixed_manual_costs + task_specific_manual_costs + total_labor_costs

def maximize_automation(model):
    alpha = 1/10
    beta = 9/10
    return sum(alpha * model.w[j, "manual", p] * p for j in model.STATIONS for p in model.PARALLELS) + sum(beta * model.v[j, p] * model.parallel_costs[p] for j in model.STATIONS for p in model.PARALLELS)