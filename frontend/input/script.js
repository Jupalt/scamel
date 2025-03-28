let selectedFile = null;
let currentStatusFile = null;
let optimizationInterval = null;

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("toggle-button").addEventListener("click", toggleSelection);
    document.getElementById("start-button").addEventListener("click", startOptimization);
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
    const langEn = document.getElementById("lang-en");
    const langCn = document.getElementById("lang-cn");

    // Standardmäßig EN als aktiv
    langEn.classList.add("active");

    // Funktion zum Umschalten zwischen den Sprachen
    langEn.addEventListener("click", function() {
        langEn.classList.add("active");
        langCn.classList.remove("active");
        switchLanguage("en");
    });

    langCn.addEventListener("click", function() {
        langCn.classList.add("active");
        langEn.classList.remove("active");
        switchLanguage("cn");
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

const content = {
    en: {
        tutorial: "Choose Optimization Goals and Parameters and Upload the Excel-file",
        checkboxLabel: "Objectives:",
        Checkbox_Minimize_Total_Cost_of_Ownership: " Minimize Total Cost of Ownership",
        Checkbox_Minimize_Initial_Investment: " Minimize Initial Investment",
        Checkbox_Minimize_Stations: " Minimize Number of Stations",
        Checkbox_Maximize_Automation: " Maximize Degree of Automation",
        toggleButton: "Adjust Parameters ",
        cycleTimeInput: "Cycle Time Requirement (in Seconds):",
        timeLimitInput: "Time Limit for Optimization (in Seconds):",
        manualCostInput: "Initial Cost for Opening a Manual Station:",
        automaticCostInput: "Initial Cost for Opening an Automatic Station:",
        laborCostsInput: "Labor Costs per hour:",
        workingHoursInput: "Daily Working hours:",
        maintenanceCostsInput: "Maintenance Cost for automated Stations (%):",
        horizonInput: "Planning horizon (in years):",
        fileUploadLabel: "Upload Task Overview Excel File",
        statusUploadLabel: "Upload Current Status Excel File",
        startButton: "Start Optimization",
        showResults: "Show Results",
    },
    cn: {
        tutorial: "选择优化目标和参数并上传 Excel 文件",
        checkboxLabel: "目标:",
        Checkbox_Minimize_Total_Cost_of_Ownership: " 最小化总体拥有成本",
        Checkbox_Minimize_Initial_Investment: " 最小化初始投资金额",
        Checkbox_Minimize_Stations: " 最小化站点数量",
        Checkbox_Maximize_Automation: " 最大自动化程度",
        toggleButton: "参数调整 ",
        cycleTimeInput: "周期时间要求（秒）：",
        timeLimitInput: "优化时间上限（秒）：",
        manualCostInput: "搭建人工工作站的初始成本：",
        automaticCostInput: "搭建自动工作站的初始成本：",
        laborCostsInput: "每小时的人工成本:",
        workingHoursInput: "每日工作小时：",
        maintenanceCostsInput: "自动站的维护成本（%):",
        horizonInput: "规划期限（年）：",
        fileUploadLabel: "上传任务概述 Excel 文件",
        statusUploadLabel: "上传当前状态 Excel 文件",
        startButton: "开始优化",
        showResults: "显示结果",
    }
}

function switchLanguage(language) {
    document.getElementById("tutorial").textContent = content[language].tutorial;

    document.getElementById("checkbox-label").textContent = content[language].checkboxLabel;

    document.getElementById("Checkbox_Minimize_Total_Cost_of_Ownership").innerHTML = `
    <input type="checkbox" id="Checkbox_Minimize_Total_Cost_of_Ownership" value="Minimize_Total_Cost_of_Ownership">
    ${content[language].Checkbox_Minimize_Total_Cost_of_Ownership} `;

    document.getElementById("Checkbox_Minimize_Initial_Investment").innerHTML = `
    <input type="checkbox" id="Checkbox_Minimize_Initial_Investment" value="Minimize_Total_Cost_of_Ownership">
    ${content[language].Checkbox_Minimize_Initial_Investment} `;

    document.getElementById("Checkbox_Minimize_Stations").innerHTML = `
    <input type="checkbox" id="Checkbox_Minimize_Stations" value="Minimize_Total_Cost_of_Ownership">
    ${content[language].Checkbox_Minimize_Stations} `;

    document.getElementById("Checkbox_Maximize_Automation").innerHTML = `
    <input type="checkbox" id="Checkbox_Maximize_Automation" value="Minimize_Total_Cost_of_Ownership">
    ${content[language].Checkbox_Maximize_Automation} `;

    document.getElementById("toggle-button").childNodes[0].textContent = content[language].toggleButton;

    document.getElementById("cycle-time-label").textContent = content[language].cycleTimeInput;
    document.getElementById("time-limit-label").textContent = content[language].timeLimitInput;
    document.getElementById("manual-cost-label").textContent = content[language].manualCostInput;
    document.getElementById("automatic-cost-label").textContent = content[language].automaticCostInput;
    document.getElementById("labor-cost-label").textContent = content[language].laborCostsInput;
    document.getElementById("working-hours-label").textContent = content[language].workingHoursInput;
    document.getElementById("maintenance-cost-label").textContent = content[language].maintenanceCostsInput;
    document.getElementById("horizon-label").textContent = content[language].horizonInput;

    document.getElementById("file-upload-label").textContent = content[language].fileUploadLabel;
    document.getElementById("status-upload-label").textContent = content[language].statusUploadLabel;

    document.getElementById("start-button").textContent = content[language].startButton;
    document.getElementById("show-results").textContent = content[language].showResults;
}