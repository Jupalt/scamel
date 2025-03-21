document.addEventListener("DOMContentLoaded", async function () {
    const tableBody = document.querySelector(".cost-table tbody");
    try {
        const stationResultsResponse = await fetch("/get-station-results", {
            method: "GET",
            mode: "cors",
            headers: {
                "Accept": "application/json"
            }
        });
        const stationResults = await stationResultsResponse.json();

        const taskDescriptionsResponse = await fetch("/get-task-descriptions", {
            method: "GET",
            mode: "cors",
            headers: {
                "Accept": "application/json"
            }
        });
        const taskDescriptions = await taskDescriptionsResponse.json();

        const tableDataResponse = await fetch("/get-table_data", {
            method: "GET",
            mode: "cors",  // WICHTIG für CORS
            headers: {
                "Accept": "application/json",  // Kein "Content-Type", um Preflight zu vermeiden
            },
        });
        const tableData = await tableDataResponse.json(); // JSON-Daten parsen

        const taskTimesResponse = await fetch("/get-task-times", {
            method: "GET",
            mode: "cors",  // WICHTIG für CORS
            headers: {
                "Accept": "application/json",  // Kein "Content-Type", um Preflight zu vermeiden
            },
        });
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

        loadGraphs(objectives)

        createObjectiveButtons(stationResults, taskDescriptions, taskTimes);
        document.getElementById("download-btn").addEventListener("click", function () {
            createPDF(objectives, tableData);
        });        

    } catch (error) {
        console.error("Fehler beim Erstellen der Datei", error);
    }
});

function loadGraphs(objectives) {
    const container = document.getElementById("graphContainer");
    container.innerHTML = ""; // Alte Bilder entfernen

    objectives.forEach(async (objective) => {
        try {
            let response = await fetch(`/graph/${objective}?t=${Date.now()}`, {
                method: "GET",
                headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
            });

            if (!response.ok) throw new Error(`Fehler beim Laden: ${response.status}`);

            let blob = await response.blob();
            let imgUrl = URL.createObjectURL(blob);

            let img = document.createElement("img");
            img.src = imgUrl;
            img.alt = `Graph for ${objective}`;
            img.style.width = "100%";
            container.appendChild(img);
        } catch (error) {
            console.error("Fehler beim Laden des Graphs:", error);
        }
    });
}

function createObjectiveButtons(stationResults, taskDescriptions, taskTimes) {
    const buttonContainer = document.querySelector(".button-container");
    
    // Falls der Container bereits Buttons enthält, erst leeren
    buttonContainer.innerHTML = "";

    let firstButton = null;

    for (const key of Object.keys(stationResults)) {
        const button = document.createElement("button");
        button.classList.add("objective-button");
        button.id = key; // Key als ID setzen
        button.textContent = formatTitle(key);

        button.addEventListener("click", function () {
            createLayout(stationResults, this.id, taskDescriptions, taskTimes);
        });

        if (!firstButton) firstButton = button;

        buttonContainer.appendChild(button);
    }

    if (firstButton) {
        firstButton.classList.add("selected"); // Button optisch hervorheben
        createLayout(stationResults, firstButton.id, taskDescriptions, taskTimes); // Layout direkt laden
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

    console.log(taskTimes);
    console.log(stationType);

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

async function createPDF(objectives, tableData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // **Überschrift zentrieren**
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    const pageWidth = doc.internal.pageSize.width;
    const text = "Assembly Line Balancing Report";
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, 15);

    // **Tabelle hinzufügen**
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.autoTable({
        startY: 25,
        head: [["Objective", "Number of Processes", "Number of Stations", "Total Cost of Ownership", "Initial Investment Cost", "Labor Costs"]],
        body: objectives.map(obj => [
            formatTitle(obj),
            tableData[obj]?.number_of_stations ?? 0,
            tableData[obj]?.total_number_of_stations ?? 0,
            `${parseInt(tableData[obj]?.cost_of_ownership ?? 0).toLocaleString("en-US")}¥`,
            `${parseInt(tableData[obj]?.fix_costs ?? 0).toLocaleString("en-US")}¥`,
            `${parseInt(tableData[obj]?.labor_costs ?? 0).toLocaleString("en-US")}¥`
        ]),
        headStyles: { fillColor: [14, 150, 130], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    let startY = doc.autoTable.previous.finalY + 10; // Position unter der Tabelle

    // **Bilder laden und Höhe automatisch berechnen**
    let imageBlobs = await Promise.all(objectives.map(async (objective) => {
        try {
            let response = await fetch(`/graph/${objective}?t=${Date.now()}`, {
                method: "GET",
                headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
            });

            if (!response.ok) throw new Error(`Fehler beim Laden: ${response.status}`);

            let blob = await response.blob();
            return { blob, objective };
        } catch (error) {
            console.error("Fehler beim Laden des Graphs:", error);
            return null;
        }
    }));

    imageBlobs = imageBlobs.filter(img => img !== null); // Entferne fehlerhafte Bilder

    const maxWidth = 100; // Maximale Breite in mm
    const margin = 5; // Abstand zwischen den Bildern
    const pageMargin = 10; // Seitenrand

    let y = startY;
    let x = pageMargin;

    for (let i = 0; i < imageBlobs.length; i++) {
        const img = new Image();
        img.src = URL.createObjectURL(imageBlobs[i].blob);

        await new Promise((resolve) => {
            img.onload = function () {
                const aspectRatio = img.naturalHeight / img.naturalWidth; // Höhe/Breite-Verhältnis
                const imgHeight = maxWidth * aspectRatio; // Automatisch berechnete Höhe

                if (i % 2 === 1) {
                    x = pageWidth - pageMargin - maxWidth; // Rechtsbündiges Bild
                } else {
                    x = pageMargin; // Linksbündiges Bild
                    if (i > 0) y += imgHeight + margin; // Neue Zeile nach jedem zweiten Bild
                }

                doc.addImage(img, "PNG", x, y, maxWidth, imgHeight);
                resolve();
            };
        });
    }

    doc.save("Assembly_Line_Balancing_Report.pdf");
}


// **Hilfsfunktion: Blob in Base64 konvertieren für jsPDF**
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
