document.addEventListener("DOMContentLoaded", async function () {
    const tableBody = document.querySelector(".cost-table tbody");
    try {
        const stationResultsResponse = await fetch("/get-station-results");
        const stationResults = await stationResultsResponse.json();

        const taskDescriptionsResponse = await fetch("/get-task-descriptions");
        const taskDescriptions = await taskDescriptionsResponse.json();

        const tableDataResponse = await fetch("/get-table_data");
        const tableData = await tableDataResponse.json(); // JSON-Daten parsen

        const taskTimesResponse = await fetch("/get-task-times");
        const taskTimes = await taskTimesResponse.json(); // JSON-Daten parsen        

        const objectives = [];
        for (const [objective, values] of Object.entries(tableData)) {
            objectives.push(objective);

            // Falls ein Wert fehlt, Standardwert setzen
            const numberOfStations = values.number_of_stations ?? 0;
            const totalNumberOfStations = values.total_number_of_stations ?? 0;
            const costOfOwnership = values.cost_of_ownership ?? 0;
            const fixCosts = values.fix_costs ?? 0;
            const laborCosts = values.labor_costs ?? 0;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${formatTitle(objective)}<strong></td>
                <td>${numberOfStations}</td>
                <td>${totalNumberOfStations}</td>
                <td>${parseInt(costOfOwnership).toLocaleString("en-US")}¥</td>
                <td>${parseInt(fixCosts).toLocaleString("en-US")}¥</td>
                <td>${parseInt(laborCosts).toLocaleString("en-US")}¥</td>
            `;

            tableBody.appendChild(row);
        }

        loadGraphs(objectives, taskDescriptions, taskTimes, stationResults);

        createObjectiveButtons(stationResults, taskDescriptions, taskTimes);       

    } catch (error) {
        console.error("Fehler beim Erstellen der Datei", error);
    }
});

async function loadGraphs(objectives, taskDescriptions, taskTimes, stationResults) {
    const container = document.getElementById("graphContainer");
    container.innerHTML = ""; // Alte Bilder entfernen

    for (const objective of objectives) {
        let graphDiv = document.createElement("div");
        graphDiv.classList.add("graph");
        container.appendChild(graphDiv);
        stations = stationResults[objective];

        if (objective === "Current_Status") {
            const currentStatusTaskTimesResponse = await fetch("/get-current-status-task-times");
            const currentStatusTaskTimes = await currentStatusTaskTimesResponse.json();
            const currentStatusTaskDescriptionsResponse = await fetch("/get-current-status-task-descriptions");
            const currentStatusTaskDescriptions = await currentStatusTaskDescriptionsResponse.json();

            drawGraph(graphDiv, stations, currentStatusTaskTimes, currentStatusTaskDescriptions, objective);

        } else drawGraph(graphDiv, stations, taskTimes, taskDescriptions, objective);
    }
}

function drawGraph(graphDiv, stations, taskTimes, taskDescriptions, objective) {
    const width = graphDiv.clientWidth;
    const height = graphDiv.clientHeight;
    const margin = { top: 40, right: 30, bottom: 40, left: 50 };

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    const svg = d3.select(graphDiv)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const data = [];
    const xLabels = []; // x-Achse bekommt parallele Stationen als Label
    // Flaches data-Array im D3-Format erstellen
    for (let stationId of Object.keys(stations)) {
        const stationInfo = stations[stationId];
        for (let task of stationInfo.assigned_tasks) {
            const key = JSON.stringify([task, stationInfo.station_type]);
            const taskTime = Math.floor((taskTimes[key] || 0) / (stationInfo.parallel_stations || 1));
            data.push({
                station: stationId,
                station_type: stationInfo.station_type,
                task: task,
                actualTime: taskTimes[key] || 0,
                time: taskTime,
                description: taskDescriptions[task] || "Unknown"
            });
        }
        xLabels.push(stationInfo.parallel_stations);
    }

    const grouped = d3.group(data, d => d.station);
    const stationId = Array.from(grouped.keys());

    const xScale = d3.scaleBand()
        .domain(stationId)
        .range([margin.left, width - margin.right])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, 50])
        .range([height - margin.bottom, margin.top]);

    const colorScale = d3.scaleOrdinal()
        .domain(['manual', 'automatic'])
        .range(['#FF7F50', '#0E9682']);
    
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat((d, i) => xLabels[i])); 

    // Beschriftung der x-Achse
    svg.append("text")
        .attr("x", width / 2)  // Zentriert auf der X-Achse
        .attr("y", height - margin.bottom + 30)  // Direkt unter der X-Achse
        .attr("text-anchor", "middle")  // Horizontale Ausrichtung
        .style("font-size", "14px")  // Schriftgröße
        .style("font-weight", "bold")  // Fett
        .text("Number of Workers/Robots");  // Text der X-Achse

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale));

    const stationGroups = svg.selectAll(".station-group")
        .data(Array.from(grouped))
        .enter()
        .append("g")
        .attr("class", "station-group")
        .attr("transform", ([station]) => `translate(${xScale(station)}, 0)`);
    
    stationGroups.each(function([station, tasks]) {
        let yOffset = 0;
        const g = d3.select(this);
        const stationType = tasks[0].station_type;
        const fillColor = colorScale(stationType);
    
        for (let task of tasks) {
            const yTop = yScale(yOffset + task.time);
            const rectHeight = yScale(0) - yScale(task.time);
    
            g.append("rect")
                .attr("x", 0)
                .attr("y", yTop)
                .attr("width", xScale.bandwidth())
                .attr("height", rectHeight)
                .attr("fill", fillColor)
                .attr("stroke", "black")
                .on("mouseover", function(event) {
                    const current = d3.select(this);
                    const original = current.attr("fill");
                    current.attr("data-original-fill", original); // speichern
                    current.attr("fill", d3.color(original).darker(0.5)); // abdunkeln
                
                    tooltip
                        .style("opacity", 1)
                        .html(`<strong>Task ${task.task}</strong><br/>Task Time: ${task.actualTime} seconds<br/>${task.description}`);
                })
                .on("mousemove", function(event) {
                    tooltip
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 20) + "px");
                })
                .on("mouseout", function() {
                    const current = d3.select(this);
                    current.attr("fill", current.attr("data-original-fill")); // Farbe zurücksetzen
                    tooltip.style("opacity", 0);
                });
    
            yOffset += task.time;
        }
    });

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .text(formatTitle(objective))
        .style("font-size", "22px")
        .style("font-weight", "bold");

    const yLinePosition = yScale(50);  // Berechnung der Y-Position bei 50 Sekunden
    svg.append("line")
        .attr("x1", margin.left)  // Startpunkt der Linie (links)
        .attr("x2", width - margin.right)  // Endpunkt der Linie (rechts)
        .attr("y1", yLinePosition)  // Y-Position bei 50 Sekunden
        .attr("y2", yLinePosition)  // Y-Position bleibt gleich, da es eine horizontale Linie ist
        .attr("stroke", "red")  // Farbe der Linie (z. B. rot)
        .attr("stroke-dasharray", "5, 5")  // Das macht die Linie gestrichelt
        .attr("stroke-width", 2);  // Strichbreite der Linie
}

async function createObjectiveButtons(stationResults, taskDescriptions, taskTimes) {
    const buttonContainer = document.querySelector(".button-container");
    
    // Falls der Container bereits Buttons enthält, erst leeren
    buttonContainer.innerHTML = "";

    let firstButton = null;

    for (const key of Object.keys(stationResults)) {
        const button = document.createElement("button");
        button.classList.add("objective-button");
        button.id = key; // Key als ID setzen
        button.textContent = formatTitle(key);

        if (key === "Current_Status") {
            const currentStatusTaskTimesResponse = await fetch("/get-current-status-task-times");
            const currentStatusTaskTimes = await currentStatusTaskTimesResponse.json();
            const currentStatusTaskDescriptionsResponse = await fetch("/get-current-status-task-descriptions");
            const currentStatusTaskDescriptions = await currentStatusTaskDescriptionsResponse.json();

            button.addEventListener("click", function () {
                createLayout(stationResults, this.id, currentStatusTaskDescriptions, currentStatusTaskTimes);
            }); 
            buttonContainer.appendChild(button);

            if (!firstButton) {
                firstButton = button;
                firstButton.classList.add("selected");
                createLayout(stationResults, firstButton.id, currentStatusTaskDescriptions, currentStatusTaskTimes);
            }

        } else {
            button.addEventListener("click", function () {
                createLayout(stationResults, this.id, taskDescriptions, taskTimes);
            }); 
            buttonContainer.appendChild(button);
            if (!firstButton) {
                firstButton = button;
                firstButton.classList.add("selected");
                createLayout(stationResults, firstButton.id, taskDescriptions, taskTimes);
            }
        }
    }
}

function createLayout(stationResults, objective, taskDescriptions, taskTimes) {
    let buttons = document.querySelectorAll('.objective-button');
    buttons.forEach(button => button.classList.remove('selected'));

    let selectedButton = document.getElementById(objective);
    if (selectedButton) {
        selectedButton.classList.add('selected');
    }

    let stations = stationResults[objective];

    const columns = Math.ceil(Object.keys(stations).length / 2);
    const gridContainer = document.querySelector(".grid-container");
    gridContainer.style.setProperty("--columns", columns);

    const rows = Object.keys(stations).length % 2;

    const layoutContainer = document.getElementById('u-layout');
    layoutContainer.innerHTML = '';

    let firstStationId = null;

    for (let stationId of Object.keys(stations)) {
        const stationIdInt = parseInt(stationId, 10);
        const stationInfo = stations[stationIdInt];

        if (!stationInfo) continue;

        if (!firstStationId) firstStationId = stationId;

        const { row, col } = getGridPosition(stationIdInt, columns, rows);

        const stationTypeFormatted = stationInfo.station_type.charAt(0).toUpperCase() + stationInfo.station_type.slice(1);

        const stationDiv = document.createElement("div");
        stationDiv.classList.add("station");
        stationDiv.style.gridRow = row;
        stationDiv.style.gridColumn = col;
        stationDiv.id = `${stationIdInt}`;

        const stationContent = document.createElement("div");
        stationContent.classList.add("station-content");
        stationContent.innerHTML = `<h2>Station ${stationIdInt}: ${stationTypeFormatted}</h2>`;

        stationDiv.addEventListener("click", () => {
            showTaskDescription(stationId, stations, stationInfo.parallel_stations, taskDescriptions, taskTimes, stationInfo.station_type);
        });

        stationDiv.appendChild(stationContent);
        layoutContainer.appendChild(stationDiv);
    }
    if (firstStationId) {
        document.getElementById(firstStationId).classList.add('selected'); // Markiert die erste Station optisch
        showTaskDescription(firstStationId, stations, stations[firstStationId].parallel_stations, taskDescriptions, taskTimes, stations[firstStationId].station_type);
    }
}

function formatTitle(key) {
    return key.replace(/_/g, " ");
}

function getGridPosition(index, columns, rows) {
    let row, col;
    if (rows === 1) {
        if (index < columns) {
            row = 1;
            col = index;
        } else if (index === columns) {
            row = 2;
            col = columns;
        } else {
            row = 3;
            col = 2 * columns - index;
        }
    }

    if (rows === 0) {
        if (index < columns) {
            row = 1;
            col = index;
        } else if (index === columns) {
            row = 2;
            col = columns;
        } else if (index === columns + 1) {
            row = 3;
            col = columns;
        } else {
            row = 4;
            col = 2 * columns - index + 1;
        }
    }
    return { row, col };
}

function showTaskDescription(stationId, stations, parallel_stations, taskDescriptions, taskTimes, stationType){
    let buttons = document.querySelectorAll('.station');
    buttons.forEach(button => button.classList.remove('selected'));

    let selectedButton = document.getElementById(stationId);
    selectedButton.classList.add('selected');

    document.getElementById('station-title').innerText = `Station ${stationId}`;

    if (stationType === 'manual') {
        document.getElementById('parallel-stations').innerText = `Number of Workers: ${parallel_stations}`;
    } else if (stationType === 'automatic') {
        document.getElementById('parallel-stations').innerText = `Number of Robots: ${parallel_stations}`;
    }

    const assignedTasks = stations[stationId].assigned_tasks;

    // let totalTaskTime = 0;
    // for (let taskId of assignedTasks) {
    //     const key = JSON.stringify([taskId, stationType]);
    //    totalTaskTime += taskTimes[key] || 0;
    // }
    // document.getElementById('total-task-time').innerText = `Total Task Time: ${totalTaskTime}`;

    const taskTableBody = document.getElementById("task-info");
    taskTableBody.innerHTML = ""; 

    assignedTasks.forEach(taskId => {
        const row = document.createElement("tr");

        const taskCell = document.createElement("td");
        taskCell.textContent = taskId; // Task ID anzeigen

        const descriptionCell = document.createElement("td");
        descriptionCell.textContent = taskDescriptions[taskId] || "Unknown"; // Task-Beschreibung oder Fallback

        const taskTimesCell = document.createElement("td");
        const key = JSON.stringify([taskId, stationType]);
        taskTimesCell.textContent = taskTimes[key] || "Unknown"; 

        row.appendChild(taskCell);
        row.appendChild(descriptionCell);
        row.appendChild(taskTimesCell);
        taskTableBody.appendChild(row);
    });
}