let selectedFile = null;
let currentStatusFile = null;
let optimizationInterval = null;

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("toggle-button").addEventListener("click", toggleSelection);
    document.getElementById("start-button").addEventListener("click", startOptimization);
    // document.getElementById("reset-button").addEventListener("click", resetButton);
    // document.getElementById("confirm-reset").addEventListener("click", resetOptimization);
    // document.getElementById("cancel-reset").addEventListener("click", () => {
    //    document.getElementById("reset-modal").style.display = "none";
    // });
    document.getElementById("file-upload").addEventListener("change", function (event) {
        if (event.target.files.length > 0) {
            selectedFile = event.target.files[0];
        } else {
            selectedFile = null; // Falls der User die Datei entfernt
        }
    });
    document.getElementById("status-upload").addEventListener("change", function (event) {
        if (event.target.files.length > 0) {
            currentStatusFile = event.target.files[0];
        } else {
            currentStatusFile = null; // Falls der User die Datei entfernt
        }
    });
    document.getElementById("show-results").addEventListener("click", function () {
        window.location.href = "../report/report.html";
    });
    window.addEventListener("beforeunload", function () {
        selectedFile = null;
        currentStatusFile = null;
        let fileInput = document.getElementById("file-upload");
        let statusInput = document.getElementById("status-upload");
        if (fileInput) {
            fileInput.value = "";
        }
        if (statusInput) {
            statusInput.value = "";
        }
    });
});

function toggleSelection() {
    let parameterSection = document.getElementById("parameter-section");
    let arrow = document.getElementById("arrow");

    parameterSection.classList.toggle("open");

    // Pfeil drehen je nach Status
    if (parameterSection.classList.contains("open")) {
        arrow.style.transform = "rotate(-180deg)"; // Pfeil nach oben
    } else {
        arrow.style.transform = "rotate(0deg)"; // Pfeil nach unten
    }
}

async function startOptimization() {
    let errorMessage = document.getElementById("error-message");
    const selectedObjectives = getSelectedObjectives();

    errorMessage.classList.remove("hidden");

    if (selectedObjectives.length === 0) {
        errorMessage.textContent = "Please select at least one objective!";
        return;
    }
    
    if (!selectedFile) {
        errorMessage.textContent = "No file selected!";
        return
    }
    
    errorMessage.textContent = "Uploading Data...";

    let startButton = document.getElementById("start-button");

    try {
        await uploadData();
        console.log("Data uploaded successfully");

        let response = await fetch("/start-optimization", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        let result = await response.json();
        console.log("Optimization started successfully");

        startButton.disabled = true;

        errorMessage.classList.add("hidden");

        listenForStatus();
        startProgressBar();

    } catch (error) {
        console.error("Error during optimization:", error);
        errorMessage.textContent = error.message;
        errorMessage.classList.remove("hidden");
    }
}

function startProgressBar() {
    let progressMessage = document.getElementById("progress-message");
    let progress = document.getElementById("progress-bar");
    let durationInput = document.getElementById("time-limit").value; 
    let duration = parseFloat(durationInput) * 1000 + 3000;

    document.querySelector(".progress-bar").style.display = "block";
    progressMessage.textContent = "Optimizing...";
    progressMessage.classList.remove("hidden");
    progress.classList.remove("hidden");

    let width = 0;
    let stepCount = 100;
    let stepTime = duration / stepCount;

    optimizationInterval = setInterval(() => {
        if (width >= 100) {
            clearInterval(optimizationInterval);
            optimizationInterval = null;
        } else {
            width += 1;
            progress.style.width = width + "%";
        }
    }, stepTime);
}

async function uploadData() {
    let jsonData = await readExcelFile(selectedFile, "Task Overview");
    let response = await uploadToServer(jsonData, "/upload-data", "task");
    if (!response.ok) {
        let errorData = await response.json();
        throw new Error(errorData.detail || "Unknown error occurred.");
    }
    if (currentStatusFile) {
        let statusData = await readExcelFile(currentStatusFile, "Current Status");
        let responseStatusData = await uploadToServer(statusData, "/upload-current-status-data", "status");
        if (!responseStatusData.ok) {
            let errorData = await responseStatusData.json();
            throw new Error(errorData.detail || "Unknown error occurred.");
        }
        console.log("Uploaded file successfully");
    }
    let responseHyperparameters = await uploadHyperparameters();
    if (!responseHyperparameters.ok) {
        let errorData = await responseHyperparameters.json();
        throw new Error(errorData.detail || "Unknown error occurred.");
    }
}

async function listenForStatus() {
    let progressMessage = document.getElementById("progress-message");
    let showResultsButton = document.getElementById("show-results");

    async function checkStatus() {
        try {
            let response = await fetch("/get-status");
            let data = await response.json();

            console.log("Status received:", data);

            if (data === "Optimization started") {
                progressMessage.textContent = "Optimizing...";
            } else if (data === "Optimization finished") {
                let progress = document.getElementById("progress-bar");
                progressMessage.textContent = "Optimization finished";
                showResultsButton.classList.remove("hidden");
                progress.style.width = "100%";  // Fortschrittsbalken voll machen
                clearInterval(optimizationInterval);
                clearInterval(statusInterval);
            } else {
                progressMessage.textContent = data;
                clearInterval(statusInterval);
                clearInterval(optimizationInterval);
            }
        } catch (error) {
            console.error("Error fetching status:", error);
        }
    }

    let statusInterval = setInterval(checkStatus, 5000);
    checkStatus();
}

function readExcelFile(file, sheetName) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = event.target.result;
                const workbook = XLSX.read(data, { type: "binary" });

                if (!workbook.Sheets[sheetName]) {
                    return reject(new Error(`Error: Sheet ${sheetName} not found`));
                }

                const worksheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error("File reading error."));
        };

    reader.readAsArrayBuffer(file);
    });
}

