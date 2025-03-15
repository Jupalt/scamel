def x_is_valid(i, j, k, p, station_type_compatibility, max_stations):
    if not station_type_compatibility[(i, k)]:
        return False
    if i < j: 
        return False
    return True