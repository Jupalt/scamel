import json

# Beispiel-Dictionary mit Tupel als Schlüssel
data = {(1, "manual"): 8, (2, "auto"): 5}

# Tupel als JSON-kompatiblen String serialisieren
converted_data = {json.dumps(key): value for key, value in data.items()}

# In JSON umwandeln
json_data = json.dumps(converted_data)

print(json_data)
