let globalLanguage = "en";

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
        const taskTimes = await taskTimesResponse.json();

        const hyperparametersResponse = await fetch("/get-hyperparameters");
        const hyperparameters = await hyperparametersResponse.json();
        cycleTime = hyperparameters["cycle_time"];

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
                <td data-objective="${objective}"><strong>${formatTitle(objective)}</strong></td>
                <td>${numberOfStations}</td>
                <td>${totalNumberOfStations}</td>
                <td>${parseInt(costOfOwnership).toLocaleString("en-US")}¥</td>
                <td>${parseInt(fixCosts).toLocaleString("en-US")}¥</td>
                <td>${parseInt(laborCosts).toLocaleString("en-US")}¥</td>
            `;

            tableBody.appendChild(row);
        }
        console.log(objectives);
        const langEn = document.getElementById("lang-en");
        const langCn = document.getElementById("lang-cn");
    
        // Standardmäßig EN als aktiv
        langEn.classList.add("active");
    
        // Funktion zum Umschalten zwischen den Sprachen
        langEn.addEventListener("click", function() {
            langEn.classList.add("active");
            langCn.classList.remove("active");
            globalLanguage = "en";
            switchLanguage("en");
        });
    
        langCn.addEventListener("click", function() {
            langCn.classList.add("active");
            langEn.classList.remove("active");
            globalLanguage = "cn";
            switchLanguage("cn");
        });

        createParameterTable(hyperparameters);

        loadGraphs(objectives, taskDescriptions, taskTimes, stationResults, cycleTime);

        createObjectiveButtons(stationResults, taskDescriptions, taskTimes);       

    } catch (error) {
        console.error("Fehler beim Erstellen der Datei", error);
    }
});

async function createParameterTable(hyperparameters) {
    document.getElementById("param-cycle-time-value").textContent = `${hyperparameters["cycle_time"]} seconds`;
    document.getElementById("param-manual-cost-value").textContent = `${parseInt(hyperparameters["manual_station_costs"]).toLocaleString("en-US")}¥`;
    document.getElementById("param-auto-cost-value").textContent = `${parseInt(hyperparameters["automatic_station_costs"]).toLocaleString("en-US")}¥`;
    document.getElementById("param-labor-value").textContent = `${parseInt(hyperparameters["labor_costs"]).toLocaleString("en-US")}¥`;
    document.getElementById("param-working-value").textContent = `${hyperparameters["working_hours"]} hours`;
    document.getElementById("param-maintenance-value").textContent = `${hyperparameters["maintenance_costs"] * 100}%`;
    document.getElementById("param-horizon-value").textContent = `${hyperparameters["horizon"]} years`;
  }
  

async function loadGraphs(objectives, taskDescriptions, taskTimes, stationResults, cycleTime) {
    const statusGraph = document.getElementById("current-status-graph");
    statusGraph.innerHTML = "";
    const container = document.getElementById("graphContainer");
    container.innerHTML = ""; // Alte Bilder entfernen

    let graphCount = objectives.length;
    
    if (graphCount === 1) {
        container.classList.add("single-graph");
    } else if (graphCount === 2) {
        container.classList.add("two-graphs");
    } else if (graphCount === 3) {
        container.classList.add("three-graphs");
    } else if (graphCount === 4) {
        container.classList.add("four-graphs");
    } else if (graphCount === 5) {
        container.classList.add("four-graphs");
    }

    for (const objective of objectives) {
        if (objective === "Current_Status") {
            let graphDiv = document.createElement("div");
            graphDiv.classList.add("graph");
            statusGraph.appendChild(graphDiv);
            stations = stationResults[objective];

            const currentStatusTaskTimesResponse = await fetch("/get-current-status-task-times");
            const currentStatusTaskTimes = await currentStatusTaskTimesResponse.json();
            const currentStatusTaskDescriptionsResponse = await fetch("/get-current-status-task-descriptions");
            const currentStatusTaskDescriptions = await currentStatusTaskDescriptionsResponse.json();

            drawGraph(graphDiv, stations, currentStatusTaskTimes, currentStatusTaskDescriptions, objective, cycleTime);

        } else {
            let graphDiv = document.createElement("div");
            graphDiv.classList.add("graph");
            container.appendChild(graphDiv);
            stations = stationResults[objective];
            drawGraph(graphDiv, stations, taskTimes, taskDescriptions, objective, cycleTime);
        }
    }
}

function drawGraph(graphDiv, stations, taskTimes, taskDescriptions, objective, cycleTime) {
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
        .domain([0, cycleTime])
        .range([height - margin.bottom, margin.top]);

    const colorScale = d3.scaleOrdinal()
        .domain(['manual', 'automatic'])
        .range(['#FF7F50', '#0E9682']);
    
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat((d, i) => xLabels[i])); 

    // Beschriftung der x-Achse
    svg.append("text")
        .attr("class", "x-axis-label")
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
                        .html(`
                            <strong>${content[globalLanguage].tooltipTask} ${task.task}</strong><br/>
                            ${content[globalLanguage].tooltipTaskTime}: ${task.actualTime} ${content[globalLanguage].tooltipSeconds}<br/>
                            ${task.description}
                          `);
                        
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
        .attr("class", "graph-title")
        .attr("data-objective", objective)
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .text(formatTitle(objective))
        .style("font-size", "22px")
        .style("font-weight", "bold");

    const yLinePosition = yScale(cycleTime);  // Berechnung der Y-Position bei 50 Sekunden
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
        button.setAttribute("data-objective", key);
        console.log(key);
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
        document.getElementById('parallel-stations').innerText = `${content[globalLanguage].numberOfWorkers}: ${parallel_stations}`;
    } else if (stationType === 'automatic') {
        document.getElementById('parallel-stations').innerText = `${content[globalLanguage].numberOfRobots}: ${parallel_stations}`;
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

content = {
    en: {
        objective: "Objective",
        numberOfProcesses: "Number of Processes",
        numberOfStations: "Number of Stations",
        totalCostOfOwnership: "Total Cost of Ownership",
        initialInvestment: "Initial Investment",
        expectedLaborCosts: "Expected Labor Costs",
        layoutTitle: "Potential Layout",
        stationInfoTask: "Task",
        stationInfoDescription: "Description",
        stationInfoTaskTime: "Task Time",
        tooltipTask: "Task",
        tooltipTaskTime: "Task Time",
        tooltipSeconds: "seconds",
        numberOfWorkers: "Number of Workers",
        numberOfRobots: "Number of Robots",
        cycleTime: "Cycle Time Requirement",
        manualCost: "Initial Cost for Opening a Manual Station",
        autoCost: "Initial Cost for Opening an Automatic Station",
        labor: "Labor Costs per hour",
        workingHours: "Working hours per day",
        maintenance: "Maintenance Costs for automated Stations per year",
        horizon: "Project horizon",
        xAxisLabel: "Number of Workers/Robots",
        objectives: {
            Current_Status: "Current Status",
            Minimize_Total_Cost_of_Ownership: "Minimize Total Cost of Ownership",
            Minimize_Initial_Investment: "Minimize Initial Investment",
            Minimize_Stations: "Minimize Stations",
            Maximize_Automation: "Maximize Automation"
        }
    },

    cn: {
        objective: "目标",
        numberOfProcesses: "流程数量",
        numberOfStations: "站点数量",
        totalCostOfOwnership: "总拥有成本",
        initialInvestment: "初始投资金额",
        expectedLaborCosts: "预计人工成本",
        layoutTitle: "可选布局",
        stationInfoTask: "任务",
        stationInfoDescription: "说明",
        stationInfoTaskTime: "任务时间",
        tooltipTask: "任务",
        tooltipTaskTime: "任务时间",
        tooltipSeconds: "秒",
        numberOfWorkers: "工人数量",
        numberOfRobots: "机器人数量",
        cycleTime: "周期时间要求",
        manualCost: "人工工位的初始成本",
        autoCost: "自动工位的初始成本",
        labor: "每小时人工成本",
        workingHours: "每日工作时长",
        maintenance: "自动工位的年度维护成本",
        horizon: "项目周期",
        xAxisLabel: "工人/机器人数量",
        objectives: {
            Current_Status: "当前状态",
            Minimize_Total_Cost_of_Ownership: "最小化总体拥有成本",
            Minimize_Initial_Investment: "最小化初始投资金额",
            Minimize_Stations: "最小化站点数量",
            Maximize_Automation: "最大自动化程度"
        }
    }
}

function switchLanguage(language){
    document.getElementById("objective").textContent = content[language].objective;
    document.getElementById("number-of-processes").textContent = content[language].numberOfProcesses;
    document.getElementById("number-of-stations").textContent = content[language].numberOfStations;
    document.getElementById("total-cost-of-ownership").textContent = content[language].totalCostOfOwnership;
    document.getElementById("initial-investment").textContent = content[language].initialInvestment;
    document.getElementById("expected-labor-costs").textContent = content[language].expectedLaborCosts;

    document.getElementById("layout-title").textContent = content[language].layoutTitle;

    document.getElementById("station-info-task").textContent = content[language].stationInfoTask;
    document.getElementById("station-info-description").textContent = content[language].stationInfoDescription;
    document.getElementById("station-info-task-time").textContent = content[language].stationInfoTaskTime;

    document.getElementById("param-cycle-time-label").innerHTML = `<strong>${content[language].cycleTime}</strong>`;
    document.getElementById("param-manual-cost-label").innerHTML = `<strong>${content[language].manualCost}</strong>`;
    document.getElementById("param-auto-cost-label").innerHTML = `<strong>${content[language].autoCost}</strong>`;
    document.getElementById("param-labor-label").innerHTML = `<strong>${content[language].labor}</strong>`;
    document.getElementById("param-working-label").innerHTML = `<strong>${content[language].workingHours}</strong>`;
    document.getElementById("param-maintenance-label").innerHTML = `<strong>${content[language].maintenance}</strong>`;
    document.getElementById("param-horizon-label").innerHTML = `<strong>${content[language].horizon}</strong>`;
    
    document.querySelectorAll(".x-axis-label").forEach(el => {
        el.textContent = content[language].xAxisLabel;
    });

    document.querySelectorAll("td[data-objective]").forEach(td => {
        const key = td.getAttribute("data-objective");
        td.innerHTML = `<strong>${content[language].objectives[key]}</strong>`;
    });

    document.querySelectorAll("button[data-objective]").forEach(button => {
        const key = button.getAttribute("data-objective");
        button.textContent = content[language].objectives[key];
    });

    document.querySelectorAll(".graph-title").forEach(title => {
        const key = title.getAttribute("data-objective");
        if (key && content[language].objectives[key]) {
          title.textContent = content[language].objectives[key];
        }
    });
}