async function uploadToServer(data, endpoint, fileType) { // "/upload-data"
    let response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: data }),
    });

    if (!response.ok) {
        if (fileType === "task") {
            selectedFile = null;
            document.getElementById("file-upload").value = "";
        }
        if (fileType === "status") {
            currentStatusFile = null;
            document.getElementById("status-upload").value = "";
        }
    }
    return response;
}

async function uploadHyperparameters() {
    const cycleTime = document.getElementById("cycle-time").value;
    const timeLimit = document.getElementById("time-limit").value;
    const manualCost = document.getElementById("manual-cost").value;
    const automaticCost = document.getElementById("automatic-cost").value;
    const laborCosts = document.getElementById("labor-cost").value;
    const workingHours = document.getElementById("working-hours").value;
    const maintenanceCosts = document.getElementById("maintenance-cost").value;
    const horizon = document.getElementById("horizon").value;

    const hyperparameters = {
        cycle_time_requirement: parseInt(cycleTime),
        time_limit: parseInt(timeLimit),
        manual_cost: parseInt(manualCost),
        automatic_cost: parseInt(automaticCost),
        labor_costs: parseInt(laborCosts),
        working_hours: parseFloat(workingHours),
        maintenance_costs: parseFloat(maintenanceCosts),
        horizon: parseFloat(horizon),
        objectives: getSelectedObjectives()
    };

    console.log("Uploading hyperparameters...");
    
    response = await fetch("/upload-hyperparameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hyperparameters: hyperparameters }),
    });

    return response;
}

function getSelectedObjectives() {
    let selectedOjectives = [];

    document.querySelectorAll(".checkbox-container input[type='checkbox']").forEach((checkbox) => {
        if (checkbox.checked) {
            selectedOjectives.push(checkbox.value); // Holt den Wert aus dem `value`-Attribut
        }
    });

    return selectedOjectives;
}

function resetButton() {
    document.getElementById("reset-modal").style.display = "flex";
}

function resetOptimization() {
    let startButton = document.getElementById("start-button");
    let progressMessage = document.getElementById("progress-message");
    let progress = document.getElementById("progress-bar");
    let showResultsButton = document.getElementById("show-results");
    let errorMessage = document.getElementById("error-message");

    fetch("/cancel-optimization", {
        method: "POST",
        mode: "cors",
        headers: {
            "Accept": "application/json"
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to cancel optimization");
        }
        return response.json();
    })
    .then(data => console.log("Optimization cancelled:", data))
    .catch(error => console.error("Error:", error));

    if (optimizationInterval) {
        clearInterval(optimizationInterval);
        optimizationInterval = null; // Intervall aufheben
    }
    progress.style.width = "0%";
    progress.classList.add("hidden");
    progressMessage.classList.add("hidden");
    showResultsButton.classList.add("hidden");
    document.querySelectorAll("input").forEach(input => {
        if (input.type === "number") {
            input.value = input.defaultValue;
        } else if (input.type === "checkbox") {
            input.checked = input.defaultChecked;
        }
        else {
            input.value = "";
        }
    });
    selectedFile = null;
    errorMessage.classList.add("hidden");
    startButton.disabled = false;
    document.getElementById("reset-modal").style.display = "none";
}