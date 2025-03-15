# Every Task is assigned to exactly one station
def task_assignment_rule(model, i):
    return sum(model.x[i, j, k, p] for j in model.STATIONS for k in model.TYPES for p in model.PARALLELS) == 1

# Every Station has exactly one station type
def station_type_rule(model, j, k):
    return sum(model.x[i, j, k, p] for i in model.TASKS for p in model.PARALLELS) <= model.M * model.z[j, k]

# Every Station has exactly one degree of parallelity
def station_type_helper_rule(model, j):
    return sum(model.z[j, k] for k in model.TYPES) == 1

# A Task is only assigned to stations with acceptable station types
def compatibility_rule(model, i, j, k, p):
    return model.x[i, j, k, p] <= model.F[i, k]

# The task times don't exceed the cycle time T
def time_rule(model, j):
    return sum((model.t[i, k] * model.x[i, j, k, p])/p for i in model.TASKS for k in model.TYPES for p in model.PARALLELS) <= model.T

# Different task assigned to one station have the same degree of parallelity
def consistent_parallelity_rule(model, j, p):
    return sum(model.x[i, j, k, p] for i in model.TASKS for k in model.TYPES) <= model.M * model.y[j, p]

# Every Station has exactly one degree of parallelity
def parallel_helper_rule(model, j):
    return sum(model.y[j, p] for p in model.PARALLELS) == 1

# Precedence relations
def precedence_relations_rule(model, g, h):
    return sum(j * model.x[g, j, k, p] for j in model.STATIONS for k in model.TYPES for p in model.PARALLELS) <= sum(j * model.x[h, j, k, p] for j in model.STATIONS for k in model.TYPES for p in model.PARALLELS)

# Same Station Tasks: Task m and n must be assigned to the same station
def same_station_pairs_rule(model, m, n, j):
    return sum(model.x[m, j, k, p] for k in model.TYPES for p in model.PARALLELS) == sum(model.x[n, j, k, p] for k in model.TYPES for p in model.PARALLELS)

def open_station(model, j, p):
    return sum(model.x[i, j, k, p] for i in model.TASKS for k in model.TYPES) <= model.v[j, p] * model.M

def helper_open_station(model, j, k, p):
    return sum(model.x[i, j, k, p] for i in model.TASKS) <= model.w[j, k, p] * model.M